import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { applicationState } from '../db/schema.ts';
import type { RequestHandler } from 'express';
import type {
  AIModelConfig,
  AnalyzedPick,
  FootballConnectorConfig,
  MarketCategoryId,
  MatchData,
  ModelSlotId,
  PerformanceMetrics,
  PredictionRecord,
  SettlementOutcome,
  SystemSettings,
  WarRoomResult,
} from '../shared/types.ts';
import { evaluateBetOutcome } from '../shared/settlementEvaluator.ts';
import { createInitialDemoMatches } from './demoMatches.ts';
import { MARKET_CATEGORIES } from './markets.ts';

interface PersistedStore {
  settings: {
    dataSourceMode: 'REAL_API' | 'DEMO_STUDIO';
    maxDebateRounds: number;
    cacheTtlSeconds: number;
    connectorKeys: Record<string, string>;
    connectorUsage: Record<string, { used: number; lastSyncAt: string | null; status: FootballConnectorConfig['status']; lastError?: string }>;
    aiModels: Omit<AIModelConfig, 'status' | 'hasCustomKey' | 'maskedCustomKey'>[];
    aiCustomKeys: Record<string, string>;
  };
  predictions: PredictionRecord[];
  recentSessions: WarRoomResult[];
  analysisCache: Record<string, { cachedAt: number; result: WarRoomResult }>;
}

function maskSecret(val?: string): string {
  if (!val || val.trim().length === 0) return '';
  const clean = val.trim();
  if (clean.length <= 6) return '••••••';
  return `${clean.slice(0, 3)}••••${clean.slice(-4)}`;
}

function defaultPersistedStore(): PersistedStore {
  const envAfKey = process.env.RASD_API_FOOTBALL_KEY?.trim() || '';
  const envDeepSeekKey = process.env.RASD_DEEPSEEK_KEY?.trim() || '';
  const connectorKeys: Record<string, string> = {};
  if (envAfKey) connectorKeys['api_football'] = envAfKey;

  const aiCustomKeys: Record<string, string> = {};
  if (envDeepSeekKey) {
    aiCustomKeys['analyst_alpha'] = envDeepSeekKey;
    aiCustomKeys['analyst_beta'] = envDeepSeekKey;
    aiCustomKeys['analyst_gamma'] = envDeepSeekKey;
  }

  return {
    settings: {
      dataSourceMode: 'REAL_API',
      maxDebateRounds: 4,
      cacheTtlSeconds: 90,
      connectorKeys,
      connectorUsage: {
        api_football: { used: 0, lastSyncAt: null, status: envAfKey ? 'CONNECTED' : 'NOT_CONFIGURED' },
        football_data: { used: 0, lastSyncAt: null, status: 'NOT_CONFIGURED' },
        the_odds_api: { used: 0, lastSyncAt: null, status: 'NOT_CONFIGURED' },
        espn_public: { used: 0, lastSyncAt: null, status: 'CONNECTED' },
      },
      aiModels: [
        {
          slotId: 'analyst_alpha',
          displayNameAr: 'المحور التكتيكي — ألفا',
          roleTitleAr: 'تحليل النسق الميداني والتشكيلات',
          provider: 'GEMINI',
          modelName: 'gemini-4-hydrogen',
          enabled: true,
        },
        {
          slotId: 'analyst_beta',
          displayNameAr: 'المحور الكمي — بيتا',
          roleTitleAr: 'تحليل النماذج الإحصائية والخطوط',
          provider: 'GEMINI',
          modelName: 'gemini-3.1-flash-lite',
          enabled: true,
        },
        {
          slotId: 'analyst_gamma',
          displayNameAr: 'مدقق المخاطر — غاما',
          roleTitleAr: 'مراجعة السيولة والتناقضات والتسوية',
          provider: 'GEMINI',
          modelName: 'gemini-4-hydrogen',
          enabled: true,
        },
      ],
      aiCustomKeys,
    },
    predictions: [],
    recentSessions: [],
    analysisCache: {},
  };
}

// Each request gets a transaction-backed snapshot. The row lock prevents lost
// updates when refreshes, settings edits and analyses overlap.
const requestState = new AsyncLocalStorage<{ store: PersistedStore; demoMatches: MatchData[] }>();
function state() {
  const current = requestState.getStore();
  if (!current) throw new Error('Store accessed outside a database request');
  return current;
}

export const withPersistentStore: RequestHandler = async (_req, res, next) => {
  const originalEnd = res.end.bind(res);
  let endArgs: any[] | undefined;
  try {
    await db.transaction(async (tx) => {
      await tx.insert(applicationState).values({ id: 'main', payload: defaultPersistedStore() }).onConflictDoNothing();
      const [row] = await tx.select().from(applicationState).where(eq(applicationState.id, 'main')).for('update');
      const defaults = defaultPersistedStore();
      const stored = row.payload as unknown as PersistedStore;
      const snapshot = {
        store: { ...defaults, ...stored, settings: { ...defaults.settings, ...stored.settings } },
        demoMatches: row.demoMatches as MatchData[] | null ?? createInitialDemoMatches(),
      };
      await requestState.run(snapshot, async () => {
        await new Promise<void>((resolve, reject) => {
          res.end = ((...args: any[]) => {
            endArgs = args;
            resolve();
            return res;
          }) as typeof res.end;
          res.once('close', () => { if (!endArgs) reject(new Error('Request closed')); });
          next();
        });
        await tx.update(applicationState).set({ payload: snapshot.store, demoMatches: snapshot.demoMatches }).where(eq(applicationState.id, 'main'));
      });
    });
    originalEnd(...(endArgs || []));
  } catch {
    res.end = originalEnd;
    if (!res.headersSent) res.status(503).json({ error: 'تعذر حفظ البيانات، يرجى المحاولة مجددًا' });
    else originalEnd();
  }
};

// Mutations are committed together before the response completes.
export function saveStore(): void {}

export function getDemoMatches(): MatchData[] {
  return state().demoMatches;
}

export function resetDemoMatches(): MatchData[] {
  state().demoMatches = createInitialDemoMatches();
  return state().demoMatches;
}

export function mutateDemoMatch(
  matchId: string,
  action: 'SIMULATE_HOME_GOAL' | 'SIMULATE_RED_CARD' | 'SIMULATE_LINEUP_INJURY' | 'SIMULATE_STALE_FEED' | 'SIMULATE_API_OUTAGE' | 'RESTORE_FEED' | 'SIMULATE_FINISH_MATCH'
): MatchData | null {
  const m = state().demoMatches.find((x) => x.id === matchId);
  if (!m) return null;

  const nowIso = new Date().toISOString();

  if (action === 'SIMULATE_FINISH_MATCH') {
    m.mode = 'LIVE';
    m.status = 'FT';
    m.minute = 90;
    if (m.scoreHome === null) m.scoreHome = 1;
    if (m.scoreAway === null) m.scoreAway = 0;
    if (m.htScoreHome === null) m.htScoreHome = m.scoreHome;
    if (m.htScoreAway === null) m.htScoreAway = m.scoreAway;
    m.feedUpdatedAt = nowIso;
  } else if (action === 'SIMULATE_HOME_GOAL' && m.mode === 'LIVE') {
    m.scoreHome = (m.scoreHome ?? 0) + 1;
    m.minute = Math.min(90, (m.minute ?? 60) + 2);
    m.feedUpdatedAt = nowIso;
    m.liveEvents = [
      ...(m.liveEvents || []),
      { minute: m.minute, type: 'GOAL', team: 'HOME', player: m.homeTeam.expectedLineup[9] || 'المهاجم', detail: 'هدف محاكاة مباشر لاختبار إعادة التقييم' },
    ];
    // Adjust 1X2 / Over odds realistically
    for (const opt of m.availableMarkets) {
      if (opt.selectionCode === '1') opt.odds = Math.max(1.05, Number((opt.odds * 0.68).toFixed(2)));
      if (opt.selectionCode === '1X') opt.odds = Math.max(1.03, Number((opt.odds * 0.82).toFixed(2)));
      opt.updatedAt = nowIso;
    }
  } else if (action === 'SIMULATE_RED_CARD' && m.mode === 'LIVE') {
    m.minute = Math.min(90, (m.minute ?? 60) + 1);
    if (m.liveStats) {
      m.liveStats.redCardsAway += 1;
    }
    m.feedUpdatedAt = nowIso;
    m.liveEvents = [
      ...(m.liveEvents || []),
      { minute: m.minute, type: 'RED_CARD', team: 'AWAY', player: m.awayTeam.expectedLineup[3] || 'المدافع', detail: 'طرد مباشر — إعادة تقييم فورية للترشيحات' },
    ];
  } else if (action === 'SIMULATE_LINEUP_INJURY' && m.mode === 'PREMATCH') {
    m.lineupConfirmed = true;
    m.homeTeam.injuries = [
      ...m.homeTeam.injuries,
      { player: m.homeTeam.expectedLineup[10] || 'المهاجم الأساسي', reason: 'إصابة في الإحماء قبل المباراة', impact: 'HIGH' },
    ];
    m.feedUpdatedAt = nowIso;
  } else if (action === 'SIMULATE_STALE_FEED') {
    m.feedStale = true;
    m.feedUpdatedAt = new Date(Date.now() - 240 * 1000).toISOString();
  } else if (action === 'SIMULATE_API_OUTAGE') {
    m.feedOutage = true;
    m.outageReason = 'توقف مزود البيانات المباشرة مؤقتًا (503 Service Unavailable)';
  } else if (action === 'RESTORE_FEED') {
    m.feedStale = false;
    m.feedOutage = false;
    m.outageReason = undefined;
    m.feedUpdatedAt = nowIso;
  }

  return m;
}

export function getPublicSettings(): SystemSettings {
  const geminiConfigured = true; // Netlify AI Gateway configures Gemini at runtime.
  const u = state().store.settings.connectorUsage;

  const connectors: FootballConnectorConfig[] = [
    {
      id: 'api_football',
      name: 'API-Football (v3)',
      descriptionAr: 'مباريات مباشرة ومجدولة، إحصائيات اللعب، التشكيلات الرسمية والإصابات',
      baseUrl: 'https://v3.football.api-sports.io',
      hasKey: Boolean(state().store.settings.connectorKeys['api_football']),
      maskedKey: maskSecret(state().store.settings.connectorKeys['api_football']),
      rateLimitDaily: 100,
      requestsUsedToday: u.api_football?.used ?? 0,
      lastSyncAt: u.api_football?.lastSyncAt ?? null,
      status: state().store.settings.connectorKeys['api_football'] ? (u.api_football?.status || 'CONNECTED') : 'NOT_CONFIGURED',
      lastError: u.api_football?.lastError,
    },
    {
      id: 'football_data',
      name: 'Football-Data.org (v4)',
      descriptionAr: 'جداول الدوريات الأوروبية الكبرى والنتائج والتشكيلات الأساسية',
      baseUrl: 'https://api.football-data.org/v4',
      hasKey: Boolean(state().store.settings.connectorKeys['football_data']),
      maskedKey: maskSecret(state().store.settings.connectorKeys['football_data']),
      rateLimitDaily: 1440,
      requestsUsedToday: u.football_data?.used ?? 0,
      lastSyncAt: u.football_data?.lastSyncAt ?? null,
      status: state().store.settings.connectorKeys['football_data'] ? (u.football_data?.status || 'CONNECTED') : 'NOT_CONFIGURED',
      lastError: u.football_data?.lastError,
    },
    {
      id: 'the_odds_api',
      name: 'The Odds API (v4)',
      descriptionAr: 'أسعار الأسواق الحقيقية (1X2، الإجمالي، الهاندكاب) من شركات المراهنات العالمية',
      baseUrl: 'https://api.the-odds-api.com/v4',
      hasKey: Boolean(state().store.settings.connectorKeys['the_odds_api']),
      maskedKey: maskSecret(state().store.settings.connectorKeys['the_odds_api']),
      rateLimitDaily: 500,
      requestsUsedToday: u.the_odds_api?.used ?? 0,
      lastSyncAt: u.the_odds_api?.lastSyncAt ?? null,
      status: state().store.settings.connectorKeys['the_odds_api'] ? (u.the_odds_api?.status || 'CONNECTED') : 'NOT_CONFIGURED',
      lastError: u.the_odds_api?.lastError,
    },
    {
      id: 'espn_public',
      name: 'تغذية كرة القدم العالمية (أندية ومنتخبات)',
      descriptionAr: 'تغطية مباشرة ومجدولة لجميع مباريات اليوم والغد للأندية والمنتخبات مع إحصاءات اللعب وأسعار Bet365 عند توفرها',
      baseUrl: 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard',
      hasKey: true,
      maskedKey: 'Public Live Feed',
      rateLimitDaily: 5000,
      requestsUsedToday: u.espn_public?.used ?? 0,
      lastSyncAt: u.espn_public?.lastSyncAt ?? null,
      status: u.espn_public?.status || 'CONNECTED',
      lastError: u.espn_public?.lastError,
    },
  ];

  const aiModels: AIModelConfig[] = state().store.settings.aiModels.map((m) => {
    const customKey = state().store.settings.aiCustomKeys[m.slotId];
    const isGemini = m.provider === 'GEMINI';
    const ready = isGemini ? geminiConfigured : Boolean(customKey && customKey.trim().length > 0);
    return {
      ...m,
      hasCustomKey: Boolean(customKey),
      maskedCustomKey: maskSecret(customKey),
      status: !m.enabled ? 'OFFLINE' : ready ? 'READY' : 'MISSING_KEY',
    };
  });

  return {
    dataSourceMode: state().store.settings.dataSourceMode,
    maxDebateRounds: state().store.settings.maxDebateRounds,
    cacheTtlSeconds: state().store.settings.cacheTtlSeconds,
    connectors,
    aiModels,
    geminiConfigured,
  };
}

export function getRawConnectorKeys(): Record<string, string> {
  return { ...state().store.settings.connectorKeys };
}

export function getRawAiCustomKeys(): Record<string, string> {
  return { ...state().store.settings.aiCustomKeys };
}

export function recordConnectorUsage(
  id: FootballConnectorConfig['id'],
  status: FootballConnectorConfig['status'],
  error?: string
): void {
  const prev = state().store.settings.connectorUsage[id] || { used: 0, lastSyncAt: null, status: 'NOT_CONFIGURED' };
  state().store.settings.connectorUsage[id] = {
    used: prev.used + 1,
    lastSyncAt: new Date().toISOString(),
    status,
    lastError: error,
  };
  saveStore();
}

export function updateSettings(payload: {
  dataSourceMode?: 'REAL_API' | 'DEMO_STUDIO';
  maxDebateRounds?: number;
  cacheTtlSeconds?: number;
  connectorKeyUpdates?: Record<string, string>;
  aiModelUpdates?: Array<{
    slotId: ModelSlotId;
    provider?: AIModelConfig['provider'];
    modelName?: string;
    endpointUrl?: string;
    enabled?: boolean;
    customKey?: string;
  }>;
}): SystemSettings {
  if (payload.dataSourceMode) {
    state().store.settings.dataSourceMode = payload.dataSourceMode;
  }
  if (typeof payload.maxDebateRounds === 'number') {
    state().store.settings.maxDebateRounds = Math.min(4, Math.max(1, Math.round(payload.maxDebateRounds)));
  }
  if (typeof payload.cacheTtlSeconds === 'number') {
    state().store.settings.cacheTtlSeconds = Math.min(600, Math.max(15, Math.round(payload.cacheTtlSeconds)));
  }
  if (payload.connectorKeyUpdates) {
    for (const [k, v] of Object.entries(payload.connectorKeyUpdates)) {
      if (v === '') {
        delete state().store.settings.connectorKeys[k];
        if (state().store.settings.connectorUsage[k]) {
          state().store.settings.connectorUsage[k].status = 'NOT_CONFIGURED';
          state().store.settings.connectorUsage[k].lastError = undefined;
        }
      } else if (v && !v.includes('••••')) {
        state().store.settings.connectorKeys[k] = v.trim();
        if (state().store.settings.connectorUsage[k]) {
          state().store.settings.connectorUsage[k].status = 'CONNECTED';
          state().store.settings.connectorUsage[k].lastError = undefined;
        }
      }
    }
  }
  if (payload.aiModelUpdates) {
    for (const upd of payload.aiModelUpdates) {
      const target = state().store.settings.aiModels.find((m) => m.slotId === upd.slotId);
      if (target) {
        if (upd.provider) target.provider = upd.provider;
        if (upd.modelName) target.modelName = upd.modelName.trim();
        if (upd.endpointUrl !== undefined) target.endpointUrl = upd.endpointUrl.trim();
        if (typeof upd.enabled === 'boolean') target.enabled = upd.enabled;
      }
      if (upd.customKey !== undefined) {
        if (upd.customKey === '') {
          delete state().store.settings.aiCustomKeys[upd.slotId];
        } else if (!upd.customKey.includes('••••')) {
          state().store.settings.aiCustomKeys[upd.slotId] = upd.customKey.trim();
        }
      }
    }
  }
  saveStore();
  return getPublicSettings();
}

export function getCachedAnalysis(cacheKey: string, ttlSeconds: number): WarRoomResult | null {
  const entry = state().store.analysisCache[cacheKey];
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > ttlSeconds * 1000) {
    delete state().store.analysisCache[cacheKey];
    return null;
  }
  return { ...entry.result, cachedHit: true };
}

export function setCachedAnalysis(cacheKey: string, result: WarRoomResult): void {
  state().store.analysisCache[cacheKey] = {
    cachedAt: Date.now(),
    result,
  };
  state().store.recentSessions = [result, ...state().store.recentSessions.slice(0, 9)];
  saveStore();
}

export function clearAnalysisCache(): void {
  state().store.analysisCache = {};
  saveStore();
}

export function getRecentSessions(): WarRoomResult[] {
  return state().store.recentSessions;
}

/**
 * Saves an immutable prediction snapshot to the ledger.
 * Prevents duplicate predictions for the same match + market selection + mode.
 */
export function savePredictionToLedger(pick: AnalyzedPick): { saved: boolean; duplicate: boolean; record: PredictionRecord } {
  const fingerprint = `${pick.matchId}::${pick.selectionCode}::${pick.mode}`;
  const existing = state().store.predictions.find((p) => p.fingerprint === fingerprint);
  if (existing) {
    return { saved: false, duplicate: true, record: existing };
  }

  const modelProbs: Record<ModelSlotId, number> = {
    analyst_alpha: pick.modelOpinions.find((o) => o.slotId === 'analyst_alpha')?.estimatedProbability ?? pick.estimatedProbability,
    analyst_beta: pick.modelOpinions.find((o) => o.slotId === 'analyst_beta')?.estimatedProbability ?? pick.estimatedProbability,
    analyst_gamma: pick.modelOpinions.find((o) => o.slotId === 'analyst_gamma')?.estimatedProbability ?? pick.estimatedProbability,
  };

  const createdAt = new Date().toISOString();
  const hashPayload = JSON.stringify({
    fingerprint,
    createdAt,
    odds: pick.odds,
    estimatedProbability: pick.estimatedProbability,
    modelProbs,
  });
  const immutableHash = crypto.createHash('sha256').update(hashPayload).digest('hex').slice(0, 16);

  const record: PredictionRecord = {
    id: `pred-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    fingerprint,
    createdAt,
    matchId: pick.matchId,
    leagueNameAr: pick.leagueNameAr,
    homeTeamAr: pick.homeTeamAr,
    awayTeamAr: pick.awayTeamAr,
    kickoffTime: pick.kickoffTime,
    mode: pick.mode,
    category: pick.category,
    marketNameAr: pick.marketNameAr,
    selectionAr: pick.selectionAr,
    odds: pick.odds,
    estimatedProbability: pick.estimatedProbability,
    modelAgreement: pick.modelAgreement,
    dataQuality: pick.dataQuality,
    riskLevel: pick.riskLevel,
    modelProbs,
    settlementOutcome: 'PENDING',
    isDemo: pick.isDemo,
    immutableHash,
  };

  state().store.predictions.unshift(record);
  saveStore();
  return { saved: true, duplicate: false, record };
}

export function settlePredictionRecord(id: string, outcome: SettlementOutcome, settledScore?: string): PredictionRecord | null {
  const rec = state().store.predictions.find((p) => p.id === id);
  if (!rec) return null;
  // Immutable original fields are preserved; only settlementOutcome / settledAt / settledScore are updated
  rec.settlementOutcome = outcome;
  rec.settledAt = new Date().toISOString();
  if (settledScore !== undefined) rec.settledScore = settledScore;
  saveStore();
  return rec;
}

export function getPredictions(includeDemo = true): PredictionRecord[] {
  return includeDemo ? state().store.predictions : state().store.predictions.filter((p) => !p.isDemo);
}

export function computePerformanceMetrics(includeDemo = true): PerformanceMetrics {
  const list = getPredictions(includeDemo);
  const settled = list.filter((p) => p.settlementOutcome !== 'PENDING' && p.settlementOutcome !== 'VOID' && p.settlementOutcome !== 'PUSH');

  let wonCount = 0;
  let halfWonCount = 0;
  let pushCount = 0;
  let halfLostCount = 0;
  let lostCount = 0;
  let voidCount = 0;
  let pendingCount = 0;
  let netUnits = 0;

  for (const p of list) {
    switch (p.settlementOutcome) {
      case 'WIN':
        wonCount++;
        netUnits += p.odds - 1;
        break;
      case 'HALF_WIN':
        halfWonCount++;
        netUnits += (p.odds - 1) / 2;
        break;
      case 'PUSH':
        pushCount++;
        break;
      case 'HALF_LOSS':
        halfLostCount++;
        netUnits -= 0.5;
        break;
      case 'LOSS':
        lostCount++;
        netUnits -= 1;
        break;
      case 'VOID':
        voidCount++;
        break;
      default:
        pendingCount++;
    }
  }

  const effectiveWins = wonCount + halfWonCount * 0.5;
  const decisiveCount = wonCount + halfWonCount + halfLostCount + lostCount;
  const actualWinRate = decisiveCount > 0 ? Math.round((effectiveWins / decisiveCount) * 1000) / 10 : 0;
  const roiPercent = decisiveCount > 0 ? Math.round((netUnits / decisiveCount) * 1000) / 10 : 0;

  // Brier Score & Log Loss on decisive binary outcomes (WIN/HALF_WIN -> 1 or 0.5, LOSS/HALF_LOSS -> 0 or 0.5)
  let brierSum = 0;
  let logLossSum = 0;
  const modelBrier: Record<ModelSlotId, number> = { analyst_alpha: 0, analyst_beta: 0, analyst_gamma: 0 };
  const modelCorrect: Record<ModelSlotId, number> = { analyst_alpha: 0, analyst_beta: 0, analyst_gamma: 0 };

  for (const p of settled) {
    const y = p.settlementOutcome === 'WIN' ? 1 : p.settlementOutcome === 'HALF_WIN' ? 0.75 : p.settlementOutcome === 'HALF_LOSS' ? 0.25 : 0;
    const prob = Math.min(0.995, Math.max(0.005, p.estimatedProbability / 100));
    brierSum += Math.pow(prob - y, 2);
    const yBin = y >= 0.5 ? 1 : 0;
    logLossSum += -(yBin * Math.log(prob) + (1 - yBin) * Math.log(1 - prob));

    (['analyst_alpha', 'analyst_beta', 'analyst_gamma'] as ModelSlotId[]).forEach((slot) => {
      const mp = Math.min(0.995, Math.max(0.005, (p.modelProbs?.[slot] ?? p.estimatedProbability) / 100));
      modelBrier[slot] += Math.pow(mp - y, 2);
      if ((mp >= 0.5 && y >= 0.5) || (mp < 0.5 && y < 0.5)) {
        modelCorrect[slot] += 1;
      }
    });
  }

  const n = settled.length;
  const brierScore = n > 0 ? Math.round((brierSum / n) * 10000) / 10000 : null;
  const logLoss = n > 0 ? Math.round((logLossSum / n) * 10000) / 10000 : null;

  const perModelStats = state().store.settings.aiModels.map((m) => ({
    slotId: m.slotId,
    displayNameAr: m.displayNameAr,
    brierScore: n > 0 ? Math.round((modelBrier[m.slotId] / n) * 10000) / 10000 : null,
    accuracyPercent: n > 0 ? Math.round((modelCorrect[m.slotId] / n) * 1000) / 10 : 0,
    predictionsEvaluated: n,
  }));

  // Breakdown by Category
  const catMap = new Map<MarketCategoryId, { total: number; won: number }>();
  const leagueMap = new Map<string, { total: number; won: number }>();

  for (const p of list) {
    if (p.settlementOutcome === 'PENDING' || p.settlementOutcome === 'VOID' || p.settlementOutcome === 'PUSH') continue;
    const isWin = p.settlementOutcome === 'WIN' || p.settlementOutcome === 'HALF_WIN';

    const cPrev = catMap.get(p.category) || { total: 0, won: 0 };
    cPrev.total += 1;
    if (isWin) cPrev.won += 1;
    catMap.set(p.category, cPrev);

    const lPrev = leagueMap.get(p.leagueNameAr) || { total: 0, won: 0 };
    lPrev.total += 1;
    if (isWin) lPrev.won += 1;
    leagueMap.set(p.leagueNameAr, lPrev);
  }

  const byCategory = Array.from(catMap.entries()).map(([category, v]) => ({
    category,
    nameAr: MARKET_CATEGORIES.find((m) => m.id === category)?.nameAr || category,
    total: v.total,
    won: v.won,
    winRate: Math.round((v.won / v.total) * 1000) / 10,
  }));

  const byLeague = Array.from(leagueMap.entries()).map(([leagueNameAr, v]) => ({
    leagueNameAr,
    total: v.total,
    won: v.won,
    winRate: Math.round((v.won / v.total) * 1000) / 10,
  }));

  return {
    totalPredictions: list.length,
    settledCount: decisiveCount,
    pendingCount,
    wonCount,
    halfWonCount,
    pushCount,
    halfLostCount,
    lostCount,
    voidCount,
    actualWinRate,
    roiPercent,
    brierScore,
    logLoss,
    collectiveAccuracy: actualWinRate,
    perModelStats,
    byCategory,
    byLeague,
  };
}

export function autoSettleLedgerFromMatches(matches: MatchData[]): number {
  let settledNow = 0;
  const matchMap = new Map(matches.filter((m) => m.status === 'FT').map((m) => [m.id, m]));
  if (matchMap.size === 0) return 0;

  for (const rec of state().store.predictions) {
    if (rec.settlementOutcome !== 'PENDING') continue;
    const finished = matchMap.get(rec.matchId);
    if (!finished) continue;
    const outcome = evaluateBetOutcome(finished, {
      selectionAr: rec.selectionAr,
      category: rec.category,
    });
    if (outcome !== 'PENDING') {
      rec.settlementOutcome = outcome;
      rec.settledAt = new Date().toISOString();
      rec.settledScore = `${finished.scoreHome ?? 0}-${finished.scoreAway ?? 0}`;
      settledNow++;
    }
  }

  if (settledNow > 0) {
    saveStore();
  }
  return settledNow;
}

