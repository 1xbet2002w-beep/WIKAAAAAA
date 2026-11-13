import { GoogleGenAI, Type } from '@google/genai';
import type {
  AIModelConfig,
  AnalysisConfig,
  AnalyzedPick,
  DebateEntry,
  DebateStage,
  MarketOption,
  MatchData,
  ModelMarketOpinion,
  ModelSlotId,
  WarRoomResult,
} from '../shared/types.ts';
import { filterAndRankPicks } from './filterEngine.ts';
import { clampProb, computeMarketBaseline, evaluateDataQuality } from './statsEngine.ts';
import { getCachedAnalysis, getPublicSettings, getRawAiCustomKeys, setCachedAnalysis } from './store.ts';

export interface WarRoomStreamEvent {
  type: 'INIT' | 'MODEL_STATUS' | 'DEBATE_ENTRY' | 'STAGE' | 'COMPLETE' | 'ERROR';
  payload: any;
}

interface RawModelMarketOutput {
  marketId: string;
  estimatedProbability: number;
  confidenceInEvidence: number;
  stance: 'SUPPORT' | 'CAUTION' | 'REJECT';
  reasoningAr: string;
  keyEvidence: string[];
  identifiedRisks: string[];
}

interface RawCrossReviewOutput {
  marketId: string;
  targetSlotId: ModelSlotId;
  objectionAr: string;
  counterEvidenceAr: string;
  revisedProbability: number;
  revisedStance: 'SUPPORT' | 'CAUTION' | 'REJECT';
}

function createGeminiClient(): GoogleGenAI {
  return new GoogleGenAI({});
}

async function callModelStructuredJSON<T>(
  modelCfg: AIModelConfig,
  customKey: string | undefined,
  systemInstruction: string,
  userPrompt: string,
  geminiSchema: any
): Promise<T> {
  if (modelCfg.provider === 'GEMINI') {
    const ai = createGeminiClient();
    const response = await ai.models.generateContent({
      model: modelCfg.modelName || 'gemini-4-hydrogen',
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: geminiSchema,
      },
    });
    const text = (response.text ?? '{}').trim();
    return JSON.parse(text) as T;
  }

  // External OpenAI-compatible / DeepSeek / Groq / OpenRouter provider
  const defaultEndpoints: Record<string, string> = {
    DEEPSEEK: 'https://api.deepseek.com/v1/chat/completions',
    GROQ: 'https://api.groq.com/openai/v1/chat/completions',
    OPENROUTER: 'https://openrouter.ai/api/v1/chat/completions',
    OPENAI_COMPATIBLE: 'https://api.openai.com/v1/chat/completions',
  };
  const endpoint = modelCfg.endpointUrl || defaultEndpoints[modelCfg.provider] || defaultEndpoints.OPENAI_COMPATIBLE;
  if (!customKey) {
    throw new Error(`مفتاح API غير مضبوط للنموذج ${modelCfg.displayNameAr}`);
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customKey}`,
    },
    body: JSON.stringify({
      model: modelCfg.modelName,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `${systemInstruction}\nأرجع JSON صالحًا فقط مطابقًا للهيكل المطلوب.` },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`فشل الاتصال بمزود ${modelCfg.provider} (${res.status}): ${errText.slice(0, 140)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || '{}';
  return JSON.parse(content) as T;
}

const ROUND1_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    evaluations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          marketId: { type: Type.STRING },
          estimatedProbability: { type: Type.NUMBER },
          confidenceInEvidence: { type: Type.NUMBER },
          stance: { type: Type.STRING },
          reasoningAr: { type: Type.STRING },
          keyEvidence: { type: Type.ARRAY, items: { type: Type.STRING } },
          identifiedRisks: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['marketId', 'estimatedProbability', 'confidenceInEvidence', 'stance', 'reasoningAr', 'keyEvidence', 'identifiedRisks'],
      },
    },
  },
  required: ['evaluations'],
};

const DEBATE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    reviews: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          marketId: { type: Type.STRING },
          targetSlotId: { type: Type.STRING },
          objectionAr: { type: Type.STRING },
          counterEvidenceAr: { type: Type.STRING },
          revisedProbability: { type: Type.NUMBER },
          revisedStance: { type: Type.STRING },
        },
        required: ['marketId', 'targetSlotId', 'objectionAr', 'counterEvidenceAr', 'revisedProbability', 'revisedStance'],
      },
    },
  },
  required: ['reviews'],
};

function getAnalystFraming(slotId: ModelSlotId): string {
  // All 3 models have EQUAL authority and analyze ALL market categories;
  // each applies an independent analytical lens without splitting markets by specialization.
  switch (slotId) {
    case 'analyst_alpha':
      return 'أنت محلل كرة قدم مستقل (المحور التكتيكي ألفا). حلّل جميع الأسواق المتاحة بالتساوي بناءً على التكتيك، التشكيلات، الغيابات، نسق المباراة، والأدلة الميدانية.';
    case 'analyst_beta':
      return 'أنت محلل كرة قدم كمي مستقل (المحور الكمي بيتا). حلّل جميع الأسواق المتاحة بالتساوي بناءً على معدلات الأهداف/الركنيات/البطاقات، توزيع بواسون، الأداء على الأرض وخارجها، والمواجهات المباشرة.';
    case 'analyst_gamma':
      return 'أنت مدقق مخاطر وأسواق مستقل (مدقق المخاطر غاما). حلّل جميع الأسواق المتاحة بالتساوي مع التركيز على هامش شركة المراهنات، جودة البيانات، تقلبات الدقائق الحرجة، وقواعد التسوية.';
  }
}

function buildMatchDigestForPrompt(
  match: MatchData,
  markets: MarketOption[],
  baselines: Map<string, ReturnType<typeof computeMarketBaseline>>
): string {
  const quality = evaluateDataQuality(match);
  const marketLines = markets.map((m) => {
    const b = baselines.get(m.id)!;
    return `- marketId="${m.id}" | [${m.category}] ${m.marketNameAr}: "${m.selectionAr}" | Odds=${m.odds} | FairBookProb=${b.bookmakerFairProb}% | PoissonStatProb=${b.statisticalProb}% | Settled=${b.isMathematicallySettled} | Rule=${m.settlementRule}`;
  });

  return `
المباراة: ${match.homeTeam.nameAr} ضد ${match.awayTeam.nameAr} (${match.leagueNameAr})
الوضع: ${match.mode} | الحالة: ${match.status} | الدقيقة: ${match.minute ?? 'لم تبدأ'} | النتيجة: ${match.scoreHome ?? '-'}-${match.scoreAway ?? '-'}
جودة البيانات: ${quality.score}% | آخر تحديث منذ ${quality.freshnessSeconds} ثانية | مشاكل: ${quality.issues.join('؛ ') || 'لا يوجد'}
إحصائيات المضيف (${match.homeTeam.nameAr}): آخر 5=${match.homeTeam.last5Form.join('')}, معدل أهداف مسجلة=${match.homeTeam.avgGoalsScored}, مستقبلة=${match.homeTeam.avgGoalsConceded}, ركنيات=${match.homeTeam.avgCornersFor}, بطاقات=${match.homeTeam.avgCardsFor}, إصابات=${match.homeTeam.injuries.map((i) => `${i.player}(${i.impact})`).join(',') || 'لا يوجد'}
إحصائيات الضيف (${match.awayTeam.nameAr}): آخر 5=${match.awayTeam.last5Form.join('')}, معدل أهداف مسجلة=${match.awayTeam.avgGoalsScored}, مستقبلة=${match.awayTeam.avgGoalsConceded}, ركنيات=${match.awayTeam.avgCornersFor}, بطاقات=${match.awayTeam.avgCardsFor}, إصابات=${match.awayTeam.injuries.map((i) => `${i.player}(${i.impact})`).join(',') || 'لا يوجد'}
المواجهات المباشرة (آخر ${match.h2hSummary.played}): فوز المضيف=${match.h2hSummary.homeWins}, تعادل=${match.h2hSummary.draws}, فوز الضيف=${match.h2hSummary.awayWins}, معدل أهداف=${match.h2hSummary.avgGoals}
${match.liveStats ? `إحصائيات مباشرة: استحواذ ${match.liveStats.possessionHome}-${match.liveStats.possessionAway} | تسديدات ${match.liveStats.shotsHome}-${match.liveStats.shotsAway} | على المرمى ${match.liveStats.shotsOnTargetHome}-${match.liveStats.shotsOnTargetAway} | ركنيات ${match.liveStats.cornersHome}-${match.liveStats.cornersAway} | بطاقات صفراء ${match.liveStats.yellowCardsHome}-${match.liveStats.yellowCardsAway} | حمراء ${match.liveStats.redCardsHome}-${match.liveStats.redCardsAway}` : ''}
الأسواق المتاحة فعليًا في المصدر:
${marketLines.join('\n')}
`.trim();
}

export async function runWarRoomAnalysis(
  config: AnalysisConfig,
  allMatchesForMode: MatchData[],
  emit: (event: WarRoomStreamEvent) => void
): Promise<WarRoomResult> {
  const settings = getPublicSettings();
  const customKeys = getRawAiCustomKeys();
  const maxRounds = Math.min(4, Math.max(1, config.maxDebateRounds || settings.maxDebateRounds || 4));

  // Filter matches if specific matchIds requested; exclude finished FT matches from bulk scans
  const targetMatches =
    config.matchIds && config.matchIds.length > 0
      ? allMatchesForMode.filter((m) => config.matchIds!.includes(m.id))
      : allMatchesForMode.filter((m) => m.status !== 'FT');

  // Check cache key to avoid unnecessary API calls (Zero-budget optimization)
  const cacheFingerprint = JSON.stringify({
    mode: config.mode,
    targetOdds: config.targetOdds,
    oddsTolerance: config.oddsTolerance,
    oddsMode: config.oddsMode,
    targetProbability: config.targetProbability,
    selectedCategories: config.selectedCategories,
    maxResults: config.maxResults,
    maxRounds,
    matchStamps: targetMatches.map((m) => `${m.id}:${m.minute}:${m.scoreHome}-${m.scoreAway}:${m.feedUpdatedAt}:${m.feedOutage}:${m.feedStale}`),
  });

  const cached = getCachedAnalysis(cacheFingerprint, settings.cacheTtlSeconds);
  if (cached) {
    emit({ type: 'STAGE', payload: { stage: 'FINAL_DECISION', messageAr: 'تم استرجاع نتيجة التحليل الجماعي الموثقة من الذاكرة المؤقتة لتوفير استهلاك API.' } });
    emit({ type: 'COMPLETE', payload: cached });
    return cached;
  }

  // Verify all 3 AI models are enabled & configured (strictly forbid faking 3-model consensus)
  const missingModels = settings.aiModels
    .filter((m) => m.status !== 'READY')
    .map((m) => `${m.displayNameAr} (${m.status === 'MISSING_KEY' ? 'مفتاح API غير متوفر' : 'معطل'})`);

  if (missingModels.length > 0) {
    const emptyRes: WarRoomResult = {
      sessionId: `wr-${Date.now()}`,
      createdAt: new Date().toISOString(),
      config,
      matchesScanned: targetMatches.length,
      marketsAnalyzed: 0,
      qualifiedCount: 0,
      needsReviewCount: 0,
      disqualifiedCount: 0,
      missingModels,
      warningsAr: [
        `تعذر اكتمال التحليل الجماعي لأن النماذج الثلاثة غير مكتملة التوفر: ${missingModels.join('، ')}. لا يدّعي النظام وجود إجماع جماعي مع غياب أحد النماذج.`,
      ],
      emptyReasonAr: 'يرجى تفعيل وتجهيز النماذج الثلاثة من شاشة إعدادات مصادر البيانات قبل تشغيل التحليل الجماعي.',
      picks: [],
      accumulators: [],
      debateLog: [],
      cachedHit: false,
      isDemo: targetMatches.some((m) => m.isDemo),
    };
    emit({ type: 'COMPLETE', payload: emptyRes });
    return emptyRes;
  }

  const warningsAr: string[] = [];
  const debateLog: DebateEntry[] = [];
  const allAnalyzedPicks: AnalyzedPick[] = [];
  let totalMarketsAnalyzed = 0;
  let skippedNoMarkets = 0;
  let aiAnalyzedMatchesCount = 0;

  emit({
    type: 'INIT',
    payload: {
      matchesCount: targetMatches.length,
      models: settings.aiModels.map((m) => ({ slotId: m.slotId, name: m.displayNameAr })),
    },
  });

  // Pre-filter candidate markets per match by selected categories & plausible odds window (or all if combined)
  const minBand = config.oddsMode === 'SINGLE' ? Math.max(1.01, config.targetOdds - config.oddsTolerance - 0.15) : 1.02;
  const maxBand = config.oddsMode === 'SINGLE' ? config.targetOdds + config.oddsTolerance + 0.15 : Math.max(3.5, config.targetOdds);

  for (const match of targetMatches) {
    const dataQualityReport = evaluateDataQuality(match);
    const matchLabelAr = `${match.homeTeam.nameAr} × ${match.awayTeam.nameAr}`;

    if (match.feedOutage) {
      warningsAr.push(`${matchLabelAr}: تم إيقاف إصدار الترشيحات بسبب انقطاع مصدر البيانات (${match.outageReason || 'خطأ مزود'}).`);
      continue;
    }

    if (match.mode === 'LIVE' && dataQualityReport.isStale) {
      warningsAr.push(`${matchLabelAr}: البيانات المباشرة متأخرة (${dataQualityReport.freshnessSeconds} ثانية) — تم تعليق الترشيحات الحية المتأثرة.`);
      continue;
    }

    if (match.availableMarkets.length === 0) {
      skippedNoMarkets++;
      continue;
    }

    const categoryFiltered = match.availableMarkets.filter((opt) => {
      if (config.selectedCategories !== 'ALL' && !config.selectedCategories.includes(opt.category)) {
        return false;
      }
      return opt.odds >= minBand && opt.odds <= maxBand;
    });

    // If single mode finds nothing in tight band, include top 4 closest markets so the user sees honest analysis & why none qualified
    const candidateMarkets =
      categoryFiltered.length > 0
        ? categoryFiltered.slice(0, 8)
        : match.availableMarkets
            .filter((opt) => config.selectedCategories === 'ALL' || config.selectedCategories.includes(opt.category))
            .slice(0, 4);

    if (candidateMarkets.length === 0) continue;

    if (aiAnalyzedMatchesCount >= 6) {
      warningsAr.push(`تم تحليل أول 6 مباريات متوفرة الأسواق في هذه الدفعة لتفادي استهلاك حدود API؛ يمكنك تحديد مباريات معينة لتحليلها مباشرة.`);
      break;
    }
    aiAnalyzedMatchesCount++;

    totalMarketsAnalyzed += candidateMarkets.length;

    const baselines = new Map<string, ReturnType<typeof computeMarketBaseline>>();
    for (const opt of candidateMarkets) {
      baselines.set(opt.id, computeMarketBaseline(match, opt));
    }

    const matchDigest = buildMatchDigestForPrompt(match, candidateMarkets, baselines);

    // ================= ROUND 1: INDEPENDENT ANALYSIS (PARALLEL 3 MODELS) =================
    emit({
      type: 'STAGE',
      payload: { stage: 'ROUND_1_INDEPENDENT', messageAr: `المرحلة 1 — التحليل المستقل لمباراة ${matchLabelAr}` },
    });

    const round1Prompt = `
قم بتحليل جميع الأسواق التالية بصورة مستقلة وموضوعية استنادًا إلى بيانات المباراة الحقيقية أدناه فقط.
قواعد صارمة:
1. لا تخترع أرقامًا أو إحصائيات غير واردة في البيانات.
2. لا تعطِ احتمال 100% إلا إذا كان Settled=true صراحةً.
3. قيّم كل سوق من الأسواق المدرجة وأرجع مصفوفة evaluations بنفس معرفات marketId.
4. stance يكون أحد: "SUPPORT" أو "CAUTION" أو "REJECT".

${matchDigest}
`.trim();

    const r1Results = new Map<ModelSlotId, RawModelMarketOutput[]>();

    const r1Promises = settings.aiModels.map(async (modelCfg) => {
      emit({ type: 'MODEL_STATUS', payload: { slotId: modelCfg.slotId, status: 'ANALYZING', progress: 25, matchLabelAr } });
      try {
        const res = await callModelStructuredJSON<{ evaluations: RawModelMarketOutput[] }>(
          modelCfg,
          customKeys[modelCfg.slotId],
          `${getAnalystFraming(modelCfg.slotId)} أجب بالعربية بدقة تحليلية احترافية.`,
          round1Prompt,
          ROUND1_SCHEMA
        );
        const evals = res.evaluations || [];
        r1Results.set(modelCfg.slotId, evals);

        const topEval = evals[0];
        if (topEval) {
          const entry: DebateEntry = {
            id: `deb-${Date.now()}-${modelCfg.slotId}-r1`,
            stage: 'ROUND_1_INDEPENDENT',
            roundNumber: 1,
            speakerSlotId: modelCfg.slotId,
            speakerNameAr: modelCfg.displayNameAr,
            matchId: match.id,
            matchLabelAr,
            marketSelectionId: topEval.marketId,
            stance: 'ANALYSIS',
            messageAr: topEval.reasoningAr,
            timestamp: new Date().toISOString(),
          };
          debateLog.push(entry);
          emit({ type: 'DEBATE_ENTRY', payload: entry });
        }

        emit({ type: 'MODEL_STATUS', payload: { slotId: modelCfg.slotId, status: 'ROUND_1_DONE', progress: 45, matchLabelAr } });
      } catch (err: any) {
        throw new Error(`فشل ${modelCfg.displayNameAr} في المرحلة 1: ${err?.message || 'خطأ غير معروف'}`);
      }
    });

    try {
      await Promise.all(r1Promises);
    } catch (err: any) {
      warningsAr.push(`${matchLabelAr}: ${err.message} — تم إيقاف التحليل الجماعي لهذه المباراة لعدم اكتمال النماذج الثلاثة.`);
      continue;
    }

    // ================= ROUNDS 2–4: CROSS REVIEW, DEBATE & REASSESSMENT =================
    const finalEvaluations = new Map<ModelSlotId, Map<string, ModelMarketOpinion>>();
    for (const modelCfg of settings.aiModels) {
      const mMap = new Map<string, ModelMarketOpinion>();
      for (const ev of r1Results.get(modelCfg.slotId) || []) {
        const baseline = baselines.get(ev.marketId);
        const prob = baseline?.isMathematicallySettled ? 100 : clampProb(ev.estimatedProbability, false);
        mMap.set(ev.marketId, {
          slotId: modelCfg.slotId,
          modelDisplayName: modelCfg.displayNameAr,
          providerLabel: `${modelCfg.provider} · ${modelCfg.modelName}`,
          estimatedProbability: prob,
          confidenceInEvidence: Math.min(99, Math.max(20, Math.round(ev.confidenceInEvidence))),
          stance: (['SUPPORT', 'CAUTION', 'REJECT'].includes(ev.stance) ? ev.stance : 'CAUTION') as ModelMarketOpinion['stance'],
          reasoningAr: ev.reasoningAr,
          keyEvidence: ev.keyEvidence || [],
          identifiedRisks: ev.identifiedRisks || [],
        });
      }
      finalEvaluations.set(modelCfg.slotId, mMap);
    }

    const objectionsByMarket = new Map<string, string[]>();

    if (maxRounds >= 2) {
      emit({
        type: 'STAGE',
        payload: { stage: 'ROUND_2_CROSS_REVIEW', messageAr: `المرحلة 2 و 3 — تبادل التحليلات والنقاش والاعتراض لمباراة ${matchLabelAr}` },
      });

      const summaryForCrossReview = settings.aiModels
        .map((m) => {
          const items = (r1Results.get(m.slotId) || [])
            .map((e) => `  • marketId=${e.marketId}: prob=${e.estimatedProbability}%, stance=${e.stance}, reason="${e.reasoningAr}", risks=[${(e.identifiedRisks || []).join('، ')}]`)
            .join('\n');
          return `[${m.slotId} - ${m.displayNameAr}]:\n${items}`;
        })
        .join('\n\n');

      const debatePromises = settings.aiModels.map(async (modelCfg) => {
        emit({ type: 'MODEL_STATUS', payload: { slotId: modelCfg.slotId, status: 'DEBATING', progress: 75, matchLabelAr } });
        const otherSlots = settings.aiModels.filter((x) => x.slotId !== modelCfg.slotId).map((x) => x.slotId);

        const debatePrompt = `
أنت الآن في مرحلة تبادل التحليلات والنقاش والاعتراض وإعادة التقييم لمباراة ${matchLabelAr}.
اطّلع على تحليلات النموذجين الآخرين (${otherSlots.join(' و ')}) وقارنها ببيانات المباراة:
${summaryForCrossReview}

المطلوب منك في مصفوفة reviews (لكل سوق مهم أو فيه تباين):
1. اكتشاف نقاط الضعف في تحليل النموذجين الآخرين أو افتراضاتهما غير المدعومة بأدلة.
2. تحديد targetSlotId (${otherSlots[0]} أو ${otherSlots[1]}).
3. كتابة objectionAr (الاعتراض أو الملاحظة النقدية) و counterEvidenceAr (الدليل الإحصائي أو الميداني).
4. تقديم revisedProbability (الاحتمال النهائي المراجع بعد النقاش — لا تبالغ ولا تجبر نفسك على الموافقة إذا بقيت لديك تحفظات) و revisedStance ("SUPPORT" | "CAUTION" | "REJECT").
`.trim();

        try {
          const debateRes = await callModelStructuredJSON<{ reviews: RawCrossReviewOutput[] }>(
            modelCfg,
            customKeys[modelCfg.slotId],
            `${getAnalystFraming(modelCfg.slotId)} كن ناقدًا موضوعيًا ودقيقًا في كشف المخاطر.`,
            debatePrompt,
            DEBATE_SCHEMA
          );

          const reviews = debateRes.reviews || [];
          const mMap = finalEvaluations.get(modelCfg.slotId)!;

          for (const rev of reviews) {
            const existing = mMap.get(rev.marketId);
            const baseline = baselines.get(rev.marketId);
            const revProb = baseline?.isMathematicallySettled ? 100 : clampProb(rev.revisedProbability, false);

            if (existing) {
              const delta = Number((revProb - existing.estimatedProbability).toFixed(1));
              existing.estimatedProbability = revProb;
              existing.stance = (['SUPPORT', 'CAUTION', 'REJECT'].includes(rev.revisedStance)
                ? rev.revisedStance
                : existing.stance) as ModelMarketOpinion['stance'];
              if (rev.objectionAr) {
                const prevObjs = objectionsByMarket.get(rev.marketId) || [];
                prevObjs.push(`${modelCfg.displayNameAr}: ${rev.objectionAr}`);
                objectionsByMarket.set(rev.marketId, prevObjs);
              }

              const debStage: DebateStage = maxRounds >= 4 ? 'ROUND_4_REASSESSMENT' : 'ROUND_3_DEBATE_CHALLENGE';
              const entry: DebateEntry = {
                id: `deb-${Date.now()}-${modelCfg.slotId}-${rev.marketId}`,
                stage: debStage,
                roundNumber: maxRounds >= 4 ? 4 : 3,
                speakerSlotId: modelCfg.slotId,
                speakerNameAr: modelCfg.displayNameAr,
                targetSlotId: rev.targetSlotId,
                matchId: match.id,
                matchLabelAr,
                marketSelectionId: rev.marketId,
                stance: 'OBJECTION',
                messageAr: `${rev.objectionAr} — الدليل: ${rev.counterEvidenceAr}`,
                probabilityAdjustment: delta,
                timestamp: new Date().toISOString(),
              };
              debateLog.push(entry);
              emit({ type: 'DEBATE_ENTRY', payload: entry });
            }
          }
          emit({ type: 'MODEL_STATUS', payload: { slotId: modelCfg.slotId, status: 'DONE', progress: 100, matchLabelAr } });
        } catch (err: any) {
          throw new Error(`فشل ${modelCfg.displayNameAr} في جولة النقاش: ${err?.message || 'خطأ'}`);
        }
      });

      try {
        await Promise.all(debatePromises);
      } catch (err: any) {
        warningsAr.push(`${matchLabelAr}: ${err.message} — لم تكتمل جولة النقاش لجميع النماذج.`);
        continue;
      }
    } else {
      for (const m of settings.aiModels) {
        emit({ type: 'MODEL_STATUS', payload: { slotId: m.slotId, status: 'DONE', progress: 100, matchLabelAr } });
      }
    }

    // ================= STAGE 5: INDEPENDENT AGGREGATOR ENGINE =================
    emit({
      type: 'STAGE',
      payload: { stage: 'FINAL_DECISION', messageAr: `المرحلة 5 — محرك التجميع المستقل لمباراة ${matchLabelAr}` },
    });

    for (const market of candidateMarkets) {
      const baseline = baselines.get(market.id)!;
      const opinions: ModelMarketOpinion[] = [];

      for (const mCfg of settings.aiModels) {
        const op = finalEvaluations.get(mCfg.slotId)?.get(market.id);
        if (op) {
          opinions.push(op);
        }
      }

      if (opinions.length < 3) {
        // Incomplete 3-model evaluation for this market; do not synthesize missing voice
        continue;
      }

      const probs = opinions.map((o) => o.estimatedProbability);
      const meanModelProb = probs.reduce((a, b) => a + b, 0) / probs.length;
      const spread = Math.max(...probs) - Math.min(...probs);

      // Agreement metric: strictly separate from estimated probability
      const supportCount = opinions.filter((o) => o.stance === 'SUPPORT').length;
      const rejectCount = opinions.filter((o) => o.stance === 'REJECT').length;
      const hasStrongContradiction = spread >= 15 || (supportCount >= 1 && rejectCount >= 1);

      const rawAgreement = Math.max(15, Math.min(99, Math.round(100 - spread * 2.2 - (hasStrongContradiction ? 18 : 0))));

      // Calibrated Probability: weighted blend of local statistical baseline (35%), bookmaker fair prob (25%), and 3-model mean (40%)
      // Never output 100% unless mathematically settled by current live score!
      let calibratedProb = baseline.isMathematicallySettled
        ? 100
        : clampProb(baseline.statisticalProb * 0.35 + baseline.bookmakerFairProb * 0.25 + meanModelProb * 0.40, false);

      if (hasStrongContradiction && !baseline.isMathematicallySettled) {
        calibratedProb = clampProb(calibratedProb - 5.5, false);
      }

      const avgEvidence = Math.round(opinions.reduce((a, b) => a + b.confidenceInEvidence, 0) / opinions.length);
      const evidenceStrength = Math.round(avgEvidence * 0.55 + dataQualityReport.score * 0.45);

      let riskLevel: AnalyzedPick['riskLevel'] = 'MEDIUM';
      if (baseline.isMathematicallySettled) riskLevel = 'LOW';
      else if (dataQualityReport.score < 60 || hasStrongContradiction || calibratedProb < 62) riskLevel = 'HIGH';
      else if (calibratedProb >= 78 && rawAgreement >= 78 && dataQualityReport.score >= 80) riskLevel = 'LOW';

      let status: AnalyzedPick['status'] = 'QUALIFIED';
      let qualificationReasonAr = 'اجتاز معايير الاحتمال المعاير وجودة البيانات واتفاق النماذج الثلاثة.';

      if (dataQualityReport.score < 55) {
        status = 'DISQUALIFIED';
        qualificationReasonAr = 'مستبعد بسبب ضعف جودة البيانات أو نقص الإحصائيات الأساسية.';
      } else if (hasStrongContradiction || rejectCount >= 2) {
        status = rejectCount >= 2 ? 'DISQUALIFIED' : 'NEEDS_REVIEW';
        qualificationReasonAr = 'تباين قوي واعتراضات جوهرية بين النماذج الثلاثة — خُفضت الثقة ولم يُفرض الإجماع.';
      } else if (calibratedProb < config.targetProbability) {
        status = 'NEEDS_REVIEW';
        qualificationReasonAr = `الاحتمال المعاير (${calibratedProb}%) أقل من نسبة الأمان المطلوبة (${config.targetProbability}%).`;
      }

      const reasonsAr = Array.from(new Set(opinions.flatMap((o) => o.keyEvidence))).slice(0, 5);
      const objectionsAr = Array.from(
        new Set([
          ...(objectionsByMarket.get(market.id) || []),
          ...opinions.flatMap((o) => o.identifiedRisks),
        ])
      ).slice(0, 5);

      const pick: AnalyzedPick = {
        id: `pick-${match.id}-${market.id}`,
        matchId: match.id,
        leagueNameAr: match.leagueNameAr,
        homeTeamAr: match.homeTeam.nameAr,
        awayTeamAr: match.awayTeam.nameAr,
        kickoffTime: match.kickoffTime,
        mode: match.mode,
        liveMinute: match.minute,
        liveScore: match.scoreHome !== null ? `${match.scoreHome}-${match.scoreAway}` : null,
        marketId: market.id,
        category: market.category,
        marketNameAr: market.marketNameAr,
        selectionAr: market.selectionAr,
        selectionCode: market.selectionCode,
        odds: market.odds,
        bookmakerName: market.bookmakerName,
        settlementRule: market.settlementRule,
        statisticalBaselineProb: baseline.statisticalProb,
        bookmakerFairProb: baseline.bookmakerFairProb,
        estimatedProbability: calibratedProb,
        modelAgreement: rawAgreement,
        dataQuality: dataQualityReport.score,
        evidenceStrength,
        riskLevel,
        status,
        qualificationReasonAr,
        reasonsAr,
        objectionsAr,
        contradictionDetected: hasStrongContradiction,
        isMathematicallySettled: baseline.isMathematicallySettled,
        modelOpinions: opinions,
        lastUpdatedAt: new Date().toISOString(),
        isDemo: match.isDemo,
      };

      allAnalyzedPicks.push(pick);
    }

    const finalVerdictEntry: DebateEntry = {
      id: `deb-verdict-${match.id}-${Date.now()}`,
      stage: 'FINAL_DECISION',
      roundNumber: 5,
      speakerSlotId: 'AGGREGATOR',
      speakerNameAr: 'محرك التجميع المستقل',
      matchId: match.id,
      matchLabelAr,
      stance: 'VERDICT',
      messageAr: `اكتمل فحص ${candidateMarkets.length} أسواق لمباراة ${matchLabelAr} مع تقييم جودة البيانات (${dataQualityReport.score}%) ومراجعة الاعتراضات.`,
      timestamp: new Date().toISOString(),
    };
    debateLog.push(finalVerdictEntry);
    emit({ type: 'DEBATE_ENTRY', payload: finalVerdictEntry });
  }

  if (skippedNoMarkets > 0) {
    warningsAr.push(`تم استبعاد ${skippedNoMarkets} مباراة لعدم توفر أسعار أسواق مراهنات حقيقية لها من المصدر الحالي (يرفض النظام اختراع أود وهمي).`);
  }

  const filtered = filterAndRankPicks(allAnalyzedPicks, config);

  const result: WarRoomResult = {
    sessionId: `wr-${Date.now()}`,
    createdAt: new Date().toISOString(),
    config,
    matchesScanned: targetMatches.length,
    marketsAnalyzed: totalMarketsAnalyzed,
    qualifiedCount: config.oddsMode === 'SINGLE' ? filtered.qualifiedPicks.length : filtered.accumulators.length,
    needsReviewCount: allAnalyzedPicks.filter((p) => p.status === 'NEEDS_REVIEW').length,
    disqualifiedCount: allAnalyzedPicks.filter((p) => p.status === 'DISQUALIFIED').length,
    missingModels: [],
    warningsAr,
    emptyReasonAr: filtered.emptyReasonAr,
    picks: config.oddsMode === 'SINGLE' ? [...filtered.qualifiedPicks, ...filtered.otherAnalyzedPicks] : filtered.otherAnalyzedPicks,
    accumulators: filtered.accumulators,
    debateLog,
    cachedHit: false,
    isDemo: targetMatches.some((m) => m.isDemo),
  };

  setCachedAnalysis(cacheFingerprint, result);
  emit({ type: 'COMPLETE', payload: result });
  return result;
}
