import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BookmarkCheck,
  Calendar,
  Cpu,
  Layers,
  MapPin,
  Play,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import type {
  AIModelConfig,
  AnalysisConfig,
  AnalyzedPick,
  DebateEntry,
  DebateStage,
  LiveDynamicSignal,
  MarketProjectionItem,
  MatchData,
  MatchEvent,
  ModelSlotId,
  WarRoomResult,
} from '../../shared/types';
import {
  build30MarketProjections,
  computeMarketBaseline,
  evaluateDataQuality,
  generateLiveDynamicSignals,
} from '../../server/statsEngine';
import { SETTLEMENT_RULE_LABELS } from '../../server/markets';
import { buildBetExplanationAr } from '../utils/betExplainer';
import { evaluateBetOutcome } from '../../shared/settlementEvaluator';
import { getOutcomeStyle, getSafetyTier, type SafetyTierId } from '../utils/safetyTheme';
import { TeamCrest } from './TeamCrest';
import type { ModelLiveState } from './WarRoomView';

interface MatchDetailPageProps {
  match: MatchData;
  projections30: MarketProjectionItem[];
  liveSignals: LiveDynamicSignal[];
  deepLoading: boolean;
  autoLiveSync: boolean;
  lastSyncAt: string | null;
  onToggleAutoLiveSync: () => void;
  onRefreshDeep: () => void;
  activeConfig: AnalysisConfig;
  models: AIModelConfig[];
  isRunning: boolean;
  currentStage: DebateStage | null;
  stageMessageAr: string;
  modelLiveStates: Record<ModelSlotId, ModelLiveState>;
  liveDebateFeed: DebateEntry[];
  warRoomResult: WarRoomResult | null;
  onBack: () => void;
  onRunMatchAI: (matchId: string) => void;
  onSavePick: (pick: AnalyzedPick) => Promise<{ saved: boolean; duplicate: boolean }>;
  onSimulateFinishMatch?: () => Promise<void>;
}

function useCountdown(targetIso: string, enabled: boolean): string {
  const [text, setText] = useState('-- : -- : --');
  useEffect(() => {
    if (!enabled) return;
    const update = () => {
      const diff = new Date(targetIso).getTime() - Date.now();
      if (diff <= 0) {
        setText('00 : 00 : 00');
        return;
      }
      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setText(
        `${String(hrs).padStart(2, '0')} : ${String(mins).padStart(2, '0')} : ${String(secs).padStart(2, '0')}`
      );
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [targetIso, enabled]);
  return text;
}

export const MatchDetailPage: React.FC<MatchDetailPageProps> = ({
  match,
  projections30,
  liveSignals,
  deepLoading,
  autoLiveSync,
  lastSyncAt,
  onToggleAutoLiveSync,
  onRefreshDeep,
  activeConfig,
  models,
  isRunning,
  stageMessageAr,
  modelLiveStates,
  liveDebateFeed,
  warRoomResult,
  onBack,
  onRunMatchAI,
  onSavePick,
  onSimulateFinishMatch,
}) => {
  const countdown = useCountdown(match.kickoffTime, match.mode === 'PREMATCH');
  const [saveStatus, setSaveStatus] = useState<Record<string, string>>({});
  const [finishingDemo, setFinishingDemo] = useState(false);
  const [matrixFilter, setMatrixFilter] = useState<
    'ALL' | 'LIVE_BOOKMAKER' | 'GOALS_RESULTS' | 'HANDICAPS' | 'CORNERS_CARDS_PLAYERS'
  >('ALL');
  const [safetyFilter, setSafetyFilter] = useState<'ALL' | SafetyTierId | 'WON' | 'LOST'>('ALL');

  const qualityReport = useMemo(() => evaluateDataQuality(match), [match]);
  const effectiveProjections30 = useMemo(
    () => (projections30.length > 0 ? projections30 : build30MarketProjections(match)),
    [projections30, match]
  );
  const effectiveLiveSignals = useMemo(
    () => (liveSignals.length > 0 ? liveSignals : generateLiveDynamicSignals(match)),
    [liveSignals, match]
  );
  const sortedLiveEvents = useMemo(
    () => [...(match.liveEvents || [])].sort((a, b) => b.minute - a.minute),
    [match.liveEvents]
  );

  const ftSummary = useMemo(() => {
    if (match.status !== 'FT') return { won: 0, lost: 0, pending: 0 };
    let won = 0;
    let lost = 0;
    let pending = 0;
    for (const item of effectiveProjections30) {
      const outcome = evaluateBetOutcome(match, {
        selectionAr: item.bestSelectionAr,
        catalogIndex: item.catalogIndex,
        category: item.category,
      });
      if (outcome === 'WIN' || outcome === 'HALF_WIN') won++;
      else if (outcome === 'LOSS' || outcome === 'HALF_LOSS') lost++;
      else pending++;
    }
    return { won, lost, pending };
  }, [match, effectiveProjections30]);

  const filteredProjections30 = useMemo(() => {
    return effectiveProjections30.filter((item) => {
      if (safetyFilter === 'WON' || safetyFilter === 'LOST') {
        const outcome = evaluateBetOutcome(match, {
          selectionAr: item.bestSelectionAr,
          catalogIndex: item.catalogIndex,
          category: item.category,
        });
        if (safetyFilter === 'WON' && outcome !== 'WIN' && outcome !== 'HALF_WIN') return false;
        if (safetyFilter === 'LOST' && outcome !== 'LOSS' && outcome !== 'HALF_LOSS') return false;
      } else if (safetyFilter !== 'ALL') {
        const tier = getSafetyTier(item.estimatedProbability);
        if (tier.id !== safetyFilter) return false;
      }
      if (matrixFilter === 'ALL') return true;
      if (matrixFilter === 'LIVE_BOOKMAKER') return item.sourceKind === 'LIVE_BOOKMAKER';
      if (matrixFilter === 'HANDICAPS') return item.category === 'handicap';
      if (matrixFilter === 'CORNERS_CARDS_PLAYERS') {
        return item.category === 'corners' || item.category === 'cards' || item.category === 'player_props';
      }
      return (
        item.category === 'match_result' ||
        item.category === 'total_goals' ||
        item.category === 'btts' ||
        item.category === 'half_markets' ||
        item.category === 'special_markets'
      );
    });
  }, [effectiveProjections30, matrixFilter, safetyFilter, match]);

  // Compute immediate quantitative ranking for ALL available markets (even those outside user criteria)
  const rankedMarkets = useMemo(() => {
    const minOdds = Math.max(1.01, activeConfig.targetOdds - activeConfig.oddsTolerance);
    const maxOdds = activeConfig.targetOdds + activeConfig.oddsTolerance;

    return match.availableMarkets
      .map((mkt) => {
        const baseline = computeMarketBaseline(match, mkt);
        const edge = Number((baseline.statisticalProb - baseline.bookmakerFairProb).toFixed(1));
        const meetsOdds = mkt.odds >= minOdds && mkt.odds <= maxOdds;
        const meetsProb = baseline.statisticalProb >= activeConfig.targetProbability;
        const meetsAll = meetsOdds && meetsProb;

        // Composite ranking score combining statistical safety + value edge
        const rankScore = baseline.statisticalProb * 0.72 + Math.max(-10, edge) * 1.4;

        return {
          market: mkt,
          baseline,
          edge,
          meetsOdds,
          meetsProb,
          meetsAll,
          rankScore,
        };
      })
      .sort((a, b) => b.rankScore - a.rankScore);
  }, [match, activeConfig]);

  // Match-level Poisson projection (even when no bookmaker odds exist in feed)
  const poissonSummary = useMemo(() => {
    const lh = ((match.homeTeam.avgGoalsScored + match.awayTeam.avgGoalsConceded) / 2) * 1.08;
    const la = ((match.awayTeam.avgGoalsScored + match.homeTeam.avgGoalsConceded) / 2) * 0.94;
    const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));
    const pmf = (lam: number, k: number) => (Math.pow(lam, k) * Math.exp(-lam)) / fact(k);

    let p1 = 0;
    let pX = 0;
    let p2 = 0;
    let pOv15 = 0;
    let pOv25 = 0;
    let pBtts = 0;
    for (let h = 0; h <= 6; h++) {
      for (let a = 0; a <= 6; a++) {
        const p = pmf(lh, h) * pmf(la, a);
        if (h > a) p1 += p;
        else if (h === a) pX += p;
        else p2 += p;
        if (h + a > 1.5) pOv15 += p;
        if (h + a > 2.5) pOv25 += p;
        if (h > 0 && a > 0) pBtts += p;
      }
    }
    return {
      xgHome: lh.toFixed(2),
      xgAway: la.toFixed(2),
      p1: (p1 * 100).toFixed(1),
      pX: (pX * 100).toFixed(1),
      p2: (p2 * 100).toFixed(1),
      pOv15: (pOv15 * 100).toFixed(1),
      pOv25: (pOv25 * 100).toFixed(1),
      pBtts: (pBtts * 100).toFixed(1),
    };
  }, [match]);

  // Filter AI picks specifically for this match
  const matchAiPicks = useMemo(() => {
    if (!warRoomResult) return [];
    return warRoomResult.picks
      .filter((p) => p.matchId === match.id)
      .sort((a, b) => b.estimatedProbability - a.estimatedProbability);
  }, [warRoomResult, match.id]);

  const matchDebates = useMemo(() => {
    const src = warRoomResult && !isRunning ? warRoomResult.debateLog : liveDebateFeed;
    return src.filter((d) => d.matchId === match.id);
  }, [warRoomResult, isRunning, liveDebateFeed, match.id]);

  const kickoffDateFormatted = new Intl.DateTimeFormat('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(match.kickoffTime));

  const kickoffTimeFormatted = new Intl.DateTimeFormat('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(match.kickoffTime));

  const handleSave = async (pick: AnalyzedPick) => {
    const res = await onSavePick(pick);
    setSaveStatus((prev) => ({
      ...prev,
      [pick.id]: res.duplicate ? 'محفوظ مسبقًا' : res.saved ? 'تم الحفظ' : 'خطأ',
    }));
  };

  return (
    <div className="space-y-7">
      {/* Top Breadcrumb / Back Action & Live Odds Auto-Sync */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#0D1526] px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer"
        >
          <ArrowRight className="h-4 w-4" />
          <span>العودة إلى قائمة المباريات</span>
        </button>

        <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-400 tabular-nums">
          <button
            type="button"
            onClick={onToggleAutoLiveSync}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer whitespace-nowrap ${
              autoLiveSync
                ? 'border-teal-500/40 bg-teal-500/10 text-teal-200'
                : 'border-slate-700 bg-[#0D1526] text-slate-300'
            }`}
          >
            {autoLiveSync
              ? `تحديث لحظي للأحداث والأود (${match.mode === 'LIVE' ? '10ث' : '15ث'}): مفعّل`
              : 'تحديث لحظي: متوقف'}
          </button>
          <button
            type="button"
            onClick={onRefreshDeep}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#0D1526] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${deepLoading ? 'animate-spin' : ''}`} />
            <span>تحديث الأسعار</span>
          </button>
          {onSimulateFinishMatch && (
            <button
              type="button"
              disabled={finishingDemo}
              onClick={async () => {
                setFinishingDemo(true);
                try {
                  await onSimulateFinishMatch();
                } finally {
                  setFinishingDemo(false);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#14B8A6]/60 bg-[#0B3B46]/60 px-3 py-1.5 text-xs font-bold text-[#5EEAD4] hover:bg-[#0B3B46] disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              <span>{finishingDemo ? 'جارٍ إنهاء المباراة...' : 'معاينة نهاية المباراة (FT)'}</span>
            </button>
          )}
          <span>{match.teamType === 'NATIONAL' ? 'منتخبات' : 'أندية'}</span>
          <span aria-hidden="true"> · </span>
          <span>جودة البيانات: {qualityReport.score}%</span>
          {lastSyncAt && (
            <>
              <span aria-hidden="true"> · </span>
              <span className="font-mono">
                {new Intl.DateTimeFormat('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(
                  new Date(lastSyncAt)
                )}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Broadcast Matchup Hero Card (Inspired by TV Matchday Desk) */}
      <section className="rounded-2xl border border-slate-800/90 bg-gradient-to-b from-[#0F172A] to-[#0A101E] p-6 sm:p-8">
        {/* League & Stage Header */}
        <div className="text-center border-b border-slate-800/70 pb-5">
          <div className="font-display text-lg font-extrabold text-slate-50">{match.leagueNameAr}</div>
          {match.roundName && <div className="mt-0.5 text-xs text-slate-400">{match.roundName}</div>}
        </div>

        {/* Crests + Center Clock/Score */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 items-center gap-6 text-center">
          {/* Home Team */}
          <div className="flex flex-col items-center space-y-3">
            <div className="font-display text-xl sm:text-2xl font-extrabold text-slate-50">
              {match.homeTeam.nameAr}
            </div>
            <div className="text-xs font-mono text-teal-300">
              {match.homeTeam.shortCode} · {match.homeTeam.last5Form.join(' ')}
            </div>
            <TeamCrest
              logoUrl={match.homeTeam.logoUrl}
              name={match.homeTeam.nameAr}
              shortCode={match.homeTeam.shortCode}
              size="lg"
            />
          </div>

          {/* Center Score or Countdown */}
          <div className="flex flex-col items-center justify-center space-y-2.5">
            {match.mode === 'LIVE' ? (
              <>
                <div
                  className={`font-mono text-4xl sm:text-5xl font-extrabold tabular-nums ${
                    match.status === 'FT' ? 'text-[#5EEAD4]' : 'text-teal-300'
                  }`}
                >
                  {match.scoreHome ?? 0} : {match.scoreAway ?? 0}
                </div>
                {match.status === 'FT' ? (
                  <div className="rounded-lg border border-[#14B8A6]/70 bg-[#0B3B46]/70 px-4 py-1 font-mono text-sm font-bold text-[#5EEAD4] tabular-nums">
                    انتهت المباراة · النتيجة النهائية (FT)
                  </div>
                ) : (
                  <div className="rounded-lg border border-teal-500/30 bg-teal-500/10 px-4 py-1 font-mono text-sm font-bold text-teal-300 tabular-nums">
                    مباشر · الدقيقة {match.minute ?? 0}&apos; ({match.status})
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="font-mono text-3xl sm:text-4xl font-extrabold text-slate-50 tabular-nums">
                  {kickoffTimeFormatted}
                </div>
                <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-1.5 font-mono text-sm font-semibold text-sky-300 tabular-nums" dir="ltr">
                  {countdown}
                </div>
              </>
            )}
          </div>

          {/* Away Team */}
          <div className="flex flex-col items-center space-y-3">
            <div className="font-display text-xl sm:text-2xl font-extrabold text-slate-50">
              {match.awayTeam.nameAr}
            </div>
            <div className="text-xs font-mono text-sky-300">
              {match.awayTeam.shortCode} · {match.awayTeam.last5Form.join(' ')}
            </div>
            <TeamCrest
              logoUrl={match.awayTeam.logoUrl}
              name={match.awayTeam.nameAr}
              shortCode={match.awayTeam.shortCode}
              size="lg"
            />
          </div>
        </div>

        {/* Venue & Date Footer */}
        <div className="mt-8 pt-5 border-t border-slate-800/70 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-300 tabular-nums">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-sky-400" />
            <span>{kickoffDateFormatted}</span>
          </div>
          {match.venue && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-teal-400" />
              <span>{match.venue}</span>
            </div>
          )}
        </div>
      </section>

      {/* Alerts if data quality issues / stale / outage */}
      {qualityReport.issues.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/25 p-4 text-xs text-amber-200 flex items-start gap-2.5">
          <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            {qualityReport.issues.map((iss, idx) => (
              <div key={idx}>{iss}</div>
            ))}
          </div>
        </div>
      )}

      {/* LIVE Dynamic Events & Newly Proposed Live Opportunities */}
      {match.mode === 'LIVE' && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Newly Proposed Live Opportunities as Time & Match Events Evolve */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-800/90 bg-[#0D1526] p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-[#22FF66]" />
                <h2 className="font-display text-base font-extrabold text-slate-50">
                  طرح أحداث وفرص جديدة لحظيًا مع تقدم الوقت وتغير اللعب
                </h2>
              </div>
              <span className="font-mono text-xs text-teal-300 tabular-nums">
                الدقيقة {match.minute ?? 0}&apos; · {effectiveLiveSignals.length} إشارات نشطة
              </span>
            </div>

            {effectiveLiveSignals.length === 0 ? (
              <p className="text-xs text-slate-400 py-4">
                يراقب النظام تطورات الملعب وتدفق السيولة لطرح إشارات جديدة تلقائيًا.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {effectiveLiveSignals.map((sig) => {
                  const tier = getSafetyTier(sig.estimatedProbability);
                  const outcome = evaluateBetOutcome(match, {
                    selectionAr: sig.suggestedMarketAr,
                  });
                  const outStyle = getOutcomeStyle(outcome);
                  const visual = outStyle || tier;
                  const triggerLabels: Record<LiveDynamicSignal['triggerType'], string> = {
                    ODDS_STEAM: 'تحرك أود مباشر',
                    RED_CARD_IMPACT: 'تأثير بطاقة حمراء',
                    GOAL_SHIFT: 'تغير بعد هدف',
                    TIME_DECAY: 'تقدم الزمن',
                    CORNER_SURGE: 'رتم الركنيات',
                    CARD_TENSION: 'إيقاع البطاقات',
                  };
                  return (
                    <div
                      key={sig.id}
                      className={`rounded-xl border-2 p-4 space-y-2.5 ${visual.borderCls} ${visual.bgCls}`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] tabular-nums">
                        <span className="font-mono font-bold text-slate-200">
                          د {sig.minute}&apos; · {triggerLabels[sig.triggerType]}
                        </span>
                        <span className={`inline-flex items-center gap-1 font-bold ${visual.textCls}`}>
                          <span className={`inline-block h-2 w-2 rounded-sm ${visual.dotCls}`} />
                          {visual.labelAr}
                        </span>
                      </div>
                      <div className="font-display text-sm font-extrabold text-slate-50">{sig.titleAr}</div>
                      <p className="text-xs text-slate-300 leading-relaxed">{sig.descriptionAr}</p>
                      <div className="pt-2 border-t border-slate-800/80 space-y-1 text-xs tabular-nums">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`font-bold ${visual.textCls} ${
                              outStyle?.strikeTitle ? 'line-through decoration-red-500/80' : ''
                            }`}
                          >
                            {sig.suggestedMarketAr}
                          </span>
                          <span className="font-mono font-extrabold text-slate-100">
                            {sig.estimatedProbability}% · {sig.referenceOdds.toFixed(2)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          <strong className="text-slate-200">شرح الخيار: </strong>
                          {buildBetExplanationAr({
                            selectionAr: sig.suggestedMarketAr,
                            homeTeamAr: match.homeTeam.nameAr,
                            awayTeamAr: match.awayTeam.nameAr,
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Live Match Events Timeline */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-800/90 bg-[#0D1526] p-6 space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-sky-400" />
                <h2 className="font-display text-base font-extrabold text-slate-50">
                  أحداث المباراة المباشرة لحظة بلحظة
                </h2>
              </div>
              <span className="font-mono text-xs text-slate-400 tabular-nums">{sortedLiveEvents.length} حدث</span>
            </div>

            {sortedLiveEvents.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                لا توجد أهداف أو بطاقات أو تبديلات مسجلة حتى الدقيقة الحالية ({match.minute ?? 0}&apos;).
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1">
                {sortedLiveEvents.map((ev: MatchEvent, idx: number) => {
                  const typeLabel: Record<MatchEvent['type'], string> = {
                    GOAL: 'هدف',
                    YELLOW_CARD: 'بطاقة صفراء',
                    RED_CARD: 'بطاقة حمراء',
                    SUBSTITUTION: 'تبديل',
                    VAR: 'مراجعة VAR',
                    INJURY: 'إصابة',
                  };
                  const evColor =
                    ev.type === 'GOAL'
                      ? 'text-[#22FF66] border-[#22C55E]/60 bg-[#22C55E]/10'
                      : ev.type === 'RED_CARD'
                      ? 'text-[#FF4D4D] border-[#EF4444]/60 bg-[#EF4444]/10'
                      : ev.type === 'YELLOW_CARD'
                      ? 'text-[#FFE600] border-[#FACC15]/60 bg-[#FACC15]/10'
                      : 'text-sky-300 border-slate-800 bg-[#070B14]';
                  const teamName = ev.team === 'HOME' ? match.homeTeam.nameAr : match.awayTeam.nameAr;

                  return (
                    <div
                      key={`${ev.minute}-${ev.type}-${ev.player}-${idx}`}
                      className={`rounded-xl border p-3 text-xs space-y-1 tabular-nums ${evColor}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold">
                          د {ev.minute}&apos; · {typeLabel[ev.type]} ({teamName})
                        </span>
                        {ev.isNew && (
                          <span className="font-mono text-[10px] font-extrabold text-[#22FF66]">حدث جديد ●</span>
                        )}
                      </div>
                      <div className="font-semibold text-slate-100">{ev.player}</div>
                      {ev.detail && <div className="text-[11px] text-slate-300">{ev.detail}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Action Bar: Run 3-Model AI Analysis for THIS Match */}
      <section className="rounded-2xl border border-teal-500/30 bg-[#0D1628] p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-teal-400" />
            <h2 className="font-display text-base font-bold text-slate-50">
              تحليل غرفة الذكاء الجماعي لهذه المباراة (3 نماذج متساوية)
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            يفحص كافة الأسواق المتاحة لهذه المباراة، ويعرض لك أفضل الرهانات والتحليلات مرتبةً حتى لو لم تستوفِ شروط الأود أو نسبة الأمان الحالية.
          </p>
        </div>

        <button
          type="button"
          disabled={isRunning || match.availableMarkets.length === 0}
          onClick={() => onRunMatchAI(match.id)}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
        >
          <Play className="h-4 w-4 fill-current" />
          <span>
            {isRunning
              ? 'جارٍ التحليل الجماعي...'
              : match.availableMarkets.length === 0
              ? 'لا توجد أسعار أسواق في المصدر'
              : 'تشغيل تحليل النماذج الثلاثة للمباراة'}
          </span>
        </button>
      </section>

      {/* Live 3-Model Progress when running or completed for this match */}
      {(isRunning || matchDebates.length > 0) && (
        <section className="rounded-2xl border border-slate-800/90 bg-[#0D1526] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-base font-bold text-slate-100">حالة النقاش الثلاثي للمباراة</h3>
            <span className="text-xs text-sky-300">{stageMessageAr}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {models.map((m) => {
              const st = modelLiveStates[m.slotId] || { status: 'IDLE', progress: 0 };
              return (
                <div key={m.slotId} className="rounded-xl border border-slate-800 bg-[#070B14] p-3.5 text-xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-slate-100">{m.displayNameAr}</span>
                    <span className="font-mono text-teal-300 tabular-nums">{st.progress}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-teal-400 transition-all" style={{ width: `${st.progress}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {matchDebates.length > 0 && (
            <div className="max-h-60 overflow-y-auto space-y-2 pt-2">
              {matchDebates.map((d) => (
                <div key={d.id} className="rounded-lg border border-slate-800/80 bg-[#070B14] p-3 text-xs">
                  <div className="font-semibold text-sky-300 mb-1">
                    {d.speakerNameAr} · {d.stage}
                  </div>
                  <p className="text-slate-200 leading-relaxed">{d.messageAr}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* AI War Room Results for THIS Match (ALL picks: Qualified AND Non-Qualified!) */}
      {matchAiPicks.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-slate-50">
              نتائج التحليل الجماعي لجميع رهانات المباراة ({matchAiPicks.length})
            </h2>
            <span className="text-xs text-slate-400">مرتبة من الأعلى احتمالاً وأدلةً — شامل الرهانات المستوفاة وغير المستوفاة</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {matchAiPicks.map((pick, idx) => {
              const tier = getSafetyTier(pick.estimatedProbability, pick.riskLevel, pick.status);
              const outcome = evaluateBetOutcome(match, {
                selectionAr: pick.selectionAr,
                selectionCode: pick.selectionCode,
                category: pick.category,
              });
              const outStyle = getOutcomeStyle(outcome);
              const visual = outStyle || tier;
              return (
                <div
                  key={pick.id}
                  className={`rounded-2xl border-2 p-5 space-y-3 ${visual.borderCls} ${visual.bgCls}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-slate-300 tabular-nums">
                        <span className={`inline-block h-2.5 w-2.5 rounded-sm ${visual.dotCls}`} />
                        <span>الترتيب #{idx + 1} · {pick.marketNameAr}</span>
                        <span className={`font-bold ${visual.textCls}`}>· {visual.labelAr}</span>
                      </div>
                      <h3
                        className={`mt-1 font-display text-base font-bold ${visual.textCls} ${
                          outStyle?.strikeTitle ? 'line-through decoration-red-500/80' : ''
                        }`}
                      >
                        {pick.selectionAr}
                      </h3>
                      <p className="mt-1.5 text-[11px] text-slate-300 leading-relaxed">
                        <strong className="text-slate-100">شرح الرهان: </strong>
                        {buildBetExplanationAr({
                          selectionAr: pick.selectionAr,
                          selectionCode: pick.selectionCode,
                          marketNameAr: pick.marketNameAr,
                          category: pick.category,
                          homeTeamAr: pick.homeTeamAr,
                          awayTeamAr: pick.awayTeamAr,
                          settlementRule: pick.settlementRule,
                        })}
                      </p>
                    </div>
                    <div className="text-left shrink-0">
                      <div className="font-mono text-xl font-extrabold text-slate-50 tabular-nums">
                        {pick.odds.toFixed(2)}
                      </div>
                      <div className={`text-[11px] font-bold ${visual.textCls}`}>
                        {outStyle
                          ? outStyle.labelAr
                          : pick.status === 'QUALIFIED'
                          ? 'مستوفي للشروط'
                          : pick.status === 'NEEDS_REVIEW'
                          ? 'خارج شرط الأمان/الأود (للعلم)'
                          : 'غير مؤهل'}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 border-y border-slate-800/80 py-2.5 text-xs tabular-nums">
                    <div>
                      <span className="text-slate-400 block">الاحتمال المعاير</span>
                      <span className={`font-mono font-extrabold ${tier.textCls}`}>
                        {pick.estimatedProbability}%
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">اتفاق النماذج</span>
                      <span className="font-mono font-bold text-sky-300">{pick.modelAgreement}%</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">جودة البيانات</span>
                      <span className="font-mono font-bold text-slate-100">{pick.dataQuality}%</span>
                    </div>
                  </div>

                  <div className="text-xs space-y-1.5">
                    <div className="text-slate-300">
                      <strong className="text-slate-100">التحليل والأدلة: </strong>
                      {pick.reasonsAr.join(' · ') || pick.qualificationReasonAr}
                    </div>
                    {pick.objectionsAr.length > 0 && (
                      <div className="text-amber-300">
                        <strong>اعتراضات ومخاطر: </strong>
                        {pick.objectionsAr.join(' · ')}
                      </div>
                    )}
                    <div className="text-slate-400">التسوية: {SETTLEMENT_RULE_LABELS[pick.settlementRule]}</div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleSave(pick)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#070B14] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer"
                    >
                      <BookmarkCheck className="h-3.5 w-3.5 text-teal-400" />
                      <span>{saveStatus[pick.id] || 'حفظ في السجل'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Best Ranked Available Bets & Statistical Match Analysis (Instant, ALWAYS shown!) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Ranked Available Markets Table */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-800/90 bg-[#0D1526] p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-teal-400" />
              <h2 className="font-display text-base font-bold text-slate-50">
                أفضل الرهانات المتاحة للمباراة (تحليل إحصائي فوري — شامل غير المستوفي للشروط)
              </h2>
            </div>
            <span className="text-xs text-slate-400 tabular-nums">{rankedMarkets.length} سوق متاح</span>
          </div>

          {rankedMarkets.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <p className="text-sm text-amber-300 font-medium">
                لم يوفّر مصدر البيانات الحالي أسعار مراهنات (Odds) لهذه المباراة بعد.
              </p>
              <p className="text-xs text-slate-400">
                يمكنك الاطلاع على التحليل الإحصائي وتوقعات بواسون الكاملة في اللوحة المجاورة دون اختلاق أسعار.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2 font-medium">#</th>
                    <th className="py-2 font-medium">السوق والاختيار</th>
                    <th className="py-2 font-medium">الأود</th>
                    <th className="py-2 font-medium">الاحتمال الإحصائي</th>
                    <th className="py-2 font-medium">الأفضلية (Edge)</th>
                    <th className="py-2 font-medium">المطابقة للمعايير</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 tabular-nums">
                  {rankedMarkets.map((row, idx) => {
                    const tier = getSafetyTier(row.baseline.statisticalProb);
                    const outcome = evaluateBetOutcome(match, {
                      selectionAr: row.market.selectionAr,
                      selectionCode: row.market.selectionCode,
                      category: row.market.category,
                      line: row.market.line,
                    });
                    const outStyle = getOutcomeStyle(outcome);
                    const visual = outStyle || tier;
                    return (
                      <tr key={row.market.id} className={`hover:bg-slate-800/25 ${visual.bgCls}`}>
                        <td className="py-3 pr-2 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-3 max-w-[340px]">
                          <div
                            className={`font-bold ${visual.textCls} ${
                              outStyle?.strikeTitle ? 'line-through decoration-red-500/80' : ''
                            }`}
                          >
                            {row.market.selectionAr}
                          </div>
                          <div className="text-slate-400">
                            {row.market.marketNameAr} · {row.market.bookmakerName}
                          </div>
                          <p className="mt-1 text-[11px] text-slate-300 leading-relaxed">
                            <strong className="text-slate-100">شرح الرهان: </strong>
                            {buildBetExplanationAr({
                              selectionAr: row.market.selectionAr,
                              selectionCode: row.market.selectionCode,
                              marketNameAr: row.market.marketNameAr,
                              marketNameEn: row.market.marketNameEn,
                              category: row.market.category,
                              line: row.market.line,
                              homeTeamAr: match.homeTeam.nameAr,
                              awayTeamAr: match.awayTeam.nameAr,
                              settlementRule: row.market.settlementRule,
                            })}{' '}
                            <span className="text-slate-400">({row.baseline.explanationAr})</span>
                          </p>
                        </td>
                        <td className="py-3 font-mono font-bold text-slate-100">
                          <div className="inline-flex items-center gap-1.5">
                            <span>{row.market.odds.toFixed(2)}</span>
                            {row.market.oddsDirection === 'UP' && (
                              <span className="text-[#22FF66] text-[11px]" title={`ارتفع من ${row.market.previousOdds?.toFixed(2)}`}>
                                ▲
                              </span>
                            )}
                            {row.market.oddsDirection === 'DOWN' && (
                              <span className="text-[#FF4D4D] text-[11px]" title={`انخفض من ${row.market.previousOdds?.toFixed(2)}`}>
                                ▼
                              </span>
                            )}
                          </div>
                          {row.market.previousOdds !== undefined &&
                            row.market.oddsDirection &&
                            row.market.oddsDirection !== 'SAME' && (
                              <div className="text-[10px] text-slate-500">
                                كان {row.market.previousOdds.toFixed(2)}
                              </div>
                            )}
                        </td>
                        <td className={`py-3 font-mono font-extrabold ${visual.textCls}`}>
                          {row.baseline.statisticalProb}%
                        </td>
                        <td
                          className={`py-3 font-mono font-semibold ${
                            row.edge > 0 ? 'text-[#22FF66]' : row.edge < -3 ? 'text-[#FFE600]' : 'text-slate-300'
                          }`}
                        >
                          {row.edge > 0 ? `+${row.edge}%` : `${row.edge}%`}
                        </td>
                        <td className="py-3 pl-2">
                          <div className={`inline-flex items-center gap-1.5 font-bold ${visual.textCls}`}>
                            <span className={`inline-block h-2 w-2 rounded-sm ${visual.dotCls}`} />
                            <span>{visual.labelAr}</span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {outStyle
                              ? `النتيجة النهائية: ${match.scoreHome ?? 0}-${match.scoreAway ?? 0}`
                              : row.meetsAll
                              ? 'مستوفي للشروط'
                              : `خارج المعيار (${!row.meetsOdds ? 'الأود' : 'الأمان'})`}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Full Statistical Projection & Tactical Profile */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-800/90 bg-[#0D1526] p-6 space-y-5">
          <h2 className="font-display text-base font-bold text-slate-50 border-b border-slate-800/80 pb-3">
            التحليل الإحصائي الكامل للمباراة (Poisson Model)
          </h2>

          <div className="grid grid-cols-2 gap-4 text-xs tabular-nums">
            <div className="rounded-xl bg-[#070B14] p-3.5">
              <div className="text-slate-400">الأهداف المتوقعة ({match.homeTeam.nameAr})</div>
              <div className="mt-1 font-mono text-xl font-bold text-teal-300">{poissonSummary.xgHome} xG</div>
            </div>
            <div className="rounded-xl bg-[#070B14] p-3.5">
              <div className="text-slate-400">الأهداف المتوقعة ({match.awayTeam.nameAr})</div>
              <div className="mt-1 font-mono text-xl font-bold text-sky-300">{poissonSummary.xgAway} xG</div>
            </div>
          </div>

          <div className="space-y-2.5 text-xs tabular-nums">
            <div className="flex items-center justify-between text-slate-300">
              <span>توزيع نتيجة المباراة (1 / X / 2)</span>
              <span className="font-mono text-slate-100">
                {poissonSummary.p1}% / {poissonSummary.pX}% / {poissonSummary.p2}%
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span>احتمال أكثر من 1.5 هدف</span>
              <span className="font-mono text-teal-300">{poissonSummary.pOv15}%</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span>احتمال أكثر من 2.5 هدف</span>
              <span className="font-mono text-sky-300">{poissonSummary.pOv25}%</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span>احتمال تسجيل الفريقين (BTTS)</span>
              <span className="font-mono text-slate-100">{poissonSummary.pBtts}%</span>
            </div>
          </div>

          {/* Live Stats OR Lineups */}
          {match.mode === 'LIVE' && match.liveStats ? (
            <div className="pt-4 border-t border-slate-800/80 space-y-2.5 text-xs tabular-nums">
              <div className="font-bold text-slate-200">الإحصائيات الحية المتجددة</div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-lg bg-[#070B14] p-2.5 flex justify-between">
                  <span className="text-slate-400">الاستحواذ</span>
                  <span className="font-mono text-slate-100">{match.liveStats.possessionHome}% - {match.liveStats.possessionAway}%</span>
                </div>
                <div className="rounded-lg bg-[#070B14] p-2.5 flex justify-between">
                  <span className="text-slate-400">الركنيات</span>
                  <span className="font-mono text-teal-300">{match.liveStats.cornersHome} - {match.liveStats.cornersAway}</span>
                </div>
                <div className="rounded-lg bg-[#070B14] p-2.5 flex justify-between">
                  <span className="text-slate-400">التسديدات</span>
                  <span className="font-mono text-slate-100">{match.liveStats.shotsHome} - {match.liveStats.shotsAway}</span>
                </div>
                <div className="rounded-lg bg-[#070B14] p-2.5 flex justify-between">
                  <span className="text-slate-400">على المرمى</span>
                  <span className="font-mono text-sky-300">{match.liveStats.shotsOnTargetHome} - {match.liveStats.shotsOnTargetAway}</span>
                </div>
                <div className="rounded-lg bg-[#070B14] p-2.5 flex justify-between">
                  <span className="text-slate-400">البطاقات الصفراء</span>
                  <span className="font-mono text-[#FFE600]">{match.liveStats.yellowCardsHome} - {match.liveStats.yellowCardsAway}</span>
                </div>
                <div className="rounded-lg bg-[#070B14] p-2.5 flex justify-between">
                  <span className="text-slate-400">البطاقات الحمراء</span>
                  <span className="font-mono text-[#FF4D4D]">{match.liveStats.redCardsHome} - {match.liveStats.redCardsAway}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="pt-4 border-t border-slate-800/80 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-slate-200">
                <Users className="h-4 w-4 text-sky-400" />
                <span>التشكيلات والغيابات</span>
              </div>
              <p className="text-slate-400">
                {match.homeTeam.nameAr}: {(match.homeTeam.confirmedLineup || match.homeTeam.expectedLineup).join('، ') || 'تُعلن قبل المباراة بساعة'}
              </p>
              <p className="text-slate-400">
                {match.awayTeam.nameAr}: {(match.awayTeam.confirmedLineup || match.awayTeam.expectedLineup).join('، ') || 'تُعلن قبل المباراة بساعة'}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Comprehensive 30-Market 1xBet Opportunities Matrix */}
      <section className="rounded-2xl border border-slate-800/90 bg-[#0D1526] p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-sky-400" />
              <h2 className="font-display text-lg font-extrabold text-slate-50">
                فرص الرهان المتكاملة للمباراة (30 سوقًا عالميًا — مرتبة بالأعلى أمانًا)
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              يجمع بين أسعار البوكيميكر المباشرة المحدثة تلقائيًا وبين الأسعار الإحصائية المرجعية (Fair Odds) دون اختلاق أي أسعار وهمية.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 font-mono text-xs tabular-nums">
            {match.status === 'FT' && (
              <span className="rounded-md border border-[#14B8A6]/60 bg-[#0B3B46]/60 px-2.5 py-1 text-[#5EEAD4]">
                فائز: {ftSummary.won} · خاسر: {ftSummary.lost}
              </span>
            )}
            <span className="text-teal-300">
              {filteredProjections30.length} / {effectiveProjections30.length} سوق
            </span>
          </div>
        </div>

        {/* Safety Color Legend & Tier Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-[#070B14] px-4 py-3 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            {match.status === 'FT' ? (
              <>
                <span className="inline-flex items-center gap-1.5 font-bold text-[#5EEAD4]">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#14B8A6]" />
                  فائز بعد نهاية المباراة (أزرق مخضر)
                </span>
                <span className="inline-flex items-center gap-1.5 font-bold text-red-400">
                  <span className="inline-block h-3 w-4 rounded-sm bet-lost-stripes border border-zinc-600" />
                  خاسر (أسود بخطوط طولية)
                </span>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(match.status === 'FT'
              ? ([
                  ['ALL', 'الكل'],
                  ['WON', `الفائزة (${ftSummary.won})`],
                  ['LOST', `الخاسرة (${ftSummary.lost})`],
                  ['VERY_SAFE', 'آمن جدًا'],
                  ['SEMI_SAFE', 'شبه آمن'],
                  ['UNSAFE', 'غير آمن'],
                ] as const)
              : ([
                  ['ALL', 'جميع المستويات'],
                  ['VERY_SAFE', 'آمن جدًا'],
                  ['SEMI_SAFE', 'شبه آمن'],
                  ['UNSAFE', 'غير آمن'],
                ] as const)
            ).map(([k, lbl]) => (
              <button
                key={k}
                type="button"
                onClick={() => setSafetyFilter(k)}
                className={`rounded-md border px-2.5 py-1 text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                  safetyFilter === k
                    ? k === 'WON'
                      ? 'border-[#14B8A6] bg-[#0B3B46] text-[#5EEAD4]'
                      : k === 'LOST'
                      ? 'border-zinc-600 bet-lost-stripes text-red-400'
                      : k === 'VERY_SAFE'
                      ? 'border-[#22C55E] bg-[#22C55E]/20 text-[#22FF66]'
                      : k === 'SEMI_SAFE'
                      ? 'border-[#FACC15] bg-[#FACC15]/20 text-[#FFE600]'
                      : k === 'UNSAFE'
                      ? 'border-[#EF4444] bg-[#EF4444]/20 text-[#FF4D4D]'
                      : 'border-sky-400/60 bg-sky-500/15 text-sky-200'
                    : 'border-slate-800 bg-[#0D1526] text-slate-400 hover:text-slate-200'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ['ALL', `الكل (${effectiveProjections30.length})`],
              [
                'LIVE_BOOKMAKER',
                `أسعار مباشرة (${effectiveProjections30.filter((x) => x.sourceKind === 'LIVE_BOOKMAKER').length})`,
              ],
              ['GOALS_RESULTS', 'الأهداف والنتائج'],
              ['HANDICAPS', 'الهاندكاب الآسيوي والأوروبي'],
              ['CORNERS_CARDS_PLAYERS', 'الركنيات والبطاقات واللاعبين'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMatrixFilter(key)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer ${
                matrixFilter === key
                  ? 'border-sky-400/50 bg-sky-500/15 text-sky-200'
                  : 'border-slate-800 bg-[#070B14] text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Matrix Grid */}
        {filteredProjections30.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">
            لا توجد أسواق مطابقة للتصنيف المختار حاليًا.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredProjections30.map((item) => {
              const hasLiveOdds = item.sourceKind === 'LIVE_BOOKMAKER' && item.liveBookmakerOdds !== undefined;
              const tier = getSafetyTier(item.estimatedProbability);
              const outcome = evaluateBetOutcome(match, {
                selectionAr: item.bestSelectionAr,
                catalogIndex: item.catalogIndex,
                category: item.category,
              });
              const outStyle = getOutcomeStyle(outcome);
              const visual = outStyle || tier;
              return (
                <div
                  key={item.catalogIndex}
                  className={`rounded-xl border-2 p-4 flex flex-col justify-between gap-3 transition-colors ${visual.borderCls} ${visual.bgCls}`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-[11px] tabular-nums">
                      <span className="font-mono text-slate-300">
                        #{item.rank} · {item.catalogNameEn}
                      </span>
                      <span className={`inline-flex items-center gap-1 font-bold ${visual.textCls}`}>
                        <span className={`inline-block h-2 w-2 rounded-sm ${visual.dotCls}`} />
                        {visual.labelAr}
                      </span>
                    </div>

                    <h3
                      className={`font-display text-sm font-extrabold leading-snug ${visual.textCls} ${
                        outStyle?.strikeTitle ? 'line-through decoration-red-500/80' : ''
                      }`}
                    >
                      {item.bestSelectionAr}
                    </h3>
                    <p className="text-[11px] text-slate-200 leading-relaxed">
                      <strong className="text-slate-50">شرح الرهان: </strong>
                      {buildBetExplanationAr({
                        selectionAr: item.bestSelectionAr,
                        marketNameEn: item.catalogNameEn,
                        catalogIndex: item.catalogIndex,
                        category: item.category,
                        homeTeamAr: match.homeTeam.nameAr,
                        awayTeamAr: match.awayTeam.nameAr,
                        settlementRule: item.settlementRule,
                      })}
                    </p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      <strong className="text-slate-300">التحليل الإحصائي: </strong>
                      {item.rationaleAr}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3 tabular-nums">
                    <div>
                      <span className="block text-[10px] text-slate-400">الاحتمال المقدر</span>
                      <span className={`font-mono text-base font-extrabold ${visual.textCls}`}>
                        {item.estimatedProbability}%
                      </span>
                    </div>

                    <div className="text-left">
                      <span className="block text-[10px] text-slate-400">
                        {hasLiveOdds ? `أود مباشر (${item.bookmakerName})` : 'أود مرجعي (نموذج إحصائي)'}
                      </span>
                      {hasLiveOdds ? (
                        <div className="inline-flex items-center gap-1 font-mono text-base font-extrabold text-slate-50">
                          <span>{item.liveBookmakerOdds!.toFixed(2)}</span>
                          {item.oddsDirection === 'UP' && <span className="text-[#22FF66] text-xs">▲</span>}
                          {item.oddsDirection === 'DOWN' && <span className="text-[#FF4D4D] text-xs">▼</span>}
                        </div>
                      ) : (
                        <div className="font-mono text-base font-bold text-slate-100">
                          {item.fairReferenceOdds.toFixed(2)}
                        </div>
                      )}
                      {hasLiveOdds &&
                        item.previousBookmakerOdds !== undefined &&
                        item.oddsDirection &&
                        item.oddsDirection !== 'SAME' && (
                          <div className="font-mono text-[10px] text-slate-400">
                            من {item.previousBookmakerOdds.toFixed(2)}
                          </div>
                        )}
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400">
                    التسوية: {SETTLEMENT_RULE_LABELS[item.settlementRule]}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
