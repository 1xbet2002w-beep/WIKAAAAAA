import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckSquare, ChevronLeft, RefreshCw, Search, Square, Zap } from 'lucide-react';
import type { AnalysisConfig, MarketCategoryMeta, MatchData, MatchEvent } from '../../shared/types';
import { evaluateBetOutcome } from '../../shared/settlementEvaluator';
import { build30MarketProjections, generateLiveDynamicSignals } from '../../server/statsEngine';
import { getSafetyTier } from '../utils/safetyTheme';
import { AnalysisSetupPanel } from './AnalysisSetupPanel';
import { TeamCrest } from './TeamCrest';

function getEventLabelAr(type: MatchEvent['type']): string {
  switch (type) {
    case 'GOAL':
      return 'هدف';
    case 'YELLOW_CARD':
      return 'بطاقة صفراء';
    case 'RED_CARD':
      return 'بطاقة حمراء';
    case 'SUBSTITUTION':
      return 'تبديل';
    case 'VAR':
      return 'مراجعة VAR';
    default:
      return 'تحديث';
  }
}

interface MatchBoardViewProps {
  mode: 'LIVE' | 'PREMATCH';
  matches: MatchData[];
  categories: MarketCategoryMeta[];
  config: AnalysisConfig;
  isRunning: boolean;
  autoLiveSync: boolean;
  lastSyncAt: string | null;
  onToggleAutoLiveSync: () => void;
  onConfigChange: (next: AnalysisConfig) => void;
  onStartAnalysis: (selectedMatchIds?: string[]) => void;
  onOpenMatch: (matchId: string) => void;
  onRefreshMatches: () => void;
  onMutateDemo: (matchId: string, action: string) => Promise<void>;
  apiErrors: string[];
}

export const MatchBoardView: React.FC<MatchBoardViewProps> = ({
  mode,
  matches,
  categories,
  config,
  isRunning,
  autoLiveSync,
  lastSyncAt,
  onToggleAutoLiveSync,
  onConfigChange,
  onStartAnalysis,
  onOpenMatch,
  onRefreshMatches,
  onMutateDemo,
  apiErrors,
}) => {
  const modeMatches = useMemo(() => matches.filter((m) => m.mode === mode), [matches, mode]);
  const [checkedMatchIds, setCheckedMatchIds] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'TOMORROW'>('ALL');
  const [liveStatusFilter, setLiveStatusFilter] = useState<'ALL' | 'RUNNING' | 'FT'>('ALL');
  const [teamTypeFilter, setTeamTypeFilter] = useState<'ALL' | 'CLUB' | 'NATIONAL'>('ALL');
  const [leagueFilter, setLeagueFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const leagues = useMemo(() => Array.from(new Set(modeMatches.map((m) => m.leagueNameAr))), [modeMatches]);

  const filteredMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return modeMatches.filter((m) => {
      if (mode === 'PREMATCH' && dateFilter !== 'ALL' && m.dateGroup !== dateFilter) return false;
      if (mode === 'LIVE' && liveStatusFilter === 'RUNNING' && m.status === 'FT') return false;
      if (mode === 'LIVE' && liveStatusFilter === 'FT' && m.status !== 'FT') return false;
      if (teamTypeFilter !== 'ALL' && m.teamType !== teamTypeFilter) return false;
      if (leagueFilter !== 'ALL' && m.leagueNameAr !== leagueFilter) return false;
      if (q) {
        const hay = `${m.homeTeam.nameAr} ${m.homeTeam.nameEn} ${m.awayTeam.nameAr} ${m.awayTeam.nameEn} ${m.leagueNameAr}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [modeMatches, mode, dateFilter, liveStatusFilter, teamTypeFilter, leagueFilter, searchQuery]);

  // Group matches by league like TV Matchday Schedules
  const groupedByLeague = useMemo(() => {
    const map = new Map<string, MatchData[]>();
    for (const m of filteredMatches) {
      const key = m.leagueNameAr;
      const arr = map.get(key) || [];
      arr.push(m);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [filteredMatches]);

  const toggleMatchCheck = (id: string) => {
    setCheckedMatchIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const formatTimeOnly = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  const formatDateShort = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('ar-EG', {
        month: 'short',
        day: 'numeric',
      }).format(new Date(iso));
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Broadcast Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="text-xs font-mono text-sky-400">
            {mode === 'LIVE' ? 'LIVE BROADCAST ROOM' : 'PREMATCH MATCHDAY SCHEDULE'}
          </div>
          <h1 className="font-display text-2xl font-extrabold text-slate-50">
            {mode === 'LIVE' ? 'جدول وتحليل المباريات المباشرة' : 'جدول وتحليل مباريات اليوم والغد (أندية ومنتخبات)'}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleAutoLiveSync}
            className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium cursor-pointer whitespace-nowrap ${
              autoLiveSync
                ? 'border-teal-500/40 bg-teal-500/10 text-teal-200'
                : 'border-slate-700 bg-[#0D1526] text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span>
              {autoLiveSync
                ? `تحديث لحظي للأحداث والأود (${mode === 'LIVE' ? '10ث' : '15ث'}): مفعّل`
                : 'تحديث لحظي للأحداث والأود: متوقف'}
            </span>
          </button>
          {lastSyncAt && (
            <span className="font-mono text-[11px] text-slate-400 tabular-nums whitespace-nowrap">
              آخر مزامنة: {formatTimeOnly(lastSyncAt)}
            </span>
          )}
          <button
            type="button"
            onClick={onRefreshMatches}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#0D1526] px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>تحديث فوري</span>
          </button>
          {modeMatches.some((m) => m.isDemo) && (
            <button
              type="button"
              onClick={() => onMutateDemo('all', 'RESET_ALL')}
              className="rounded-lg border border-slate-700 bg-[#0D1526] px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 cursor-pointer whitespace-nowrap"
            >
              إعادة ضبط وضع المحاكاة
            </button>
          )}
        </div>
      </div>

      {/* API Errors / Outage Alerts */}
      {apiErrors.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-4 text-sm text-amber-200 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            {apiErrors.map((e, i) => (
              <div key={i}>{e}</div>
            ))}
          </div>
        </div>
      )}

      {/* Analysis Setup Panel */}
      <AnalysisSetupPanel
        mode={mode}
        config={config}
        categories={categories}
        selectedMatchCount={checkedMatchIds.length}
        totalMatchCount={filteredMatches.length}
        isRunning={isRunning}
        onChange={onConfigChange}
        onStart={() => onStartAnalysis(checkedMatchIds.length > 0 ? checkedMatchIds : undefined)}
      />

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {mode === 'LIVE' && (
            <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0D1526] p-1">
              {(
                [
                  ['ALL', 'الكل'],
                  ['RUNNING', 'جارية الآن'],
                  ['FT', 'انتهت اليوم (FT)'],
                ] as const
              ).map(([k, lbl]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setLiveStatusFilter(k)}
                  className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer ${
                    liveStatusFilter === k ? 'bg-teal-500/20 text-[#5EEAD4]' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          )}

          {mode === 'PREMATCH' && (
            <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0D1526] p-1">
              {(['ALL', 'TODAY', 'TOMORROW'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDateFilter(d)}
                  className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer ${
                    dateFilter === d ? 'bg-sky-500/20 text-sky-200' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {d === 'ALL' ? 'اليوم والغد' : d === 'TODAY' ? 'مباريات اليوم' : 'مباريات الغد'}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0D1526] p-1">
            {(['ALL', 'CLUB', 'NATIONAL'] as const).map((t) => {
              const count =
                t === 'ALL'
                  ? modeMatches.length
                  : modeMatches.filter((m) => m.teamType === t).length;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTeamTypeFilter(t)}
                  className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer tabular-nums ${
                    teamTypeFilter === t ? 'bg-teal-500/20 text-teal-300' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t === 'ALL'
                    ? `أندية ومنتخبات (${count})`
                    : t === 'CLUB'
                    ? `الأندية (${count})`
                    : `المنتخبات (${count})`}
                </button>
              );
            })}
          </div>

          <select
            aria-label="تصفية حسب البطولة"
            value={leagueFilter}
            onChange={(e) => setLeagueFilter(e.target.value)}
            className="rounded-lg border border-slate-800 bg-[#0D1526] px-3 py-1.5 text-xs text-slate-200 focus:border-teal-400 focus:outline-none max-w-[220px]"
          >
            <option value="ALL">جميع البطولات ({leagues.length})</option>
            {leagues.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>

          <div className="relative">
            <Search className="pointer-events-none absolute right-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="بحث باسم النادي أو المنتخب..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-lg border border-slate-800 bg-[#0D1526] pr-8 pl-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-teal-400 focus:outline-none w-52"
            />
          </div>
        </div>

        <div className="text-xs text-slate-400 tabular-nums">
          اضغط على أي مباراة لفتح صفحتها التحليلية الكاملة · {filteredMatches.length} مباراة
        </div>
      </div>

      {/* Matches Grouped by League */}
      {groupedByLeague.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-[#0D1526] p-10 text-center">
          <p className="text-base font-semibold text-slate-200">
            لا توجد مباريات {mode === 'LIVE' ? 'مباشرة' : 'مجدولة'} مطابقة للتصفية الحالية.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByLeague.map(([leagueName, leagueMatches]) => (
            <section key={leagueName} className="rounded-2xl border border-slate-800/90 bg-[#0D1526] overflow-hidden">
              {/* League Group Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 bg-[#0A111F] px-5 py-3">
                <div className="flex items-center gap-2.5">
                  {leagueMatches[0]?.leagueLogoUrl && (
                    <img
                      src={leagueMatches[0].leagueLogoUrl}
                      alt={leagueName}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-5 w-5 object-contain shrink-0"
                    />
                  )}
                  <h2 className="font-display text-sm sm:text-base font-bold text-slate-100">{leagueName}</h2>
                  <span className="text-xs text-slate-400">
                    · {leagueMatches[0]?.teamType === 'NATIONAL' ? 'منتخبات' : 'أندية'}
                  </span>
                </div>
                <span className="font-mono text-xs text-slate-400 tabular-nums">{leagueMatches.length} مباريات</span>
              </div>

              {/* Broadcast Match Rows with Team Crests / Flags */}
              <div className="divide-y divide-slate-800/60">
                {leagueMatches.map((m) => {
                  const isChecked = checkedMatchIds.includes(m.id);
                  const latestEvent =
                    m.liveEvents && m.liveEvents.length > 0
                      ? [...m.liveEvents].sort((a, b) => b.minute - a.minute)[0]
                      : null;
                  const isFinished = m.status === 'FT';
                  const topSignal = m.mode === 'LIVE' && !isFinished ? generateLiveDynamicSignals(m)[0] : null;
                  const signalTier = topSignal ? getSafetyTier(topSignal.estimatedProbability) : null;
                  const ftCounts = isFinished
                    ? (() => {
                        const projs = build30MarketProjections(m);
                        let won = 0;
                        let lost = 0;
                        for (const p of projs) {
                          const res = evaluateBetOutcome(m, {
                            selectionAr: p.bestSelectionAr,
                            catalogIndex: p.catalogIndex,
                            category: p.category,
                          });
                          if (res === 'WIN' || res === 'HALF_WIN') won++;
                          else if (res === 'LOSS' || res === 'HALF_LOSS') lost++;
                        }
                        return { won, lost };
                      })()
                    : null;

                  return (
                    <div
                      key={m.id}
                      className="flex items-start gap-3 px-4 py-3.5 sm:px-5 hover:bg-[#111B2F] transition-colors"
                    >
                      <button
                        type="button"
                        aria-label={`تحديد ${m.homeTeam.nameAr} ضد ${m.awayTeam.nameAr}`}
                        onClick={() => toggleMatchCheck(m.id)}
                        className="mt-2.5 text-slate-400 hover:text-teal-300 cursor-pointer shrink-0"
                      >
                        {isChecked ? <CheckSquare className="h-4 w-4 text-teal-400" /> : <Square className="h-4 w-4" />}
                      </button>

                      {/* Clickable Full Match Row -> Opens MatchDetailPage */}
                      <button
                        type="button"
                        onClick={() => onOpenMatch(m.id)}
                        className="flex-1 text-right cursor-pointer min-w-0 space-y-2.5"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-3">
                          {/* Home Team + Crest */}
                          <div className="sm:col-span-4 flex items-center justify-end sm:justify-end gap-3 min-w-0">
                            <span className="font-display text-sm sm:text-base font-bold text-slate-100 truncate">
                              {m.homeTeam.nameAr}
                            </span>
                            <TeamCrest
                              logoUrl={m.homeTeam.logoUrl}
                              name={m.homeTeam.nameAr}
                              shortCode={m.homeTeam.shortCode}
                              size="md"
                            />
                          </div>

                          {/* Center Time / Live Score / Final Score */}
                          <div className="sm:col-span-3 flex flex-col items-center justify-center">
                            {m.mode === 'LIVE' ? (
                              <div
                                className={`rounded-lg border px-3.5 py-1 text-center tabular-nums ${
                                  isFinished
                                    ? 'border-[#14B8A6]/60 bg-[#0B3B46]/60'
                                    : 'border-teal-500/30 bg-teal-500/10'
                                }`}
                              >
                                <div
                                  className={`font-mono text-base font-extrabold ${
                                    isFinished ? 'text-[#5EEAD4]' : 'text-teal-300'
                                  }`}
                                >
                                  {m.scoreHome ?? 0} - {m.scoreAway ?? 0}
                                </div>
                                <div
                                  className={`font-mono text-[11px] ${
                                    isFinished ? 'text-[#5EEAD4]' : 'text-teal-200'
                                  }`}
                                >
                                  {isFinished
                                    ? 'انتهت (FT)'
                                    : `${m.minute ?? 0}' · ${m.status === 'HT' ? 'استراحة' : 'مباشر'}`}
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-lg border border-slate-700/80 bg-[#070B14] px-3.5 py-1.5 text-center tabular-nums">
                                <div className="font-mono text-sm font-bold text-slate-100">
                                  {formatTimeOnly(m.kickoffTime)}
                                </div>
                                <div className="text-[10px] text-slate-400">{formatDateShort(m.kickoffTime)}</div>
                              </div>
                            )}
                          </div>

                          {/* Away Crest + Team */}
                          <div className="sm:col-span-4 flex items-center justify-start gap-3 min-w-0">
                            <TeamCrest
                              logoUrl={m.awayTeam.logoUrl}
                              name={m.awayTeam.nameAr}
                              shortCode={m.awayTeam.shortCode}
                              size="md"
                            />
                            <span className="font-display text-sm sm:text-base font-bold text-slate-100 truncate">
                              {m.awayTeam.nameAr}
                            </span>
                          </div>

                          {/* Markets Indicator, Live 1X2 Ticker & Open Arrow */}
                          <div className="sm:col-span-1 flex items-center justify-end gap-1.5 text-xs text-sky-300 shrink-0">
                            {(() => {
                              const o1 = m.availableMarkets.find((x) => x.selectionCode === '1');
                              const o2 = m.availableMarkets.find((x) => x.selectionCode === '2');
                              const bestAny = m.availableMarkets[0];
                              if (o1 && o2) {
                                return (
                                  <div className="hidden xl:flex items-center gap-1.5 font-mono text-[11px] tabular-nums text-slate-200">
                                    <span>
                                      {o1.odds.toFixed(2)}
                                      {o1.oddsDirection === 'UP' && <span className="text-[#22FF66] mr-0.5">▲</span>}
                                      {o1.oddsDirection === 'DOWN' && <span className="text-[#FF4D4D] mr-0.5">▼</span>}
                                    </span>
                                    <span className="text-slate-600">/</span>
                                    <span>
                                      {o2.odds.toFixed(2)}
                                      {o2.oddsDirection === 'UP' && <span className="text-[#22FF66] mr-0.5">▲</span>}
                                      {o2.oddsDirection === 'DOWN' && <span className="text-[#FF4D4D] mr-0.5">▼</span>}
                                    </span>
                                  </div>
                                );
                              }
                              if (bestAny) {
                                return (
                                  <span className="hidden xl:inline font-mono text-[11px] text-slate-300 tabular-nums">
                                    {bestAny.odds.toFixed(2)}
                                    {bestAny.oddsDirection === 'UP' && <span className="text-[#22FF66] mr-0.5">▲</span>}
                                    {bestAny.oddsDirection === 'DOWN' && <span className="text-[#FF4D4D] mr-0.5">▼</span>}
                                  </span>
                                );
                              }
                              return (
                                <span className="font-mono tabular-nums text-[11px] text-slate-400">
                                  30 سوقًا
                                </span>
                              );
                            })()}
                            <ChevronLeft className="h-4 w-4 text-slate-400" />
                          </div>
                        </div>

                        {/* Live Events & Dynamic Opportunity / Post-Match Settlement Strip */}
                        {m.mode === 'LIVE' && (
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800/80 bg-[#070B14]/80 px-3 py-2 text-[11px] tabular-nums">
                            <div className="flex flex-wrap items-center gap-3 text-slate-300">
                              {latestEvent ? (
                                <span className={latestEvent.isNew && !isFinished ? 'font-bold text-[#22FF66]' : 'text-slate-200'}>
                                  {latestEvent.isNew && !isFinished ? '● حدث جديد: ' : 'آخر حدث: '}
                                  د {latestEvent.minute}&apos; · {getEventLabelAr(latestEvent.type)} ({latestEvent.player})
                                </span>
                              ) : (
                                <span className="text-slate-400">
                                  {isFinished ? 'انتهى الوقت الأصلي للمباراة' : 'مراقبة الأحداث المباشرة جارية...'}
                                </span>
                              )}

                              {m.liveStats && (
                                <span className="text-slate-400 font-mono">
                                  ركنيات {m.liveStats.cornersHome}-{m.liveStats.cornersAway} · تسديدات {m.liveStats.shotsHome}-{m.liveStats.shotsAway} · بطاقات {m.liveStats.yellowCardsHome + m.liveStats.yellowCardsAway}
                                </span>
                              )}
                            </div>

                            {isFinished && ftCounts ? (
                              <div className="inline-flex items-center gap-3 font-bold">
                                <span className="text-[#5EEAD4]">رهانات فائزة: {ftCounts.won}</span>
                                <span className="text-red-400">خاسرة: {ftCounts.lost}</span>
                              </div>
                            ) : (
                              topSignal &&
                              signalTier && (
                                <div className={`inline-flex items-center gap-1.5 font-bold ${signalTier.textCls}`}>
                                  <Zap className="h-3.5 w-3.5 shrink-0" />
                                  <span>
                                    طرح لحظي: {topSignal.suggestedMarketAr} ({topSignal.estimatedProbability}% · أود {topSignal.referenceOdds.toFixed(2)})
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
