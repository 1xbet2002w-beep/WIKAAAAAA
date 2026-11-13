import React, { useMemo, useState } from 'react';
import { AlertCircle, BookmarkCheck, CheckCircle2, Eye, ShieldAlert, X } from 'lucide-react';
import type {
  AIModelConfig,
  AnalyzedPick,
  DebateEntry,
  DebateStage,
  MarketCategoryMeta,
  MatchData,
  ModelSlotId,
  WarRoomResult,
} from '../../shared/types';
import { evaluateBetOutcome } from '../../shared/settlementEvaluator';
import { SETTLEMENT_RULE_LABELS } from '../../server/markets';
import { buildBetExplanationAr } from '../utils/betExplainer';
import { getOutcomeStyle, getSafetyTier } from '../utils/safetyTheme';

export interface ModelLiveState {
  status: string;
  progress: number;
  matchLabelAr?: string;
}

interface WarRoomViewProps {
  models: AIModelConfig[];
  matches: MatchData[];
  isRunning: boolean;
  currentStage: DebateStage | null;
  stageMessageAr: string;
  modelLiveStates: Record<ModelSlotId, ModelLiveState>;
  liveDebateFeed: DebateEntry[];
  result: WarRoomResult | null;
  categories: MarketCategoryMeta[];
  onSavePick: (pick: AnalyzedPick) => Promise<{ saved: boolean; duplicate: boolean }>;
  onGoToSetup: () => void;
}

const STAGES_ORDER: { id: DebateStage; titleAr: string; subtitleEn: string }[] = [
  { id: 'ROUND_1_INDEPENDENT', titleAr: 'الجولة 1 — التحليل المستقل', subtitleEn: 'ROUND 1 — Independent Analysis' },
  { id: 'ROUND_2_CROSS_REVIEW', titleAr: 'الجولة 2 — تبادل التحليلات', subtitleEn: 'ROUND 2 — Cross Review' },
  { id: 'ROUND_3_DEBATE_CHALLENGE', titleAr: 'الجولة 3 — النقاش والاعتراض', subtitleEn: 'ROUND 3 — Debate & Challenge' },
  { id: 'ROUND_4_REASSESSMENT', titleAr: 'الجولة 4 — إعادة التحليل', subtitleEn: 'ROUND 4 — Final Reassessment' },
  { id: 'FINAL_DECISION', titleAr: 'القرار النهائي لمحرك التجميع', subtitleEn: 'FINAL DECISION' },
];

export const WarRoomView: React.FC<WarRoomViewProps> = ({
  models,
  matches,
  isRunning,
  currentStage,
  stageMessageAr,
  modelLiveStates,
  liveDebateFeed,
  result,
  categories,
  onSavePick,
  onGoToSetup,
}) => {
  const [marketFilter, setMarketFilter] = useState<string>('ALL');
  const [leagueFilter, setLeagueFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'QUALIFIED' | 'NEEDS_REVIEW' | 'DISQUALIFIED'>('QUALIFIED');
  const [sortBy, setSortBy] = useState<'PROB' | 'ODDS' | 'QUALITY'>('PROB');
  const [detailPick, setDetailPick] = useState<AnalyzedPick | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<Record<string, string>>({});

  const debateEntries = result && !isRunning ? result.debateLog : liveDebateFeed;

  const picksSource = result?.picks || [];
  const leagues = useMemo(() => Array.from(new Set(picksSource.map((p) => p.leagueNameAr))), [picksSource]);

  const filteredPicks = useMemo(() => {
    const list = picksSource.filter((p) => {
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (marketFilter !== 'ALL' && p.category !== marketFilter) return false;
      if (leagueFilter !== 'ALL' && p.leagueNameAr !== leagueFilter) return false;
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'ODDS') return a.odds - b.odds;
      if (sortBy === 'QUALITY') return b.dataQuality - a.dataQuality;
      return b.estimatedProbability - a.estimatedProbability;
    });
  }, [picksSource, statusFilter, marketFilter, leagueFilter, sortBy]);

  const handleSave = async (pick: AnalyzedPick) => {
    const res = await onSavePick(pick);
    setSaveFeedback((prev) => ({
      ...prev,
      [pick.id]: res.duplicate ? 'محفوظ مسبقًا (مُنع التكرار)' : res.saved ? 'تم الحفظ في السجل الثابت' : 'تعذر الحفظ',
    }));
  };

  const statusLabel = (s: AnalyzedPick['status']) => {
    if (s === 'QUALIFIED') return { text: 'مؤهل', cls: 'text-teal-300' };
    if (s === 'NEEDS_REVIEW') return { text: 'يحتاج مراجعة', cls: 'text-amber-300' };
    return { text: 'غير مؤهل', cls: 'text-red-400' };
  };

  const riskLabel = (r: AnalyzedPick['riskLevel']) => {
    if (r === 'LOW') return { text: 'مخاطرة منخفضة', cls: 'text-teal-300' };
    if (r === 'MEDIUM') return { text: 'مخاطرة متوسطة', cls: 'text-sky-300' };
    if (r === 'HIGH') return { text: 'مخاطرة عالية', cls: 'text-amber-300' };
    return { text: 'مخاطرة حرجة', cls: 'text-red-400' };
  };

  return (
    <div className="space-y-8">
      {/* War Room Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="text-xs font-mono text-teal-300">AI WAR ROOM & CONSENSUS ENGINE</div>
          <h1 className="font-display text-2xl font-extrabold text-slate-50">غرفة الذكاء الاصطناعي والترشيحات</h1>
        </div>
        <div className="flex items-center gap-3">
          {result?.cachedHit && (
            <span className="text-xs text-sky-300">نتيجة مسترجعة من الكاش لتقليل استهلاك API</span>
          )}
          <button
            type="button"
            onClick={onGoToSetup}
            className="rounded-lg border border-slate-700 bg-[#0D1526] px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer whitespace-nowrap"
          >
            تحليل جديد / تعديل المعايير
          </button>
        </div>
      </div>

      {/* Real-time Stage Progress Strip (only reflects genuine activity) */}
      {(isRunning || stageMessageAr) && (
        <div className="rounded-xl border border-sky-500/30 bg-[#0D1829] p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-medium text-sky-200">{stageMessageAr || 'اكتمل التحليل'}</div>
          <div className="font-mono text-xs text-slate-400">
            {isRunning ? 'طلب فعلي قيد المعالجة' : currentStage || 'READY'}
          </div>
        </div>
      )}

      {/* 3 Equal Independent AI Model Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {models.map((m) => {
          const live = modelLiveStates[m.slotId] || { status: 'IDLE', progress: 0 };
          const modelDebates = debateEntries.filter((d) => d.speakerSlotId === m.slotId);
          const latestAnalysis = modelDebates.find((d) => d.stance === 'ANALYSIS');
          const latestObjection = modelDebates.find((d) => d.stance === 'OBJECTION');

          // Gather average probability from result if available
          const modelOps = result?.picks.flatMap((p) => p.modelOpinions.filter((o) => o.slotId === m.slotId)) || [];
          const avgProb =
            modelOps.length > 0
              ? (modelOps.reduce((s, o) => s + o.estimatedProbability, 0) / modelOps.length).toFixed(1)
              : null;

          return (
            <div key={m.slotId} className="rounded-2xl border border-slate-800/90 bg-[#0D1526] p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-xs text-slate-400">
                      {m.provider} · {m.modelName}
                    </div>
                    <h2 className="mt-1 font-display text-base font-bold text-slate-50">{m.displayNameAr}</h2>
                  </div>
                  <span
                    className={`text-xs font-medium shrink-0 ${
                      live.status === 'DONE'
                        ? 'text-teal-300'
                        : live.status === 'ANALYZING' || live.status === 'DEBATING'
                        ? 'text-sky-300'
                        : m.status === 'READY'
                        ? 'text-slate-400'
                        : 'text-amber-300'
                    }`}
                  >
                    {live.status === 'DONE'
                      ? 'اكتمل التقييم'
                      : live.status === 'ANALYZING'
                      ? 'تحليل مستقل...'
                      : live.status === 'DEBATING'
                      ? 'نقاش واعتراض...'
                      : m.status === 'READY'
                      ? 'جاهز'
                      : 'غير مهيأ'}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1 tabular-nums">
                    <span>تقدم المهمة</span>
                    <span className="font-mono">{live.progress}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-teal-400 transition-all duration-300"
                      style={{ width: `${live.progress}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 space-y-2.5 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5">ملخص التحليل:</span>
                    <p className="text-slate-200 leading-relaxed line-clamp-3">
                      {latestAnalysis?.messageAr || 'في انتظار تشغيل جلسة التحليل الفعلي لعرض الاستنتاجات.'}
                    </p>
                  </div>

                  {latestObjection && (
                    <div className="pt-2 border-t border-slate-800/70">
                      <span className="text-amber-300 block mb-0.5">أحدث اعتراض على النماذج الأخرى:</span>
                      <p className="text-slate-300 leading-relaxed line-clamp-3">{latestObjection.messageAr}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs tabular-nums">
                <span className="text-slate-400">متوسط تقديرات النموذج</span>
                <span className="font-mono font-bold text-sky-300">{avgProb ? `${avgProb}%` : '—'}</span>
              </div>
            </div>
          );
        })}
      </section>

      {/* 5-Stage Debate Arena */}
      <section className="rounded-2xl border border-slate-800/90 bg-[#0D1526] p-6">
        <h2 className="font-display text-lg font-bold text-slate-50 mb-4">سجل مراحل النقاش الجماعي</h2>

        {/* 5-Stage Stepper */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pb-5 border-b border-slate-800/80">
          {STAGES_ORDER.map((st, idx) => {
            const active = currentStage === st.id;
            const passed =
              result && !isRunning
                ? true
                : currentStage
                ? STAGES_ORDER.findIndex((x) => x.id === currentStage) > idx
                : false;
            return (
              <div
                key={st.id}
                className={`rounded-lg border p-2.5 text-xs ${
                  active
                    ? 'border-sky-400/60 bg-sky-500/10 text-sky-200'
                    : passed
                    ? 'border-teal-500/40 bg-teal-500/10 text-teal-300'
                    : 'border-slate-800 bg-[#070B14] text-slate-500'
                }`}
              >
                <div className="font-mono text-[10px] opacity-80">{st.subtitleEn}</div>
                <div className="mt-0.5 font-semibold">{st.titleAr}</div>
              </div>
            );
          })}
        </div>

        {/* Live Debate Log */}
        {debateEntries.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            لا توجد مداولات مسجلة بعد. ابدأ التحليل من قسم المباريات المباشرة أو ما قبل المباراة لمشاهدة تبادل التحليلات والاعتراضات هنا.
          </p>
        ) : (
          <div className="mt-4 max-h-80 overflow-y-auto space-y-3 pr-1">
            {debateEntries.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-slate-800/80 bg-[#070B14] p-3.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 text-slate-400 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-100">{entry.speakerNameAr}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-sky-300">{entry.matchLabelAr}</span>
                    {entry.stance === 'OBJECTION' && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-amber-300 font-semibold">اعتراض ومراجعة</span>
                      </>
                    )}
                    {entry.stance === 'VERDICT' && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-teal-300 font-semibold">قرار نهائي</span>
                      </>
                    )}
                  </div>
                  <span className="font-mono tabular-nums">{entry.stage}</span>
                </div>
                <p className="text-slate-200 leading-relaxed">{entry.messageAr}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Warnings & Missing Models Alerts */}
      {result && result.warningsAr.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-4 space-y-1.5 text-sm text-amber-200">
          {result.warningsAr.map((w, idx) => (
            <div key={idx} className="flex items-start gap-2.5">
              <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0 mt-1" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Results & Picks Section */}
      {result && (
        <section className="space-y-5">
          {/* Scan Telemetry Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-xl border border-slate-800/90 bg-[#0D1526] p-4 tabular-nums">
            <div>
              <div className="text-xs text-slate-400">المباريات المفحوصة</div>
              <div className="mt-1 font-mono text-xl font-bold text-slate-100">{result.matchesScanned}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">الأسواق المحللة</div>
              <div className="mt-1 font-mono text-xl font-bold text-sky-300">{result.marketsAnalyzed}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">الاختيارات المؤهلة</div>
              <div className="mt-1 font-mono text-xl font-bold text-teal-300">{result.qualifiedCount}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">معيار الفلترة</div>
              <div className="mt-1 font-mono text-sm font-semibold text-slate-200">
                Odds {result.config.targetOdds.toFixed(2)} · Prob ≥ {result.config.targetProbability}%
              </div>
            </div>
          </div>

          {/* Empty Qualified Picks Message */}
          {result.emptyReasonAr && (
            <div className="rounded-2xl border border-slate-700 bg-[#0D1526] p-6 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-display text-base font-bold text-slate-100">
                  لا توجد اختيارات تستوفي الشروط الحالية
                </h3>
                <p className="mt-1 text-sm text-slate-300 leading-relaxed">{result.emptyReasonAr}</p>
              </div>
            </div>
          )}

          {/* Accumulators if COMBINED mode */}
          {result.accumulators.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-display text-lg font-bold text-slate-50">التجميعات المؤهلة (Combined Odds)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.accumulators.map((acc) => {
                  const accTier = getSafetyTier(acc.correlationAdjustedProbability, acc.riskLevel);
                  return (
                    <div key={acc.id} className={`rounded-2xl border-2 p-5 space-y-3 ${accTier.borderCls} ${accTier.bgCls}`}>
                      <div className="flex items-center justify-between">
                        <span className={`font-display font-bold ${accTier.textCls}`}>
                          تجميعة من {acc.legs.length} اختيارات ({accTier.labelAr})
                        </span>
                        <span className="font-mono text-lg font-bold text-slate-100 tabular-nums">
                          الأود المجمّع: {acc.combinedOdds.toFixed(2)}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs tabular-nums border-y border-slate-800 py-2.5">
                        <div>
                          <span className="text-slate-400 block">الاحتمال المصحح</span>
                          <span className={`font-mono font-extrabold ${accTier.textCls}`}>{acc.correlationAdjustedProbability}%</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">اتفاق النماذج</span>
                          <span className="font-mono font-bold text-sky-300">{acc.averageAgreement}%</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">أقل جودة بيانات</span>
                          <span className="font-mono font-bold text-slate-200">{acc.minDataQuality}%</span>
                        </div>
                      </div>
                      {acc.correlationWarningAr && (
                        <div className="text-xs text-[#FFE600]">{acc.correlationWarningAr}</div>
                      )}
                      <div className="space-y-2.5">
                        {acc.legs.map((leg) => {
                          const legMatch = matches.find((x) => x.id === leg.matchId);
                          const legOutcome = evaluateBetOutcome(legMatch, {
                            selectionAr: leg.selectionAr,
                            selectionCode: leg.selectionCode,
                            category: leg.category,
                          });
                          const legStyle = getOutcomeStyle(legOutcome);
                          const activeLegCls = legStyle || accTier;
                          return (
                            <div
                              key={leg.id}
                              className={`text-xs border-b border-slate-800/50 pb-2 last:border-b-0 space-y-1 rounded-lg px-2.5 py-1.5 ${
                                legStyle ? `${legStyle.bgCls} border ${legStyle.borderCls}` : ''
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <div className="font-semibold text-slate-200">
                                    {leg.homeTeamAr} × {leg.awayTeamAr}
                                    {legStyle && (
                                      <span className={`mr-2 font-bold ${legStyle.textCls}`}>· {legStyle.labelAr}</span>
                                    )}
                                  </div>
                                  <div className={`font-bold ${activeLegCls.textCls} ${legStyle?.strikeTitle ? 'line-through decoration-red-500/60' : ''}`}>
                                    {leg.marketNameAr}: {leg.selectionAr}
                                  </div>
                                </div>
                                <div className={`font-mono font-bold tabular-nums shrink-0 ${activeLegCls.textCls}`}>{leg.odds.toFixed(2)}</div>
                              </div>
                              <p className="text-[11px] text-slate-300 leading-relaxed">
                                <strong className="text-slate-100">شرح الرهان: </strong>
                                {buildBetExplanationAr({
                                  selectionAr: leg.selectionAr,
                                  selectionCode: leg.selectionCode,
                                  marketNameAr: leg.marketNameAr,
                                  category: leg.category,
                                  homeTeamAr: leg.homeTeamAr,
                                  awayTeamAr: leg.awayTeamAr,
                                  settlementRule: leg.settlementRule,
                                })}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Filter & Sort Controls for Individual Picks */}
          {picksSource.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0D1526] p-1">
                  {(
                    [
                      { id: 'QUALIFIED', label: 'المؤهلة' },
                      { id: 'NEEDS_REVIEW', label: 'تحتاج مراجعة' },
                      { id: 'DISQUALIFIED', label: 'غير مؤهلة' },
                      { id: 'ALL', label: 'الكل' },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setStatusFilter(st.id)}
                      className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer ${
                        statusFilter === st.id ? 'bg-teal-500/20 text-teal-300' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                <select
                  aria-label="تصفية حسب السوق"
                  value={marketFilter}
                  onChange={(e) => setMarketFilter(e.target.value)}
                  className="rounded-lg border border-slate-800 bg-[#0D1526] px-3 py-1.5 text-xs text-slate-200"
                >
                  <option value="ALL">جميع الأسواق</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameAr}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="تصفية حسب البطولة"
                  value={leagueFilter}
                  onChange={(e) => setLeagueFilter(e.target.value)}
                  className="rounded-lg border border-slate-800 bg-[#0D1526] px-3 py-1.5 text-xs text-slate-200"
                >
                  <option value="ALL">جميع البطولات</option>
                  {leagues.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">ترتيب حسب:</span>
                <select
                  aria-label="ترتيب الترشيحات"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="rounded-lg border border-slate-800 bg-[#0D1526] px-3 py-1.5 text-xs text-slate-200"
                >
                  <option value="PROB">جودة الأدلة والاحتمال المقدر</option>
                  <option value="QUALITY">جودة البيانات</option>
                  <option value="ODDS">الأود</option>
                </select>
              </div>
            </div>
          )}

          {/* Safety Color Legend */}
          {picksSource.length > 0 && (
            <div className="flex flex-wrap items-center gap-5 rounded-xl border border-slate-800/80 bg-[#0D1526] px-4 py-2.5 text-xs">
              <span className="inline-flex items-center gap-1.5 font-bold text-[#22FF66]">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#22FF66]" />
                آمن جدًا (75% فأعلى)
              </span>
              <span className="inline-flex items-center gap-1.5 font-bold text-[#FFE600]">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#FFE600]" />
                شبه آمن (55% – 74.9%)
              </span>
              <span className="inline-flex items-center gap-1.5 font-bold text-[#FF4D4D]">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#FF3B30]" />
                غير آمن (أقل من 55%)
              </span>
            </div>
          )}

          {/* Pick Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredPicks.map((pick) => {
              const st = statusLabel(pick.status);
              const rk = riskLabel(pick.riskLevel);
              const tier = getSafetyTier(pick.estimatedProbability, pick.riskLevel, pick.status);
              const pickMatch = matches.find((x) => x.id === pick.matchId);
              const pickOutcome = evaluateBetOutcome(pickMatch, {
                selectionAr: pick.selectionAr,
                selectionCode: pick.selectionCode,
                category: pick.category,
              });
              const outStyle = getOutcomeStyle(pickOutcome);
              const visual = outStyle || tier;
              return (
                <article
                  key={pick.id}
                  className={`rounded-2xl border-2 p-5 flex flex-col justify-between space-y-4 ${visual.borderCls} ${visual.bgCls}`}
                >
                  <div>
                    {/* Quiet 1-line metadata kicker (zero pills) */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 tabular-nums">
                      <div>
                        <span>{pick.leagueNameAr}</span>
                        <span aria-hidden="true"> · </span>
                        <span>
                          {pickMatch?.status === 'FT'
                            ? `انتهت (FT) · ${pickMatch.scoreHome ?? 0}-${pickMatch.scoreAway ?? 0}`
                            : pick.mode === 'LIVE'
                            ? `مباشر ${pick.liveMinute ?? 0}' (${pick.liveScore})`
                            : new Date(pick.kickoffTime).toLocaleString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-bold">
                        <span className={`inline-flex items-center gap-1 ${visual.textCls}`}>
                          <span className={`inline-block h-2 w-2 rounded-sm ${visual.dotCls}`} />
                          {visual.labelAr}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className={st.cls}>{st.text}</span>
                      </div>
                    </div>

                    {/* Teams & Selection */}
                    <div className="mt-2 flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-display text-lg font-bold text-slate-50">
                          {pick.homeTeamAr} × {pick.awayTeamAr}
                        </h3>
                        <div className={`mt-1 text-sm font-extrabold ${visual.textCls} ${outStyle?.strikeTitle ? 'line-through decoration-red-500/60' : ''}`}>
                          {pick.marketNameAr}: {pick.selectionAr}
                        </div>
                      </div>
                      <div className="text-left shrink-0">
                        <div className="text-[11px] text-slate-400">الأود الحالي</div>
                        <div className="font-mono text-2xl font-extrabold text-slate-50 tabular-nums">
                          {pick.odds.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Separated Three Key Indicators */}
                    <div className="mt-4 grid grid-cols-4 gap-3 border-y border-slate-800/80 py-3 text-xs tabular-nums">
                      <div>
                        <div className="text-slate-400">الاحتمال المقدر</div>
                        <div className={`mt-0.5 font-mono text-base font-extrabold ${visual.textCls}`}>
                          {pick.estimatedProbability}%
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400">اتفاق النماذج</div>
                        <div className="mt-0.5 font-mono text-base font-bold text-sky-300">{pick.modelAgreement}%</div>
                      </div>
                      <div>
                        <div className="text-slate-400">جودة البيانات</div>
                        <div className="mt-0.5 font-mono text-base font-bold text-slate-100">{pick.dataQuality}%</div>
                      </div>
                      <div>
                        <div className="text-slate-400">مستوى المخاطرة</div>
                        <div className={`mt-0.5 font-semibold ${rk.cls}`}>{rk.text}</div>
                      </div>
                    </div>

                    {/* Concise Detailed Bet Explanation + Reasons & Objections */}
                    <div className="mt-3 space-y-2 text-xs">
                      <div className="rounded-lg border border-slate-800/80 bg-[#070B14]/70 p-2.5 leading-relaxed">
                        <span className="font-bold text-slate-100">شرح الرهان وشروط الربح: </span>
                        <span className="text-slate-300">
                          {buildBetExplanationAr({
                            selectionAr: pick.selectionAr,
                            selectionCode: pick.selectionCode,
                            marketNameAr: pick.marketNameAr,
                            category: pick.category,
                            homeTeamAr: pick.homeTeamAr,
                            awayTeamAr: pick.awayTeamAr,
                            settlementRule: pick.settlementRule,
                          })}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-200">أسباب الاختيار: </span>
                        <span className="text-slate-300">{pick.reasonsAr.slice(0, 2).join(' · ') || pick.qualificationReasonAr}</span>
                      </div>
                      {pick.objectionsAr.length > 0 && (
                        <div>
                          <span className="font-semibold text-[#FFE600]">أهم الاعتراضات والمخاطر: </span>
                          <span className="text-slate-300">{pick.objectionsAr.slice(0, 2).join(' · ')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="pt-3 border-t border-slate-800/70 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-slate-500 font-mono tabular-nums">
                      تحديث: {new Date(pick.lastUpdatedAt).toLocaleTimeString('ar-EG')}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSave(pick)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#070B14] px-3 py-1.5 font-medium text-slate-200 hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                      >
                        <BookmarkCheck className="h-3.5 w-3.5 text-teal-400" />
                        <span>{saveFeedback[pick.id] || 'حفظ في السجل'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDetailPick(pick)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500/15 px-3 py-1.5 font-medium text-sky-300 hover:bg-sky-500/25 cursor-pointer whitespace-nowrap"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>التفاصيل الكاملة</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Pick Detail Modal */}
      {detailPick && (() => {
        const detailTier = getSafetyTier(detailPick.estimatedProbability, detailPick.riskLevel, detailPick.status);
        return (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="تفاصيل الترشيح الكاملة"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <div className={`max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border-2 bg-[#0B1220] p-6 space-y-5 ${detailTier.borderCls}`}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>{detailPick.leagueNameAr}</span>
                  <span aria-hidden="true">·</span>
                  <span className={`font-bold ${detailTier.textCls}`}>{detailTier.labelAr}</span>
                </div>
                <h3 className="font-display text-xl font-extrabold text-slate-50">
                  {detailPick.homeTeamAr} × {detailPick.awayTeamAr}
                </h3>
                <div className={`mt-1 text-sm font-bold ${detailTier.textCls}`}>
                  {detailPick.marketNameAr}: {detailPick.selectionAr} (أود {detailPick.odds.toFixed(2)})
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailPick(null)}
                aria-label="إغلاق التفاصيل"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs tabular-nums">
              <div className={`rounded-lg border p-3 ${detailTier.borderCls} ${detailTier.bgCls}`}>
                <span className="text-slate-300 block">الاحتمال المعاير النهائي</span>
                <span className={`font-mono text-lg font-extrabold ${detailTier.textCls}`}>
                  {detailPick.estimatedProbability}%
                </span>
              </div>
              <div className="rounded-lg bg-[#070B14] p-3">
                <span className="text-slate-400 block">خط الأساس الإحصائي</span>
                <span className="font-mono text-lg font-bold text-sky-300">{detailPick.statisticalBaselineProb}%</span>
              </div>
              <div className="rounded-lg bg-[#070B14] p-3">
                <span className="text-slate-400 block">احتمال السوق العادل</span>
                <span className="font-mono text-lg font-bold text-slate-200">{detailPick.bookmakerFairProb}%</span>
              </div>
              <div className="rounded-lg bg-[#070B14] p-3">
                <span className="text-slate-400 block">اتفاق النماذج الثلاثة</span>
                <span className="font-mono text-lg font-bold text-slate-200">{detailPick.modelAgreement}%</span>
              </div>
            </div>

            <div className="text-xs text-slate-300 bg-[#070B14] rounded-lg p-3.5 border border-slate-800">
              <strong className="text-slate-100">قاعدة التسوية المعتمدة: </strong>
              {SETTLEMENT_RULE_LABELS[detailPick.settlementRule]}
            </div>

            <div>
              <h4 className="font-display text-sm font-bold text-slate-100 mb-3">مقارنة تقييم النماذج الثلاثة</h4>
              <div className="space-y-3">
                {detailPick.modelOpinions.map((op) => (
                  <div key={op.slotId} className="rounded-xl border border-slate-800 bg-[#070B14] p-4 text-xs space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-slate-100">
                        {op.modelDisplayName} <span className="font-mono text-slate-400">({op.providerLabel})</span>
                      </span>
                      <span className="font-mono font-bold text-teal-300 tabular-nums">
                        {op.estimatedProbability}% · {op.stance}
                      </span>
                    </div>
                    <p className="text-slate-300 leading-relaxed">{op.reasoningAr}</p>
                    {op.identifiedRisks.length > 0 && (
                      <div className="text-amber-300">المخاطر المرصودة: {op.identifiedRisks.join(' · ')}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => handleSave(detailPick)}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-teal-400 cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{saveFeedback[detailPick.id] || 'حفظ في السجل الثابت'}</span>
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
};
