/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import type {
  AnalysisConfig,
  AnalyzedPick,
  DebateEntry,
  DebateStage,
  LiveDynamicSignal,
  MarketCategoryMeta,
  MarketProjectionItem,
  MatchData,
  ModelSlotId,
  PerformanceMetrics,
  PredictionRecord,
  SettlementOutcome,
  SystemSettings,
  WarRoomResult,
} from '../shared/types';
import { DashboardView } from './components/DashboardView';
import { MatchBoardView } from './components/MatchBoardView';
import { MatchDetailPage } from './components/MatchDetailPage';
import { PerformanceView } from './components/PerformanceView';
import { SettingsAndQAView } from './components/SettingsAndQAView';
import { TopBar, type NavTab } from './components/TopBar';
import { WarRoomView, type ModelLiveState } from './components/WarRoomView';

const INITIAL_MODEL_STATES: Record<ModelSlotId, ModelLiveState> = {
  analyst_alpha: { status: 'IDLE', progress: 0 },
  analyst_beta: { status: 'IDLE', progress: 0 },
  analyst_gamma: { status: 'IDLE', progress: 0 },
};

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [apiErrors, setApiErrors] = useState<string[]>([]);
  const [categories, setCategories] = useState<MarketCategoryMeta[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [recentSessions, setRecentSessions] = useState<WarRoomResult[]>([]);
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [includeDemoLedger, setIncludeDemoLedger] = useState(true);

  const [liveConfig, setLiveConfig] = useState<AnalysisConfig>({
    mode: 'LIVE',
    targetOdds: 1.3,
    oddsTolerance: 0.15,
    oddsMode: 'SINGLE',
    targetProbability: 75,
    maxResults: 'ALL',
    selectedCategories: 'ALL',
    maxDebateRounds: 4,
  });

  const [prematchConfig, setPrematchConfig] = useState<AnalysisConfig>({
    mode: 'PREMATCH',
    targetOdds: 1.3,
    oddsTolerance: 0.12,
    oddsMode: 'SINGLE',
    targetProbability: 75,
    maxResults: 'ALL',
    selectedCategories: 'ALL',
    maxDebateRounds: 4,
  });

  // War Room SSE Streaming State
  const [isRunning, setIsRunning] = useState(false);
  const [currentStage, setCurrentStage] = useState<DebateStage | null>(null);
  const [stageMessageAr, setStageMessageAr] = useState('');
  const [modelLiveStates, setModelLiveStates] = useState<Record<ModelSlotId, ModelLiveState>>(INITIAL_MODEL_STATES);
  const [liveDebateFeed, setLiveDebateFeed] = useState<DebateEntry[]>([]);
  const [warRoomResult, setWarRoomResult] = useState<WarRoomResult | null>(null);
  const [lastModeAnalyzed, setLastModeAnalyzed] = useState<'LIVE' | 'PREMATCH'>('PREMATCH');
  const [openedMatchId, setOpenedMatchId] = useState<string | null>(null);
  const [autoLiveSync, setAutoLiveSync] = useState(true);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [deepData, setDeepData] = useState<{
    matchId: string;
    match: MatchData;
    projections30: MarketProjectionItem[];
    liveSignals: LiveDynamicSignal[];
  } | null>(null);
  const [deepLoading, setDeepLoading] = useState(false);

  const fetchAllData = useCallback(async () => {
    try {
      const [metaRes, settingsRes, matchesRes, recentRes, ledgerRes] = await Promise.all([
        fetch('/api/markets/meta'),
        fetch('/api/settings'),
        fetch('/api/matches'),
        fetch('/api/analysis/recent'),
        fetch(`/api/ledger?includeDemo=${includeDemoLedger}`),
      ]);

      if (metaRes.ok) {
        const meta = await metaRes.json();
        setCategories(meta.categories || []);
      }
      if (settingsRes.ok) {
        setSettings(await settingsRes.json());
      }
      if (matchesRes.ok) {
        const mData = await matchesRes.json();
        setMatches(mData.matches || []);
        setApiErrors(mData.errors || []);
        setLastSyncAt(mData.fetchedAt || new Date().toISOString());
      }
      if (recentRes.ok) {
        const rData = await recentRes.json();
        setRecentSessions(rData.sessions || []);
        if (!warRoomResult && rData.sessions?.length > 0) {
          setWarRoomResult(rData.sessions[0]);
        }
      }
      if (ledgerRes.ok) {
        const lData = await ledgerRes.json();
        setPredictions(lData.predictions || []);
        setMetrics(lData.metrics || null);
      }
    } catch (err) {
      console.error('Failed loading studio data:', err);
    }
  }, [includeDemoLedger, warRoomResult]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const refreshMatchesOnly = useCallback(async (liveMode = false) => {
    try {
      const res = await fetch(`/api/matches${liveMode ? '?live=true' : ''}`);
      if (res.ok) {
        const mData = await res.json();
        setMatches(mData.matches || []);
        setApiErrors(mData.errors || []);
        setLastSyncAt(mData.fetchedAt || new Date().toISOString());
      }
    } catch (err) {
      console.error('Failed refreshing matches:', err);
    }
  }, []);

  const fetchDeepMatch = useCallback(async (matchId: string, showSpinner = false) => {
    if (showSpinner) setDeepLoading(true);
    try {
      const res = await fetch(`/api/matches/${encodeURIComponent(matchId)}/deep`);
      if (res.ok) {
        const payload = await res.json();
        if (payload.match) {
          setDeepData({
            matchId,
            match: payload.match,
            projections30: payload.projections30 || [],
            liveSignals: payload.liveSignals || [],
          });
          setMatches((prev) => prev.map((m) => (m.id === matchId ? payload.match : m)));
          setLastSyncAt(payload.fetchedAt || new Date().toISOString());
        }
      }
    } catch (err) {
      console.error('Failed fetching deep match details:', err);
    } finally {
      if (showSpinner) setDeepLoading(false);
    }
  }, []);

  // Fetch deep details immediately whenever a match detail page is opened
  useEffect(() => {
    if (openedMatchId) {
      fetchDeepMatch(openedMatchId, true);
    } else {
      setDeepData(null);
    }
  }, [openedMatchId, fetchDeepMatch]);

  const openedMatchMode = openedMatchId
    ? matches.find((m) => m.id === openedMatchId)?.mode ?? deepData?.match.mode
    : null;

  // Automatic 10-second live events & odds synchronization (15s on prematch/dashboard)
  useEffect(() => {
    if (!autoLiveSync) return;
    const isLiveFocus = activeTab === 'live' || openedMatchMode === 'LIVE';
    const intervalMs = isLiveFocus ? 10000 : 15000;
    const timer = setInterval(() => {
      if (openedMatchId) {
        if (openedMatchMode === 'LIVE') {
          // Keep background demo/real live feed ticking alongside opened match details
          refreshMatchesOnly(true).then(() => fetchDeepMatch(openedMatchId, false));
        } else {
          fetchDeepMatch(openedMatchId, false);
        }
      } else if (activeTab === 'live' || activeTab === 'prematch' || activeTab === 'dashboard') {
        refreshMatchesOnly(true);
      }
    }, intervalMs);
    return () => clearInterval(timer);
  }, [autoLiveSync, openedMatchId, openedMatchMode, activeTab, fetchDeepMatch, refreshMatchesOnly]);

  const handleMutateDemo = async (matchId: string, action: string) => {
    await fetch('/api/matches/demo-mutate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId, action }),
    });
    await refreshMatchesOnly();
  };

  const handleStartAnalysis = async (
    mode: 'LIVE' | 'PREMATCH',
    selectedMatchIds?: string[],
    stayOnMatchPage = false
  ) => {
    const baseCfg = mode === 'LIVE' ? liveConfig : prematchConfig;
    const payload: AnalysisConfig = {
      ...baseCfg,
      mode,
      matchIds: selectedMatchIds,
    };

    setLastModeAnalyzed(mode);
    setIsRunning(true);
    setCurrentStage('ROUND_1_INDEPENDENT');
    setStageMessageAr('جارٍ إرسال بيانات المباريات إلى النماذج الثلاثة المستقلة...');
    setModelLiveStates(INITIAL_MODEL_STATES);
    setLiveDebateFeed([]);
    setWarRoomResult(null);
    if (!stayOnMatchPage) {
      setOpenedMatchId(null);
      setActiveTab('warroom');
    }

    try {
      const response = await fetch('/api/analysis/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok || !response.body) {
        throw new Error('تعذر بدء الاتصال ببث غرفة الذكاء.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const chunk of parts) {
          const line = chunk.trim();
          if (!line.startsWith('data:')) continue;
          const jsonStr = line.slice(5).trim();
          if (!jsonStr) continue;
          try {
            const evt = JSON.parse(jsonStr);
            if (evt.type === 'STAGE') {
              setCurrentStage(evt.payload.stage);
              setStageMessageAr(evt.payload.messageAr || '');
            } else if (evt.type === 'MODEL_STATUS') {
              const { slotId, status, progress, matchLabelAr } = evt.payload;
              setModelLiveStates((prev) => ({
                ...prev,
                [slotId]: { status, progress, matchLabelAr },
              }));
            } else if (evt.type === 'DEBATE_ENTRY') {
              setLiveDebateFeed((prev) => [...prev, evt.payload]);
            } else if (evt.type === 'COMPLETE') {
              setWarRoomResult(evt.payload);
              setRecentSessions((prev) => [evt.payload, ...prev.slice(0, 9)]);
              setStageMessageAr('اكتملت جميع مراحل التحليل والنقاش والتجميع.');
            } else if (evt.type === 'ERROR') {
              setStageMessageAr(evt.payload.messageAr || 'حدث خطأ أثناء التحليل');
            }
          } catch {
            // Ignore partial chunk parse errors
          }
        }
      }
    } catch (err: any) {
      setStageMessageAr(err?.message || 'فشل الاتصال بغرفة الذكاء');
    } finally {
      setIsRunning(false);
    }
  };

  const handleSavePick = async (pick: AnalyzedPick) => {
    const res = await fetch('/api/ledger/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pick }),
    });
    const data = await res.json();
    // Refresh ledger stats
    const ledgerRes = await fetch(`/api/ledger?includeDemo=${includeDemoLedger}`);
    if (ledgerRes.ok) {
      const lData = await ledgerRes.json();
      setPredictions(lData.predictions || []);
      setMetrics(lData.metrics || null);
    }
    return { saved: Boolean(data.saved), duplicate: Boolean(data.duplicate) };
  };

  const handleSettlePrediction = async (id: string, outcome: SettlementOutcome, settledScore?: string) => {
    await fetch('/api/ledger/settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, outcome, settledScore }),
    });
    const ledgerRes = await fetch(`/api/ledger?includeDemo=${includeDemoLedger}`);
    if (ledgerRes.ok) {
      const lData = await ledgerRes.json();
      setPredictions(lData.predictions || []);
      setMetrics(lData.metrics || null);
    }
  };

  const handleSaveSettings = async (payload: any) => {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setSettings(await res.json());
      await refreshMatchesOnly();
    }
  };

  const handleClearCache = async () => {
    await fetch('/api/cache/clear', { method: 'POST' });
    await refreshMatchesOnly();
  };

  const baseOpenedMatch = openedMatchId ? matches.find((m) => m.id === openedMatchId) || null : null;
  const openedMatch =
    baseOpenedMatch && deepData && deepData.matchId === baseOpenedMatch.id ? deepData.match : baseOpenedMatch;
  const openedProjections30 =
    openedMatch && deepData && deepData.matchId === openedMatch.id ? deepData.projections30 : [];
  const openedLiveSignals =
    openedMatch && deepData && deepData.matchId === openedMatch.id ? deepData.liveSignals : [];

  const handleSelectTab = (tab: NavTab) => {
    setOpenedMatchId(null);
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 flex flex-col">
      <TopBar activeTab={activeTab} onSelectTab={handleSelectTab} />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {openedMatch ? (
          <MatchDetailPage
            match={openedMatch}
            projections30={openedProjections30}
            liveSignals={openedLiveSignals}
            deepLoading={deepLoading}
            autoLiveSync={autoLiveSync}
            lastSyncAt={lastSyncAt}
            onToggleAutoLiveSync={() => setAutoLiveSync((v) => !v)}
            onRefreshDeep={() => fetchDeepMatch(openedMatch.id, true)}
            activeConfig={openedMatch.mode === 'LIVE' ? liveConfig : prematchConfig}
            models={settings?.aiModels || []}
            isRunning={isRunning}
            currentStage={currentStage}
            stageMessageAr={stageMessageAr}
            modelLiveStates={modelLiveStates}
            liveDebateFeed={liveDebateFeed}
            warRoomResult={warRoomResult}
            onBack={() => setOpenedMatchId(null)}
            onRunMatchAI={(mid) => handleStartAnalysis(openedMatch.mode, [mid], true)}
            onSavePick={handleSavePick}
            onSimulateFinishMatch={
              openedMatch.isDemo && openedMatch.status !== 'FT'
                ? async () => {
                    await handleMutateDemo(openedMatch.id, 'SIMULATE_FINISH_MATCH');
                    await fetchDeepMatch(openedMatch.id, true);
                  }
                : undefined
            }
          />
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardView
                matches={matches}
                settings={settings}
                recentSessions={recentSessions}
                metrics={metrics}
                onNavigate={handleSelectTab}
                onOpenMatch={(mid) => setOpenedMatchId(mid)}
              />
            )}

            {activeTab === 'live' && (
              <MatchBoardView
                mode="LIVE"
                matches={matches}
                categories={categories}
                config={liveConfig}
                isRunning={isRunning}
                autoLiveSync={autoLiveSync}
                lastSyncAt={lastSyncAt}
                onToggleAutoLiveSync={() => setAutoLiveSync((v) => !v)}
                onConfigChange={setLiveConfig}
                onStartAnalysis={(ids) => handleStartAnalysis('LIVE', ids)}
                onOpenMatch={(mid) => setOpenedMatchId(mid)}
                onRefreshMatches={() => refreshMatchesOnly(true)}
                onMutateDemo={handleMutateDemo}
                apiErrors={apiErrors}
              />
            )}

            {activeTab === 'prematch' && (
              <MatchBoardView
                mode="PREMATCH"
                matches={matches}
                categories={categories}
                config={prematchConfig}
                isRunning={isRunning}
                autoLiveSync={autoLiveSync}
                lastSyncAt={lastSyncAt}
                onToggleAutoLiveSync={() => setAutoLiveSync((v) => !v)}
                onConfigChange={setPrematchConfig}
                onStartAnalysis={(ids) => handleStartAnalysis('PREMATCH', ids)}
                onOpenMatch={(mid) => setOpenedMatchId(mid)}
                onRefreshMatches={() => refreshMatchesOnly(true)}
                onMutateDemo={handleMutateDemo}
                apiErrors={apiErrors}
              />
            )}

            {activeTab === 'warroom' && (
              <WarRoomView
                models={settings?.aiModels || []}
                matches={matches}
                isRunning={isRunning}
                currentStage={currentStage}
                stageMessageAr={stageMessageAr}
                modelLiveStates={modelLiveStates}
                liveDebateFeed={liveDebateFeed}
                result={warRoomResult}
                categories={categories}
                onSavePick={handleSavePick}
                onGoToSetup={() => setActiveTab(lastModeAnalyzed === 'LIVE' ? 'live' : 'prematch')}
              />
            )}

            {activeTab === 'performance' && (
              <PerformanceView
                predictions={predictions}
                metrics={metrics}
                includeDemo={includeDemoLedger}
                onToggleIncludeDemo={setIncludeDemoLedger}
                onSettlePrediction={handleSettlePrediction}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsAndQAView
                settings={settings}
                onSaveSettings={handleSaveSettings}
                onClearCache={handleClearCache}
              />
            )}
          </>
        )}
      </main>

      <footer className="border-t border-slate-800/80 bg-[#070B14] py-5 px-4 sm:px-6">
        <div className="mx-auto max-w-[1440px] flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <span>RASD AI — منظومة استخبارات كروية للتحليل الجماعي ومعايرة الأسواق</span>
          <span>التحليل الإحصائي لأغراض الدراسة والبحث فقط · لا ينفذ النظام أي مراهنات أو معاملات مالية</span>
        </div>
      </footer>
    </div>
  );
}
