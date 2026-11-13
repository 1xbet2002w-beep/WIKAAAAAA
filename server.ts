import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import type { AnalysisConfig, AnalyzedPick, SettlementOutcome } from './shared/types.ts';
import { runWarRoomAnalysis } from './server/aiWarRoom.ts';
import { tickDemoLiveMatches } from './server/demoMatches.ts';
import {
  clearRealMatchesCache,
  enrichMatchDeepDetails,
  fetchRealMatchesFromConnectors,
  getCachedRealMatches,
} from './server/footballConnectors.ts';
import { MARKET_CATEGORIES, SETTLEMENT_RULE_LABELS } from './server/markets.ts';
import { runAllQAVerifications } from './server/qaSuite.ts';
import { build30MarketProjections, generateLiveDynamicSignals } from './server/statsEngine.ts';
import {
  autoSettleLedgerFromMatches,
  clearAnalysisCache,
  computePerformanceMetrics,
  getDemoMatches,
  getPredictions,
  getPublicSettings,
  getRawConnectorKeys,
  getRecentSessions,
  loadStore,
  mutateDemoMatch,
  recordConnectorUsage,
  resetDemoMatches,
  savePredictionToLedger,
  settlePredictionRecord,
  updateSettings,
} from './server/store.ts';

loadStore();

const app = express();
app.use(express.json({ limit: '2mb' }));

// Health Check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// Markets metadata
app.get('/api/markets/meta', (_req, res) => {
  res.json({
    categories: MARKET_CATEGORIES,
    settlementRules: SETTLEMENT_RULE_LABELS,
  });
});

// Fetch Live & Prematch fixtures depending on dataSourceMode
app.get('/api/matches', async (req, res) => {
  const isLiveRefresh = req.query.live === 'true';
  const settings = getPublicSettings();
  if (settings.dataSourceMode === 'DEMO_STUDIO') {
    const demoMatches = getDemoMatches();
    if (isLiveRefresh) {
      tickDemoLiveMatches(demoMatches);
    }
    autoSettleLedgerFromMatches(demoMatches);
    return res.json({
      mode: 'DEMO_STUDIO',
      matches: demoMatches,
      errors: [],
      usedCache: false,
      fetchedAt: new Date().toISOString(),
    });
  }

  const rawKeys = getRawConnectorKeys();
  const result = await fetchRealMatchesFromConnectors(
    settings.connectors,
    rawKeys,
    settings.cacheTtlSeconds,
    recordConnectorUsage,
    isLiveRefresh
  );
  autoSettleLedgerFromMatches(result.matches);
  return res.json({
    mode: 'REAL_API',
    matches: result.matches,
    errors: result.errors,
    usedCache: result.usedCache,
    fetchedAt: new Date().toISOString(),
  });
});

// Deep match enrichment (rosters, form, live pickcenter odds) + 30-market 1xBet-style projections
app.get('/api/matches/:id/deep', async (req, res) => {
  const matchId = req.params.id;
  const settings = getPublicSettings();

  let target =
    settings.dataSourceMode === 'DEMO_STUDIO'
      ? getDemoMatches().find((m) => m.id === matchId)
      : getCachedRealMatches().find((m) => m.id === matchId);

  if (!target && settings.dataSourceMode === 'REAL_API') {
    const rawKeys = getRawConnectorKeys();
    const fresh = await fetchRealMatchesFromConnectors(
      settings.connectors,
      rawKeys,
      settings.cacheTtlSeconds,
      recordConnectorUsage,
      true
    );
    target = fresh.matches.find((m) => m.id === matchId);
  }

  if (!target) {
    return res.status(404).json({ error: 'المباراة غير موجودة' });
  }

  const enriched = target.isDemo ? target : await enrichMatchDeepDetails(target);
  autoSettleLedgerFromMatches([enriched]);
  const projections30 = build30MarketProjections(enriched);
  const liveSignals = generateLiveDynamicSignals(enriched);

  return res.json({
    match: enriched,
    projections30,
    liveSignals,
    fetchedAt: new Date().toISOString(),
  });
});

// Demo simulation mutations (for testing live goals, red cards, stale feeds, outages)
app.post('/api/matches/demo-mutate', (req, res) => {
  const { matchId, action } = req.body || {};
  if (action === 'RESET_ALL') {
    const matches = resetDemoMatches();
    clearAnalysisCache();
    return res.json({ ok: true, matches });
  }
  const updated = mutateDemoMatch(matchId, action);
  if (!updated) {
    return res.status(404).json({ error: 'المباراة غير موجودة' });
  }
  clearAnalysisCache();
  return res.json({ ok: true, match: updated });
});

// Settings endpoints (masked keys only)
app.get('/api/settings', (_req, res) => {
  res.json(getPublicSettings());
});

app.post('/api/settings', (req, res) => {
  const updated = updateSettings(req.body || {});
  clearRealMatchesCache();
  clearAnalysisCache();
  res.json(updated);
});

app.post('/api/cache/clear', (_req, res) => {
  clearRealMatchesCache();
  clearAnalysisCache();
  res.json({ ok: true });
});

// Recent War Room sessions
app.get('/api/analysis/recent', (_req, res) => {
  res.json({ sessions: getRecentSessions() });
});

// Run Multi-Agent AI War Room via Server-Sent Events (SSE)
app.post('/api/analysis/stream', async (req, res) => {
  const config = req.body as AnalysisConfig;
  if (!config || !config.mode) {
    return res.status(400).json({ error: 'إعدادات التحليل غير صالحة' });
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (type: string, payload: any) => {
    res.write(`data: ${JSON.stringify({ type, payload })}\n\n`);
  };

  try {
    const settings = getPublicSettings();
    let modeMatches = [];

    if (settings.dataSourceMode === 'DEMO_STUDIO') {
      modeMatches = getDemoMatches().filter((m) => m.mode === config.mode);
    } else {
      const rawKeys = getRawConnectorKeys();
      const real = await fetchRealMatchesFromConnectors(
        settings.connectors,
        rawKeys,
        settings.cacheTtlSeconds,
        recordConnectorUsage
      );
      if (real.errors.length > 0 && real.matches.length === 0) {
        sendEvent('ERROR', { messageAr: real.errors.join(' | ') });
        return res.end();
      }
      modeMatches = real.matches.filter((m) => m.mode === config.mode);
    }

    await runWarRoomAnalysis(config, modeMatches, (ev) => {
      sendEvent(ev.type, ev.payload);
    });
  } catch (err: any) {
    sendEvent('ERROR', { messageAr: err?.message || 'حدث خطأ غير متوقع أثناء تشغيل غرفة الذكاء' });
  } finally {
    res.end();
  }
});

// Immutable Prediction Ledger & Performance Metrics
app.get('/api/ledger', (req, res) => {
  const includeDemo = req.query.includeDemo !== 'false';
  res.json({
    predictions: getPredictions(includeDemo),
    metrics: computePerformanceMetrics(includeDemo),
  });
});

app.post('/api/ledger/save', (req, res) => {
  const pick = req.body?.pick as AnalyzedPick;
  if (!pick || !pick.matchId || !pick.selectionCode) {
    return res.status(400).json({ error: 'بيانات الترشيح غير مكتملة' });
  }
  const outcome = savePredictionToLedger(pick);
  res.json(outcome);
});

app.post('/api/ledger/settle', (req, res) => {
  const { id, outcome, settledScore } = req.body as { id: string; outcome: SettlementOutcome; settledScore?: string };
  if (!id || !outcome) {
    return res.status(400).json({ error: 'معرف التوقع وحالة التسوية مطلوبان' });
  }
  const updated = settlePredictionRecord(id, outcome, settledScore);
  if (!updated) {
    return res.status(404).json({ error: 'السجل غير موجود' });
  }
  res.json({ record: updated });
});

// 15-Point QA Suite
app.get('/api/qa/run', (_req, res) => {
  res.json({ results: runAllQAVerifications() });
});

// Mount Vite dev middleware or serve static production build
async function startServer() {
  const PORT = 3000;
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(process.cwd(), 'dist'));

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RASD AI Broadcast Intelligence Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start RASD AI server:', err);
  process.exit(1);
});
