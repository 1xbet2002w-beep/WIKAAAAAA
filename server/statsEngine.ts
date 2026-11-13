import type { LiveDynamicSignal, MarketOption, MarketProjectionItem, MatchData } from '../shared/types.ts';
import { BOOKMAKER_30_MARKETS } from './markets.ts';

function factorial(n: number): number {
  if (n <= 1) return 1;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

export function poissonPMF(lambda: number, k: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

export function clampProb(p: number, allowSettled100 = false): number {
  const max = allowSettled100 ? 100 : 97.5;
  return Math.round(Math.min(max, Math.max(2.5, p)) * 10) / 10;
}

export interface DataQualityReport {
  score: number;
  freshnessSeconds: number;
  isStale: boolean;
  issues: string[];
}

export function evaluateDataQuality(match: MatchData): DataQualityReport {
  const now = Date.now();
  const updatedMs = new Date(match.feedUpdatedAt).getTime();
  const freshnessSeconds = Math.max(0, Math.round((now - updatedMs) / 1000));
  const issues: string[] = [];

  let score = 96;

  if (match.feedOutage) {
    score -= 60;
    issues.push(match.outageReason || 'انقطاع مصدر البيانات المباشر لهذا اللقاء');
  }

  if (match.mode === 'LIVE') {
    if (match.feedStale || freshnessSeconds > 90) {
      score -= 28;
      issues.push(`تأخر تحديث البيانات المباشرة (${freshnessSeconds} ثانية)`);
    }
    if (!match.liveStats) {
      score -= 22;
      issues.push('غياب إحصائيات اللعب المباشرة (التسديدات/الاستحواذ)');
    }
  } else {
    if (!match.lineupConfirmed) {
      score -= 7;
      issues.push('التشكيلة الرسمية لم تُعلن بعد (الاعتماد على التشكيلة المتوقعة)');
    }
    if (match.homeTeam.injuries.length === 0 && match.awayTeam.injuries.length === 0) {
      score -= 3;
    }
  }

  if (match.availableMarkets.length < 6) {
    score -= 10;
    issues.push('عدد الأسواق المتاحة من المزود محدود');
  }

  if (match.h2hSummary.played < 3) {
    score -= 5;
    issues.push('عينة المواجهات المباشرة التاريخية صغيرة');
  }

  return {
    score: Math.max(15, Math.min(99, score)),
    freshnessSeconds,
    isStale: match.mode === 'LIVE' && (Boolean(match.feedStale) || freshnessSeconds > 90),
    issues,
  };
}

export interface StatisticalMarketEval {
  statisticalProb: number;
  bookmakerFairProb: number;
  isMathematicallySettled: boolean;
  explanationAr: string;
}

/**
 * Computes Poisson / live-state / market-fair baseline probability for any discovered market option.
 * Never invents 100% probability unless the current live score already guarantees settlement.
 */
export function computeMarketBaseline(match: MatchData, market: MarketOption): StatisticalMarketEval {
  const isLive = match.mode === 'LIVE';
  const minute = isLive ? Math.max(1, Math.min(95, match.minute ?? 1)) : 0;
  const remainingFraction = isLive ? Math.max(0.02, (92 - minute) / 92) : 1;

  const homeScore = match.scoreHome ?? 0;
  const awayScore = match.scoreAway ?? 0;
  const totalScore = homeScore + awayScore;

  // Pre-match expected goals from team offensive/defensive rates
  const baseLambdaHome = (match.homeTeam.avgGoalsScored + match.awayTeam.avgGoalsConceded) / 2 * 1.08;
  const baseLambdaAway = (match.awayTeam.avgGoalsScored + match.homeTeam.avgGoalsConceded) / 2 * 0.94;

  // Live adjustment based on shots on target, dangerous attacks, and red cards
  let liveBoostHome = 1;
  let liveBoostAway = 1;
  if (isLive && match.liveStats) {
    const s = match.liveStats;
    const shotRatioHome = (s.shotsOnTargetHome + 1) / Math.max(1, minute / 18);
    const shotRatioAway = (s.shotsOnTargetAway + 1) / Math.max(1, minute / 18);
    liveBoostHome = Math.max(0.65, Math.min(1.45, 0.8 + shotRatioHome * 0.22)) * (s.redCardsAway > s.redCardsHome ? 1.25 : 1) * (s.redCardsHome > s.redCardsAway ? 0.68 : 1);
    liveBoostAway = Math.max(0.65, Math.min(1.45, 0.8 + shotRatioAway * 0.22)) * (s.redCardsHome > s.redCardsAway ? 1.25 : 1) * (s.redCardsAway > s.redCardsHome ? 0.68 : 1);
  }

  const remLambdaHome = Math.max(0.04, baseLambdaHome * remainingFraction * liveBoostHome);
  const remLambdaAway = Math.max(0.04, baseLambdaAway * remainingFraction * liveBoostAway);

  // Build 0..7 goal distribution matrix for remaining time
  let pHomeWin = 0;
  let pDraw = 0;
  let pAwayWin = 0;
  const totalGoalsProbs: Record<number, number> = {};
  let pBttsYes = 0;

  for (let gh = 0; gh <= 7; gh++) {
    const ph = poissonPMF(remLambdaHome, gh);
    for (let ga = 0; ga <= 7; ga++) {
      const pa = poissonPMF(remLambdaAway, ga);
      const p = ph * pa;
      const finalH = homeScore + gh;
      const finalA = awayScore + ga;
      const finalTot = finalH + finalA;

      if (finalH > finalA) pHomeWin += p;
      else if (finalH === finalA) pDraw += p;
      else pAwayWin += p;

      totalGoalsProbs[finalTot] = (totalGoalsProbs[finalTot] ?? 0) + p;
      if (finalH > 0 && finalA > 0) pBttsYes += p;
    }
  }

  // Bookmaker fair implied probability (removing ~5.5% typical margin)
  const rawImplied = (1 / Math.max(1.01, market.odds)) * 100;
  const bookmakerFairProb = clampProb(rawImplied * 0.948);

  const code = market.selectionCode.toUpperCase();
  let statProb = bookmakerFairProb;
  let isMathematicallySettled = false;
  let explanationAr = `تقدير بواسون المعاير (xG متبقي: ${remLambdaHome.toFixed(2)} - ${remLambdaAway.toFixed(2)})`;

  // Exact mathematical settlement checks for live matches
  if (market.category === 'total_goals' && market.line !== undefined) {
    if (code.includes('OVER') && totalScore > market.line && !code.includes('HOME') && !code.includes('AWAY') && !code.includes('1H') && !code.includes('2H')) {
      statProb = 100;
      isMathematicallySettled = true;
      explanationAr = `حُسم السوق حسابيًا بالنتيجة الحالية (${homeScore}-${awayScore}) لتجاوز خط ${market.line}.`;
    } else if (code.includes('HOME_OVER') && homeScore > market.line) {
      statProb = 100;
      isMathematicallySettled = true;
      explanationAr = `حُسم السوق حسابيًا بتسجيل أصحاب الأرض ${homeScore} أهداف.`;
    } else if (code.includes('AWAY_OVER') && awayScore > market.line) {
      statProb = 100;
      isMathematicallySettled = true;
      explanationAr = `حُسم السوق حسابيًا بتسجيل الضيوف ${awayScore} أهداف.`;
    } else if (!code.includes('HOME') && !code.includes('AWAY') && !code.includes('1H') && !code.includes('2H')) {
      let pOver = 0;
      for (const [totStr, p] of Object.entries(totalGoalsProbs)) {
        if (Number(totStr) > market.line) pOver += p;
      }
      statProb = clampProb((code.includes('OVER') ? pOver : 1 - pOver) * 100);
    }
  } else if (market.category === 'btts') {
    if (code === 'BTTS_YES' && homeScore > 0 && awayScore > 0) {
      statProb = 100;
      isMathematicallySettled = true;
      explanationAr = `سجّل الفريقان بالفعل (${homeScore}-${awayScore}) وبالتالي حُسم السوق.`;
    } else if (code === 'BTTS_NO' && homeScore > 0 && awayScore > 0) {
      statProb = 0;
      explanationAr = `خسر الخيار فعليًا بعد تسجيل كلا الفريقين.`;
    } else if (code === 'BTTS_YES') {
      statProb = clampProb(pBttsYes * 100);
    } else if (code === 'BTTS_NO') {
      statProb = clampProb((1 - pBttsYes) * 100);
    } else {
      statProb = clampProb(bookmakerFairProb * 0.6 + 22);
    }
  } else if (market.category === 'match_result') {
    if (code === '1') statProb = clampProb(pHomeWin * 100);
    else if (code === 'X') statProb = clampProb(pDraw * 100);
    else if (code === '2') statProb = clampProb(pAwayWin * 100);
    else if (code === '1X') statProb = clampProb((pHomeWin + pDraw) * 100);
    else if (code === 'X2') statProb = clampProb((pAwayWin + pDraw) * 100);
    else if (code === '12') statProb = clampProb((pHomeWin + pAwayWin) * 100);
    else if (code === 'DNB_HOME') statProb = clampProb((pHomeWin / Math.max(0.05, pHomeWin + pAwayWin)) * 100);
    else if (code === 'DNB_AWAY') statProb = clampProb((pAwayWin / Math.max(0.05, pHomeWin + pAwayWin)) * 100);
  } else if (market.category === 'handicap' && market.line !== undefined) {
    // Compute win/half-win probability from goal matrix
    let pCover = 0;
    const isHome = code.startsWith('AH_HOME') || code.startsWith('EH_HOME');
    for (let gh = 0; gh <= 6; gh++) {
      for (let ga = 0; ga <= 6; ga++) {
        const p = poissonPMF(remLambdaHome, gh) * poissonPMF(remLambdaAway, ga);
        const diff = isHome ? (homeScore + gh) - (awayScore + ga) : (awayScore + ga) - (homeScore + gh);
        if (diff + market.line > 0) pCover += p;
        else if (diff + market.line === 0) pCover += p * 0.5;
      }
    }
    statProb = clampProb(pCover * 100);
  } else if (market.category === 'corners' && market.line !== undefined) {
    const currentCorners = isLive && match.liveStats ? match.liveStats.cornersHome + match.liveStats.cornersAway : 0;
    const expCornersTotal = match.homeTeam.avgCornersFor + match.awayTeam.avgCornersFor;
    const remCornersLambda = Math.max(0.5, expCornersTotal * remainingFraction);
    if (code.includes('OVER') && currentCorners > market.line && !code.includes('1H')) {
      statProb = 100;
      isMathematicallySettled = true;
      explanationAr = `تم تنفيذ ${currentCorners} ركنية بالفعل وتجاوز خط ${market.line}.`;
    } else if (code.includes('CORNERS_OVER') || code.includes('CORNERS_UNDER')) {
      let pOver = 0;
      for (let c = 0; c <= 18; c++) {
        if (currentCorners + c > market.line) {
          pOver += poissonPMF(remCornersLambda, c);
        }
      }
      statProb = clampProb((code.includes('OVER') ? pOver : 1 - pOver) * 100);
      explanationAr = `توقع الركنيات الإجمالي: ${(currentCorners + remCornersLambda).toFixed(1)} ركنية.`;
    }
  } else if (market.category === 'cards' && market.line !== undefined) {
    const currentCards = isLive && match.liveStats
      ? match.liveStats.yellowCardsHome + match.liveStats.yellowCardsAway + (match.liveStats.redCardsHome + match.liveStats.redCardsAway) * 2
      : 0;
    const expCardsTotal = match.homeTeam.avgCardsFor + match.awayTeam.avgCardsFor;
    const remCardsLambda = Math.max(0.4, expCardsTotal * remainingFraction);
    if (code.includes('OVER') && currentCards > market.line) {
      statProb = 100;
      isMathematicallySettled = true;
      explanationAr = `بلغ إجمالي البطاقات الحالي ${currentCards} وتجاوز خط ${market.line}.`;
    } else {
      let pOver = 0;
      for (let c = 0; c <= 12; c++) {
        if (currentCards + c > market.line) pOver += poissonPMF(remCardsLambda, c);
      }
      statProb = clampProb((code.includes('OVER') ? pOver : 1 - pOver) * 100);
      explanationAr = `معدل البطاقات المتوقع للمباراة: ${(currentCards + remCardsLambda).toFixed(1)} بطاقة.`;
    }
  } else if (market.category === 'shots' && market.line !== undefined) {
    const currentSot = isLive && match.liveStats ? match.liveStats.shotsOnTargetHome + match.liveStats.shotsOnTargetAway : 0;
    const expSotTotal = match.homeTeam.avgShotsOnTarget + match.awayTeam.avgShotsOnTarget;
    const remSotLambda = Math.max(0.5, expSotTotal * remainingFraction);
    if (code.includes('OVER') && currentSot > market.line) {
      statProb = 100;
      isMathematicallySettled = true;
      explanationAr = `بلغت التسديدات على المرمى ${currentSot} وتجاوزت خط ${market.line}.`;
    } else {
      let pOver = 0;
      for (let s = 0; s <= 16; s++) {
        if (currentSot + s > market.line) pOver += poissonPMF(remSotLambda, s);
      }
      statProb = clampProb((code.includes('OVER') ? pOver : 1 - pOver) * 100);
    }
  } else {
    // Blend fair bookmaker probability with statistical stability factor for specialized markets
    statProb = clampProb(bookmakerFairProb * 0.96 + 1.2);
  }

  return {
    statisticalProb: isMathematicallySettled ? 100 : clampProb(statProb, false),
    bookmakerFairProb,
    isMathematicallySettled,
    explanationAr,
  };
}

function toFairOdds(probPercent: number): number {
  const safe = Math.max(2, Math.min(99.5, probPercent));
  return Number((100 / safe).toFixed(2));
}

function matchCatalogToLiveOption(
  catalogIndex: number,
  bestCodeHints: string[],
  availableMarkets: MarketOption[]
): MarketOption | undefined {
  if (availableMarkets.length === 0) return undefined;

  for (const hint of bestCodeHints) {
    const exact = availableMarkets.find((m) => m.selectionCode.toUpperCase() === hint.toUpperCase());
    if (exact) return exact;
  }

  if (catalogIndex === 1 || catalogIndex === 5) {
    const candidates = availableMarkets.filter((m) => m.category === 'match_result' && ['1', 'X', '2'].includes(m.selectionCode));
    return candidates.sort((a, b) => a.odds - b.odds)[0];
  }
  if (catalogIndex === 2) {
    const candidates = availableMarkets.filter((m) => m.category === 'match_result' && ['1X', 'X2', '12'].includes(m.selectionCode));
    return candidates.sort((a, b) => a.odds - b.odds)[0];
  }
  if (catalogIndex === 3) {
    const candidates = availableMarkets.filter((m) => m.category === 'match_result' && m.selectionCode.startsWith('DNB_'));
    return candidates.sort((a, b) => a.odds - b.odds)[0];
  }
  if (catalogIndex === 7) {
    const candidates = availableMarkets.filter((m) => m.category === 'total_goals' && (m.selectionCode.startsWith('OVER_') || m.selectionCode.startsWith('UNDER_')));
    return candidates.sort((a, b) => a.odds - b.odds)[0];
  }
  if (catalogIndex === 10) {
    const candidates = availableMarkets.filter((m) => m.category === 'btts');
    return candidates.sort((a, b) => a.odds - b.odds)[0];
  }
  if (catalogIndex === 11) {
    return availableMarkets.find((m) => m.selectionCode.startsWith('CS_'));
  }
  if (catalogIndex === 12) {
    const candidates = availableMarkets.filter((m) => m.category === 'handicap' && m.selectionCode.startsWith('AH_'));
    return candidates.sort((a, b) => a.odds - b.odds)[0];
  }
  if (catalogIndex === 25) {
    const candidates = availableMarkets.filter((m) => m.category === 'corners' && m.selectionCode.startsWith('CORNERS_'));
    return candidates.sort((a, b) => a.odds - b.odds)[0];
  }
  if (catalogIndex === 27) {
    return availableMarkets.find((m) => m.category === 'corners' && m.selectionCode.includes('MOST_CORNERS'));
  }
  if (catalogIndex === 28) {
    const candidates = availableMarkets.filter((m) => m.category === 'cards' && m.selectionCode.startsWith('CARDS_'));
    return candidates.sort((a, b) => a.odds - b.odds)[0];
  }
  if (catalogIndex === 30) {
    return availableMarkets.find((m) => m.category === 'player_props');
  }
  return undefined;
}

/**
 * Generates comprehensive 30-market 1xBet-style opportunity projections for any match.
 * Strictly separates verified live bookmaker quotes (LIVE_BOOKMAKER) from calculated
 * statistical fair odds (FAIR_MODEL) so bookmaker quotes are never fabricated.
 */
export function build30MarketProjections(match: MatchData): MarketProjectionItem[] {
  const isLive = match.mode === 'LIVE';
  const minute = isLive ? Math.max(1, Math.min(95, match.minute ?? 1)) : 0;
  const remainingFraction = isLive ? Math.max(0.02, (92 - minute) / 92) : 1;

  const homeScore = match.scoreHome ?? 0;
  const awayScore = match.scoreAway ?? 0;
  const totalScore = homeScore + awayScore;

  // Calibrate team expected goals, blending live bookmaker 1X2 & totals if present
  let baseLambdaHome = ((match.homeTeam.avgGoalsScored + match.awayTeam.avgGoalsConceded) / 2) * 1.08;
  let baseLambdaAway = ((match.awayTeam.avgGoalsScored + match.homeTeam.avgGoalsConceded) / 2) * 0.94;

  const opt1 = match.availableMarkets.find((m) => m.selectionCode === '1');
  const opt2 = match.availableMarkets.find((m) => m.selectionCode === '2');
  const optOver = match.availableMarkets.find((m) => m.category === 'total_goals' && m.selectionCode.startsWith('OVER_') && m.line !== undefined);

  if (opt1 && opt2) {
    const p1Fair = 1 / Math.max(1.03, opt1.odds);
    const p2Fair = 1 / Math.max(1.03, opt2.odds);
    const ratio = Math.max(0.45, Math.min(2.4, p1Fair / Math.max(0.05, p2Fair)));
    const avgTot = optOver && optOver.line ? Math.max(1.4, Math.min(3.8, optOver.line + (optOver.odds < 1.85 ? 0.35 : -0.25))) : (baseLambdaHome + baseLambdaAway);
    const bHome = avgTot * (ratio / (ratio + 1));
    const bAway = avgTot - bHome;
    baseLambdaHome = baseLambdaHome * 0.4 + bHome * 0.6;
    baseLambdaAway = baseLambdaAway * 0.4 + bAway * 0.6;
  }

  let liveBoostHome = 1;
  let liveBoostAway = 1;
  if (isLive && match.liveStats) {
    const s = match.liveStats;
    const shotRatioHome = (s.shotsOnTargetHome + 1) / Math.max(1, minute / 18);
    const shotRatioAway = (s.shotsOnTargetAway + 1) / Math.max(1, minute / 18);
    liveBoostHome =
      Math.max(0.68, Math.min(1.42, 0.82 + shotRatioHome * 0.2)) *
      (s.redCardsAway > s.redCardsHome ? 1.24 : 1) *
      (s.redCardsHome > s.redCardsAway ? 0.7 : 1);
    liveBoostAway =
      Math.max(0.68, Math.min(1.42, 0.82 + shotRatioAway * 0.2)) *
      (s.redCardsHome > s.redCardsAway ? 1.24 : 1) *
      (s.redCardsAway > s.redCardsHome ? 0.7 : 1);
  }

  const remLambdaHome = Math.max(0.05, baseLambdaHome * remainingFraction * liveBoostHome);
  const remLambdaAway = Math.max(0.05, baseLambdaAway * remainingFraction * liveBoostAway);

  // Full matrix on remaining goals (0..7)
  let pHomeWin = 0;
  let pDraw = 0;
  let pAwayWin = 0;
  let pBttsYes = 0;
  let pOddTotal = 0;
  let pZeroMoreGoals = poissonPMF(remLambdaHome, 0) * poissonPMF(remLambdaAway, 0);
  const exactTotalProbs: Record<number, number> = {};
  const exactScoreList: { h: number; a: number; p: number }[] = [];

  for (let gh = 0; gh <= 7; gh++) {
    const ph = poissonPMF(remLambdaHome, gh);
    for (let ga = 0; ga <= 7; ga++) {
      const pa = poissonPMF(remLambdaAway, ga);
      const p = ph * pa;
      const fh = homeScore + gh;
      const fa = awayScore + ga;
      const tot = fh + fa;
      if (fh > fa) pHomeWin += p;
      else if (fh === fa) pDraw += p;
      else pAwayWin += p;
      if (fh > 0 && fa > 0) pBttsYes += p;
      if (tot % 2 === 1) pOddTotal += p;
      exactTotalProbs[tot] = (exactTotalProbs[tot] ?? 0) + p;
      if (fh <= 5 && fa <= 5) {
        exactScoreList.push({ h: fh, a: fa, p });
      }
    }
  }
  exactScoreList.sort((a, b) => b.p - a.p);

  const homeAr = match.homeTeam.nameAr;
  const awayAr = match.awayTeam.nameAr;

  // Helpers for First Half probabilities
  const lh1h = isLive && minute >= 45 ? 0 : baseLambdaHome * 0.44;
  const la1h = isLive && minute >= 45 ? 0 : baseLambdaAway * 0.44;
  let p1hHome = 0;
  let p1hDraw = 0;
  let p1hAway = 0;
  for (let gh = 0; gh <= 4; gh++) {
    for (let ga = 0; ga <= 4; ga++) {
      const p = poissonPMF(lh1h, gh) * poissonPMF(la1h, ga);
      const cur1hH = match.htScoreHome ?? (isLive && minute < 45 ? homeScore : 0);
      const cur1hA = match.htScoreAway ?? (isLive && minute < 45 ? awayScore : 0);
      if (cur1hH + gh > cur1hA + ga) p1hHome += p;
      else if (cur1hH + gh === cur1hA + ga) p1hDraw += p;
      else p1hAway += p;
    }
  }

  // Corners expectations (always keep live line strictly ahead of current executed corners)
  const curCornersH = isLive && match.liveStats ? match.liveStats.cornersHome : 0;
  const curCornersA = isLive && match.liveStats ? match.liveStats.cornersAway : 0;
  const curCornersTot = curCornersH + curCornersA;
  const remCornersH = Math.max(0.25, match.homeTeam.avgCornersFor * remainingFraction);
  const remCornersA = Math.max(0.25, match.awayTeam.avgCornersFor * remainingFraction);
  const expTotalCorners = curCornersTot + remCornersH + remCornersA;
  const cornersLine = Math.max(curCornersTot + 0.5, Math.max(6.5, Math.floor(expTotalCorners) + 0.5));
  let pCornersOver = 0;
  for (let c = 0; c <= 20; c++) {
    if (curCornersTot + c > cornersLine) pCornersOver += poissonPMF(remCornersH + remCornersA, c);
  }

  // Cards expectations (always keep live line strictly ahead of current cards)
  const curCards = isLive && match.liveStats
    ? match.liveStats.yellowCardsHome + match.liveStats.yellowCardsAway
    : 0;
  const remCards = Math.max(0.2, (match.homeTeam.avgCardsFor + match.awayTeam.avgCardsFor) * remainingFraction);
  const cardsLine = Math.max(curCards + 0.5, Math.max(2.5, Math.floor(curCards + remCards) + 0.5));
  let pCardsOver = 0;
  for (let c = 0; c <= 14; c++) {
    if (curCards + c > cardsLine) pCardsOver += poissonPMF(remCards, c);
  }

  // Determine strongest team
  const homeFavored = pHomeWin >= pAwayWin;
  const favName = homeFavored ? homeAr : awayAr;
  const favRemLambda = homeFavored ? remLambdaHome : remLambdaAway;
  const favCurGoals = homeFavored ? homeScore : awayScore;
  const favDnbProb = homeFavored
    ? pHomeWin / Math.max(0.05, pHomeWin + pAwayWin)
    : pAwayWin / Math.max(0.05, pHomeWin + pAwayWin);

  // Pick a real attacking/top player name if roster/lineup is loaded
  const homePool = match.homeTeam.confirmedLineup?.length ? match.homeTeam.confirmedLineup : match.homeTeam.expectedLineup;
  const awayPool = match.awayTeam.confirmedLineup?.length ? match.awayTeam.confirmedLineup : match.awayTeam.expectedLineup;
  const starPlayer = homeFavored
    ? homePool[homePool.length - 1] || homePool[9] || homePool[0]
    : awayPool[awayPool.length - 1] || awayPool[9] || awayPool[0];

  const projections: MarketProjectionItem[] = [];

  for (const spec of BOOKMAKER_30_MARKETS) {
    let bestSelectionAr = '';
    let codeHints: string[] = [];
    let rawProb = 50;
    let rationaleAr = '';

    switch (spec.index) {
      case 1: // Match Result (1X2)
      case 5: { // Full Time Result
        const best1X2 = [
          { code: '1', label: `فوز ${homeAr} (1)`, p: pHomeWin },
          { code: 'X', label: 'التعادل (X)', p: pDraw },
          { code: '2', label: `فوز ${awayAr} (2)`, p: pAwayWin },
        ].sort((a, b) => b.p - a.p)[0];
        bestSelectionAr = best1X2.label;
        codeHints = [best1X2.code];
        rawProb = best1X2.p * 100;
        rationaleAr = `توزيع الاحتمال: ${homeAr} ${(pHomeWin * 100).toFixed(1)}% · تعادل ${(pDraw * 100).toFixed(1)}% · ${awayAr} ${(pAwayWin * 100).toFixed(1)}%`;
        break;
      }
      case 2: { // Double Chance
        const dcOptions = [
          { code: '1X', label: `${homeAr} أو التعادل (1X)`, p: pHomeWin + pDraw },
          { code: 'X2', label: `${awayAr} أو التعادل (X2)`, p: pAwayWin + pDraw },
          { code: '12', label: `فوز أحد الفريقين (12)`, p: pHomeWin + pAwayWin },
        ].sort((a, b) => b.p - a.p)[0];
        bestSelectionAr = dcOptions.label;
        codeHints = [dcOptions.code];
        rawProb = dcOptions.p * 100;
        rationaleAr = `فرصة مزدوجة تحمي من نتيجة التعادل وفق معدل xG المتبقي (${remLambdaHome.toFixed(2)} - ${remLambdaAway.toFixed(2)}).`;
        break;
      }
      case 3: { // Draw No Bet
        bestSelectionAr = `${favName} (التعادل لا رهان DNB)`;
        codeHints = [homeFavored ? 'DNB_HOME' : 'DNB_AWAY'];
        rawProb = favDnbProb * 100;
        rationaleAr = `احتمال التفوق مع استرداد الرهان في حال التعادل عند صافرة النهاية.`;
        break;
      }
      case 4: { // Half Time Result
        if (isLive && minute >= 45) {
          if (match.htScoreHome !== null && match.htScoreAway !== null) {
            const htH = match.htScoreHome;
            const htA = match.htScoreAway;
            bestSelectionAr =
              htH > htA
                ? `انتهى الشوط 1 بتقدم ${homeAr} (${htH}-${htA})`
                : htA > htH
                ? `انتهى الشوط 1 بتقدم ${awayAr} (${htH}-${htA})`
                : `انتهى الشوط 1 بالتعادل (${htH}-${htA})`;
            rawProb = 100;
            rationaleAr = `سوق الشوط الأول محسوم فعليًا بنهاية الدقيقة 45.`;
          } else {
            bestSelectionAr = `سوق الشوط الأول منتهٍ (المباراة في الشوط 2)`;
            rawProb = 50;
            rationaleAr = `انتهى الشوط الأول بالفعل ولم تعد المراهنة عليه متاحة حاليًا.`;
          }
        } else {
          const htBest = [
            { label: `${homeAr} أو التعادل — الشوط 1`, p: p1hHome + p1hDraw },
            { label: `تقدم ${homeAr} — الشوط 1`, p: p1hHome },
            { label: `تعادل الشوط الأول`, p: p1hDraw },
            { label: `تقدم ${awayAr} — الشوط 1`, p: p1hAway },
          ].sort((a, b) => b.p - a.p)[0];
          bestSelectionAr = htBest.label;
          codeHints = ['1H_X', '1H_1', '1H_2'];
          rawProb = htBest.p * 100;
          rationaleAr = `تقدير إيقاع الشوط الأول بناءً على متوسط التسجيل في الدقائق الـ 45 الأولى.`;
        }
        break;
      }
      case 6: { // Half Time / Full Time
        const htFtProb = homeFavored ? p1hHome * pHomeWin * 1.15 : p1hAway * pAwayWin * 1.15;
        bestSelectionAr = homeFavored ? `${homeAr} / ${homeAr}` : `${awayAr} / ${awayAr}`;
        rawProb = Math.max(18, Math.min(62, htFtProb * 100));
        rationaleAr = `سيناريو حسم الشوط الأول والمحافظة على التقدم حتى نهاية اللقاء.`;
        break;
      }
      case 7: { // Over/Under (dynamically adapts line above current live score)
        const liveOv = match.availableMarkets.find(
          (m) =>
            m.category === 'total_goals' &&
            (m.selectionCode.startsWith('OVER_') || m.selectionCode.startsWith('UNDER_')) &&
            m.line !== undefined &&
            (!isLive || m.line > totalScore)
        );
        if (liveOv && liveOv.line !== undefined) {
          let pOv = 0;
          for (const [totStr, p] of Object.entries(exactTotalProbs)) {
            if (Number(totStr) > liveOv.line) pOv += p;
          }
          const isOvBest = pOv >= 0.5;
          bestSelectionAr = `${isOvBest ? 'أكثر من' : 'أقل من'} ${liveOv.line} هدف`;
          codeHints = [`${isOvBest ? 'OVER' : 'UNDER'}_${liveOv.line}`];
          rawProb = (isOvBest ? pOv : 1 - pOv) * 100;
          rationaleAr = `خط السوق الفعلي (${liveOv.line}) مقابل توقع بواسون الإجمالي ${(totalScore + remLambdaHome + remLambdaAway).toFixed(2)} هدف.`;
        } else {
          const projTotal = totalScore + remLambdaHome + remLambdaAway;
          const line = Math.max(totalScore + 0.5, isLive ? totalScore + 1.5 : projTotal >= 2.2 ? 1.5 : 3.5);
          let pOver = 0;
          for (const [totStr, p] of Object.entries(exactTotalProbs)) {
            if (Number(totStr) > line) pOver += p;
          }
          const isOver = pOver >= 0.5;
          bestSelectionAr = `${isOver ? 'أكثر من' : 'أقل من'} ${line} هدف`;
          codeHints = [`${isOver ? 'OVER' : 'UNDER'}_${line}`];
          rawProb = (isOver ? pOver : 1 - pOver) * 100;
          rationaleAr = `خط حي متكيف مع النتيجة (${homeScore}-${awayScore}) · توقع النهاية ${projTotal.toFixed(2)} هدف.`;
        }
        break;
      }
      case 8: // Individual Total
      case 16: { // Team Total
        const pTeamOv05 = (1 - poissonPMF(favRemLambda, 0)) * 100;
        const alreadyScored = favCurGoals >= 1;
        bestSelectionAr = `${favName}: أكثر من ${favCurGoals >= 1 ? favCurGoals + 0.5 : 0.5} هدف`;
        codeHints = [homeFavored ? 'HOME_OVER_0.5' : 'AWAY_OVER_0.5'];
        rawProb = alreadyScored && spec.index === 8 ? (1 - poissonPMF(favRemLambda, 0)) * 100 : alreadyScored ? 99 : pTeamOv05;
        rationaleAr = `متوسط خطورة ${favName} المتبقي (${favRemLambda.toFixed(2)} xG).`;
        break;
      }
      case 9: { // Total (Odd/Even)
        const evenProb = (1 - pOddTotal) * 100;
        const chooseEven = evenProb >= pOddTotal * 100;
        bestSelectionAr = chooseEven ? 'مجموع الأهداف: زوجي (Even)' : 'مجموع الأهداف: فردي (Odd)';
        rawProb = chooseEven ? evenProb : pOddTotal * 100;
        rationaleAr = `توزيع الاحتمال الرياضي للنتيجة النهائية الزوجية (${evenProb.toFixed(1)}%) مقابل الفردية.`;
        break;
      }
      case 10: { // Both Teams To Score
        const bttsYesPct = pBttsYes * 100;
        const chooseYes = bttsYesPct >= 50;
        bestSelectionAr = chooseYes ? 'كلا الفريقين يسجل: نعم (BTTS Yes)' : 'كلا الفريقين يسجل: لا (BTTS No)';
        codeHints = [chooseYes ? 'BTTS_YES' : 'BTTS_NO'];
        rawProb = chooseYes ? bttsYesPct : 100 - bttsYesPct;
        rationaleAr = `احتمال تسجيل الطرفين معا هو ${bttsYesPct.toFixed(1)}% وفق القوة الهجومية والدفاعية.`;
        break;
      }
      case 11: { // Correct Score
        const topCS = exactScoreList[0] || { h: 1, a: 0, p: 0.14 };
        bestSelectionAr = `النتيجة الصحيحة الأكثر ترجيحًا: ${topCS.h} - ${topCS.a}`;
        codeHints = [`CS_${topCS.h}_${topCS.a}`];
        rawProb = topCS.p * 100;
        const runner = exactScoreList[1];
        rationaleAr = runner
          ? `ثاني أعلى نتيجة محتملة: ${runner.h}-${runner.a} (${(runner.p * 100).toFixed(1)}%).`
          : `أعلى نقطة كثافة في مصفوفة بواسون.`;
        break;
      }
      case 12: { // Asian Handicap
        const liveAh = match.availableMarkets.find((m) => m.category === 'handicap' && m.line !== undefined);
        if (liveAh && liveAh.line !== undefined) {
          const isH = liveAh.selectionCode.includes('HOME');
          let pCover = 0;
          for (let gh = 0; gh <= 6; gh++) {
            for (let ga = 0; ga <= 6; ga++) {
              const p = poissonPMF(remLambdaHome, gh) * poissonPMF(remLambdaAway, ga);
              const diff = isH ? (homeScore + gh) - (awayScore + ga) : (awayScore + ga) - (homeScore + gh);
              if (diff + liveAh.line > 0) pCover += p;
              else if (diff + liveAh.line === 0) pCover += p * 0.5;
            }
          }
          bestSelectionAr = liveAh.selectionAr;
          codeHints = [liveAh.selectionCode];
          rawProb = pCover * 100;
          rationaleAr = `تغطية خط الهاندكاب الآسيوي (${liveAh.line > 0 ? `+${liveAh.line}` : liveAh.line}) بناءً على فارق الأهداف المتوقع.`;
        } else {
          const pAhPlus05 = (homeFavored ? pHomeWin + pDraw : pAwayWin + pDraw) * 100;
          bestSelectionAr = `${favName} (+0.5 هاندكاب آسيوي)`;
          rawProb = pAhPlus05;
          rationaleAr = `حماية كاملة في حالتي الفوز أو التعادل.`;
        }
        break;
      }
      case 13: // European Handicap
      case 14: { // Handicap Result
        const pEhPlus1 = (homeFavored ? pHomeWin + pDraw : pAwayWin + pDraw) * 100;
        bestSelectionAr = `${favName} (+1 هاندكاب أوروبي)`;
        rawProb = pEhPlus1;
        rationaleAr = `الفريق المرشح يبدأ بأفضلية هدف واحد في التسوية الأوروبية الثلاثية.`;
        break;
      }
      case 15: { // Total In Interval
        const p1to3 = ((exactTotalProbs[1] ?? 0) + (exactTotalProbs[2] ?? 0) + (exactTotalProbs[3] ?? 0)) * 100;
        const p2to4 = ((exactTotalProbs[2] ?? 0) + (exactTotalProbs[3] ?? 0) + (exactTotalProbs[4] ?? 0)) * 100;
        const choose1to3 = p1to3 >= p2to4;
        bestSelectionAr = choose1to3 ? 'نطاق الأهداف: من 1 إلى 3 أهداف' : 'نطاق الأهداف: من 2 إلى 4 أهداف';
        rawProb = Math.max(p1to3, p2to4);
        rationaleAr = `أعلى نطاق إجمالي في توزيع بواسون (${Math.max(p1to3, p2to4).toFixed(1)}%).`;
        break;
      }
      case 17: { // First Team To Score
        if (totalScore > 0) {
          const firstGoal = match.liveEvents?.find((e) => e.type === 'GOAL');
          if (firstGoal) {
            bestSelectionAr = `سجل أولاً بالفعل: ${firstGoal.team === 'HOME' ? homeAr : awayAr}`;
            rawProb = 100;
            rationaleAr = `تم حسم السوق فعليًا في الدقيقة ${firstGoal.minute}'.`;
            break;
          }
          if ((homeScore > 0 && awayScore === 0) || (awayScore > 0 && homeScore === 0)) {
            bestSelectionAr = `سجل أولاً بالفعل: ${homeScore > 0 ? homeAr : awayAr}`;
            rawProb = 100;
            rationaleAr = `حُسم بالنتيجة الحالية (${homeScore}-${awayScore}).`;
            break;
          }
        }
        const totalRem = remLambdaHome + remLambdaAway;
        const pFirstHome = (remLambdaHome / Math.max(0.1, totalRem)) * (1 - pZeroMoreGoals);
        const pFirstAway = (remLambdaAway / Math.max(0.1, totalRem)) * (1 - pZeroMoreGoals);
        const homeFirst = pFirstHome >= pFirstAway;
        bestSelectionAr = `أول فريق يسجل: ${homeFirst ? homeAr : awayAr}`;
        rawProb = Math.max(pFirstHome, pFirstAway) * 100;
        rationaleAr = `تقييم سرعة المبادرة الهجومية وتوقعات الهدف الأول.`;
        break;
      }
      case 18: { // Last Team To Score
        const totalRem = remLambdaHome + remLambdaAway;
        const pLastHome = (remLambdaHome / Math.max(0.1, totalRem)) * (1 - pZeroMoreGoals);
        const pLastAway = (remLambdaAway / Math.max(0.1, totalRem)) * (1 - pZeroMoreGoals);
        const homeLast = pLastHome >= pLastAway;
        bestSelectionAr = `آخر فريق يسجل: ${homeLast ? homeAr : awayAr}`;
        codeHints = [homeLast ? 'LAST_HOME' : 'LAST_AWAY'];
        rawProb = Math.max(pLastHome, pLastAway) * 100;
        rationaleAr = `القدرة التهديفية المتبقية حتى الدقائق الأخيرة.`;
        break;
      }
      case 19: { // Next Goal (advances dynamically as goals are scored)
        const nextGoalNum = totalScore + 1;
        const totalRem = remLambdaHome + remLambdaAway;
        const pNextHome = (remLambdaHome / Math.max(0.1, totalRem)) * (1 - pZeroMoreGoals);
        const pNextAway = (remLambdaAway / Math.max(0.1, totalRem)) * (1 - pZeroMoreGoals);
        const nextIsNoGoal = pZeroMoreGoals > Math.max(pNextHome, pNextAway);
        bestSelectionAr = nextIsNoGoal
          ? `الهدف رقم ${nextGoalNum}: لا أهداف أخرى`
          : `الهدف رقم ${nextGoalNum}: ${pNextHome >= pNextAway ? homeAr : awayAr}`;
        rawProb = Math.max(pZeroMoreGoals, pNextHome, pNextAway) * 100;
        rationaleAr = `فرصة تسجيل الهدف #${nextGoalNum} خلال الوقت المتبقي (${Math.max(1, Math.round(remainingFraction * 90))} دقيقة تقريبًا).`;
        break;
      }
      case 20: { // No Goal
        const pAtLeastOneGoal = (1 - pZeroMoreGoals) * 100;
        const chooseNoMore = pZeroMoreGoals * 100 >= 50;
        bestSelectionAr = chooseNoMore ? 'عدم تسجيل أهداف (نعم)' : 'تسجيل هدف واحد على الأقل (عكس No Goal)';
        rawProb = chooseNoMore ? pZeroMoreGoals * 100 : pAtLeastOneGoal;
        rationaleAr = `احتمال بقاء النتيجة دون أهداف إضافية يبلغ ${(pZeroMoreGoals * 100).toFixed(1)}%.`;
        break;
      }
      case 21: { // Winning Margin
        let pBy1 = 0;
        let pDrawMargin = 0;
        for (let gh = 0; gh <= 5; gh++) {
          for (let ga = 0; ga <= 5; ga++) {
            const p = poissonPMF(remLambdaHome, gh) * poissonPMF(remLambdaAway, ga);
            const diff = Math.abs(homeScore + gh - (awayScore + ga));
            if (diff === 1) pBy1 += p;
            if (diff === 0) pDrawMargin += p;
          }
        }
        const choose1 = pBy1 >= pDrawMargin;
        bestSelectionAr = choose1 ? `فوز ${favName} بفارق هدف واحد` : 'التعادل (فارق 0 أهداف)';
        rawProb = Math.max(pBy1, pDrawMargin) * 100;
        rationaleAr = `احتمال الحسم بفارق هدف وحيد (${(pBy1 * 100).toFixed(1)}%) مقابل التعادل.`;
        break;
      }
      case 22: { // Exact Number Of Goals
        const topTot = Object.entries(exactTotalProbs).sort((a, b) => b[1] - a[1])[0] || ['2', 0.26];
        bestSelectionAr = `العدد الدقيق للأهداف: ${topTot[0]} أهداف`;
        rawProb = Number(topTot[1]) * 100;
        rationaleAr = `الرقم الأكثر تكرارًا في محاكاة بواسون لمجمل أهداف اللقاء.`;
        break;
      }
      case 23: { // Goal In Both Halves
        const pGoal1H = 1 - Math.exp(-(baseLambdaHome + baseLambdaAway) * 0.44);
        const pGoal2H = 1 - Math.exp(-(baseLambdaHome + baseLambdaAway) * 0.56);
        const pBothHalves = pGoal1H * pGoal2H * 100;
        const chooseYes = pBothHalves >= 50;
        bestSelectionAr = chooseYes ? 'هدف في كلا الشوطين: نعم' : 'هدف في كلا الشوطين: لا';
        rawProb = chooseYes ? pBothHalves : 100 - pBothHalves;
        rationaleAr = `احتمال الشوط الأول ${(pGoal1H * 100).toFixed(0)}% × الشوط الثاني ${(pGoal2H * 100).toFixed(0)}%.`;
        break;
      }
      case 24: { // Team To Score In Both Halves
        const pT1H = 1 - Math.exp(-baseLambdaHome * 0.44);
        const pT2H = 1 - Math.exp(-baseLambdaHome * 0.56);
        const pYes = (homeFavored ? pT1H * pT2H : (1 - Math.exp(-baseLambdaAway * 0.44)) * (1 - Math.exp(-baseLambdaAway * 0.56))) * 100;
        bestSelectionAr = `${favName} يسجل في كلا الشوطين: لا (خيار محافظ)`;
        rawProb = Math.max(55, 100 - pYes);
        rationaleAr = `احتمال تسجيل الفريق في الشوطين معًا محدود نسبيًا (${pYes.toFixed(1)}%) مما يرجح خيار لا.`;
        break;
      }
      case 25: { // Corners Total
        const chooseOver = pCornersOver >= 0.5;
        bestSelectionAr = `${chooseOver ? 'أكثر من' : 'أقل من'} ${cornersLine} ركنية`;
        codeHints = [`CORNERS_${chooseOver ? 'OVER' : 'UNDER'}_${cornersLine}`];
        rawProb = (chooseOver ? pCornersOver : 1 - pCornersOver) * 100;
        rationaleAr = `معدل الركنيات المتوقع للفريقين معًا ${expTotalCorners.toFixed(1)} ركنية.`;
        break;
      }
      case 26: { // Corners Handicap
        const hCorn = curCornersH + remCornersH;
        const aCorn = curCornersA + remCornersA;
        const hLead = hCorn >= aCorn;
        bestSelectionAr = `${hLead ? homeAr : awayAr} (+1.5 ركنيات)`;
        rawProb = Math.min(82, Math.max(54, 62 + Math.abs(hCorn - aCorn) * 5));
        rationaleAr = `معدل ركنيات ${homeAr} (${match.homeTeam.avgCornersFor}) مقابل ${awayAr} (${match.awayTeam.avgCornersFor}).`;
        break;
      }
      case 27: { // Corners Result
        const hCorn = curCornersH + remCornersH;
        const aCorn = curCornersA + remCornersA;
        const hLead = hCorn >= aCorn;
        bestSelectionAr = `الأكثر ركنيات: ${hLead ? homeAr : awayAr}`;
        codeHints = [hLead ? 'MOST_CORNERS_HOME' : 'MOST_CORNERS_AWAY'];
        rawProb = Math.min(78, Math.max(44, 52 + Math.abs(hCorn - aCorn) * 6));
        rationaleAr = `تفوق نسبي متوقع في الضغط العرضي وحجم التسديدات.`;
        break;
      }
      case 28: { // Yellow Cards Total
        const chooseOver = pCardsOver >= 0.5;
        bestSelectionAr = `${chooseOver ? 'أكثر من' : 'أقل من'} ${cardsLine} بطاقة صفراء`;
        codeHints = [`CARDS_${chooseOver ? 'OVER' : 'UNDER'}_${cardsLine}`];
        rawProb = (chooseOver ? pCardsOver : 1 - pCardsOver) * 100;
        rationaleAr = `إجمالي الإنذارات المتوقع ${(curCards + remCards).toFixed(1)} بطاقة بناءً على انضباط الفريقين.`;
        break;
      }
      case 29: { // Red Card – Yes/No
        const alreadyRed = Boolean(isLive && match.liveStats && match.liveStats.redCardsHome + match.liveStats.redCardsAway > 0);
        if (alreadyRed) {
          bestSelectionAr = 'بطاقة حمراء في المباراة: نعم (محسوم)';
          rawProb = 100;
          rationaleAr = `أُشهرت بطاقة حمراء بالفعل خلال أحداث اللقاء.`;
        } else {
          const redNoProb = Math.max(72, Math.min(89, 86 - (match.homeTeam.avgCardsFor + match.awayTeam.avgCardsFor) * 1.4));
          bestSelectionAr = 'بطاقة حمراء في المباراة: لا (No)';
          rawProb = redNoProb;
          rationaleAr = `المعدل التاريخي لحالات الطرد في المباريات الاعتيادية منخفض (~14–20%).`;
        }
        break;
      }
      case 30: // Player To Score Anytime
      default: {
        const liveOpt = match.availableMarkets.find((m) => m.category === 'player_props');
        if (liveOpt) {
          bestSelectionAr = liveOpt.selectionAr;
          codeHints = [liveOpt.selectionCode];
          rawProb = clampProb((1 / liveOpt.odds) * 94.8);
          rationaleAr = `مرشح هجومي مباشر بناءً على قائمة الفريق وتوفر سعر السوق.`;
        } else if (starPlayer) {
          bestSelectionAr = `${starPlayer} يسجل في أي وقت`;
          rawProb = Math.max(24, Math.min(48, favRemLambda * 24));
          rationaleAr = `اسم لاعب حقيقي من قائمة ${favName} المتاحة بالبيانات (يتوقف على بدء اللاعب أساسيًا).`;
        } else {
          bestSelectionAr = `مهاجم ${favName} الأساسي (بانتظار إعلان التشكيلة)`;
          rawProb = Math.max(22, Math.min(42, favRemLambda * 21));
          rationaleAr = `لم تُصدر التشكيلة الرسمية بعد في المصدر؛ التقدير مبدئي لحين تأكيد الأساسيين.`;
        }
        break;
      }
    }

    const matchedLive = matchCatalogToLiveOption(spec.index, codeHints, match.availableMarkets);
    const finalProb = rawProb >= 99.5 ? 100 : clampProb(rawProb, false);
    const fairReferenceOdds = toFairOdds(finalProb);

    projections.push({
      rank: spec.index,
      catalogIndex: spec.index,
      catalogNameEn: spec.nameEn,
      category: spec.category,
      bestSelectionAr,
      estimatedProbability: finalProb,
      fairReferenceOdds,
      liveBookmakerOdds: matchedLive?.odds,
      previousBookmakerOdds: matchedLive?.previousOdds,
      oddsDirection: matchedLive?.oddsDirection,
      bookmakerName: matchedLive?.bookmakerName,
      sourceKind: matchedLive ? 'LIVE_BOOKMAKER' : 'FAIR_MODEL',
      settlementRule: matchedLive?.settlementRule ?? spec.settlementRule,
      rationaleAr,
    });
  }

  // Sort by highest probability; tie-break preferring live bookmaker markets
  projections.sort((a, b) => {
    if (b.estimatedProbability !== a.estimatedProbability) {
      return b.estimatedProbability - a.estimatedProbability;
    }
    if (a.sourceKind !== b.sourceKind) {
      return a.sourceKind === 'LIVE_BOOKMAKER' ? -1 : 1;
    }
    return a.catalogIndex - b.catalogIndex;
  });

  return projections.map((p, idx) => ({ ...p, rank: idx + 1 }));
}

/**
 * Generates real-time, event-driven & time-decay live opportunities whenever
 * the match clock advances, live stats surge, cards/goals happen, or live odds move.
 */
export function generateLiveDynamicSignals(match: MatchData): LiveDynamicSignal[] {
  if (match.mode !== 'LIVE') return [];

  const minute = Math.max(1, Math.min(95, match.minute ?? 1));
  const homeScore = match.scoreHome ?? 0;
  const awayScore = match.scoreAway ?? 0;
  const totalScore = homeScore + awayScore;
  const remainingFraction = Math.max(0.02, (92 - minute) / 92);
  const nowIso = new Date().toISOString();

  const homeAr = match.homeTeam.nameAr;
  const awayAr = match.awayTeam.nameAr;
  const baseLamH = ((match.homeTeam.avgGoalsScored + match.awayTeam.avgGoalsConceded) / 2) * 1.08;
  const baseLamA = ((match.awayTeam.avgGoalsScored + match.homeTeam.avgGoalsConceded) / 2) * 0.94;
  const remLamH = Math.max(0.05, baseLamH * remainingFraction);
  const remLamA = Math.max(0.05, baseLamA * remainingFraction);

  const signals: LiveDynamicSignal[] = [];

  // 1. Live Bookmaker Odds Steam / Sharp Drop Alert
  const steamDown = match.availableMarkets
    .filter((m) => m.oddsDirection === 'DOWN' && m.previousOdds !== undefined)
    .sort((a, b) => (b.previousOdds! - b.odds) - (a.previousOdds! - a.odds))[0];

  if (steamDown && steamDown.previousOdds) {
    const fairProb = clampProb((1 / steamDown.odds) * 94.8, false);
    signals.push({
      id: `sig-steam-${match.id}-${steamDown.id}`,
      minute,
      triggerType: 'ODDS_STEAM',
      titleAr: `تحرك سريع في الأود المباشر (${steamDown.bookmakerName})`,
      descriptionAr: `انخفض أود "${steamDown.selectionAr}" من ${steamDown.previousOdds.toFixed(2)} إلى ${steamDown.odds.toFixed(2)} بفعل السيولة المباشرة وتطورات الملعب.`,
      suggestedMarketAr: steamDown.selectionAr,
      estimatedProbability: fairProb,
      referenceOdds: steamDown.odds,
      isLiveBookmakerOdds: true,
      createdAt: nowIso,
    });
  }

  // 2. Red Card Tactical Shift
  const s = match.liveStats;
  if (s && s.redCardsHome !== s.redCardsAway) {
    const advantaged = s.redCardsAway > s.redCardsHome ? homeAr : awayAr;
    const pGoalAdv = clampProb((1 - Math.exp(-(s.redCardsAway > s.redCardsHome ? remLamH * 1.35 : remLamA * 1.35))) * 100, false);
    signals.push({
      id: `sig-red-${match.id}-${minute}`,
      minute,
      triggerType: 'RED_CARD_IMPACT',
      titleAr: `طرد مؤثر يمنح ${advantaged} تفوقًا عدديًا`,
      descriptionAr: `بعد حالة الطرد المسجلة في المباراة، ترتفع فرص ${advantaged} الهجومية في الدقائق المتبقية.`,
      suggestedMarketAr: `${advantaged} يسجل الهدف التالي أو فوز/تعادل`,
      estimatedProbability: Math.max(60, pGoalAdv),
      referenceOdds: toFairOdds(Math.max(60, pGoalAdv)),
      isLiveBookmakerOdds: false,
      createdAt: nowIso,
    });
  }

  // 3. Recent Goal / Scoreline Equilibrium Shift
  const latestGoal = [...(match.liveEvents || [])].reverse().find((e) => e.type === 'GOAL');
  if (latestGoal || totalScore > 0) {
    const leadTeam = homeScore > awayScore ? homeAr : awayScore > homeScore ? awayAr : null;
    const nextLine = totalScore + 1.5;
    let pUnderNext = 0;
    for (let gh = 0; gh <= 5; gh++) {
      for (let ga = 0; ga <= 5; ga++) {
        if (totalScore + gh + ga < nextLine) {
          pUnderNext += poissonPMF(remLamH, gh) * poissonPMF(remLamA, ga);
        }
      }
    }
    const probPct = clampProb(pUnderNext * 100, false);
    signals.push({
      id: `sig-goal-${match.id}-${totalScore}`,
      minute,
      triggerType: 'GOAL_SHIFT',
      titleAr: latestGoal
        ? `طرح ما بعد الهدف (${latestGoal.player} · د ${latestGoal.minute}')`
        : `قراءة النتيجة الحية (${homeScore}-${awayScore})`,
      descriptionAr: leadTeam
        ? `تقدّم ${leadTeam} يعيد تسعير خطوط الأهداف والهاندكاب مع تبقي ${Math.max(1, 90 - minute)} دقيقة.`
        : `التعادل (${homeScore}-${awayScore}) يرفع وتيرة اللعب المفتوح حتى الدقيقة ${minute}'.`,
      suggestedMarketAr: `أقل من ${nextLine} هدف`,
      estimatedProbability: probPct,
      referenceOdds: toFairOdds(probPct),
      isLiveBookmakerOdds: false,
      createdAt: nowIso,
    });
  }

  // 4. Time-Decay Opportunity (Every phase of the match proposes a fresh time-calibrated option)
  const underNextGoalLine = totalScore + 1.5;
  let pUnderDecay = 0;
  for (let gh = 0; gh <= 5; gh++) {
    for (let ga = 0; ga <= 5; ga++) {
      if (totalScore + gh + ga < underNextGoalLine) {
        pUnderDecay += poissonPMF(remLamH, gh) * poissonPMF(remLamA, ga);
      }
    }
  }
  const timeProb = clampProb(pUnderDecay * 100, false);
  const phaseLabel =
    minute >= 75
      ? 'المرحلة الحاسمة (آخر 15 دقيقة)'
      : minute >= 45
      ? 'تقدم الشوط الثاني وتناقص الوقت المتبقي'
      : 'قراءة الشوط الأول وتناقص الزمن';

  signals.push({
    id: `sig-time-${match.id}-${Math.floor(minute / 5)}`,
    minute,
    triggerType: 'TIME_DECAY',
    titleAr: `${phaseLabel} · د ${minute}'`,
    descriptionAr: `مع الوصول للدقيقة ${minute}'، ينخفض معامل الأهداف المتبقي إلى ${(remLamH + remLamA).toFixed(2)} xG ما يعزز قراءة خط ${underNextGoalLine}.`,
    suggestedMarketAr: `أقل من ${underNextGoalLine} هدف (متكيف مع الدقيقة ${minute}')`,
    estimatedProbability: timeProb,
    referenceOdds: toFairOdds(timeProb),
    isLiveBookmakerOdds: false,
    createdAt: nowIso,
  });

  // 5. Corners Tempo Surge
  if (s) {
    const curCorners = s.cornersHome + s.cornersAway;
    const pacePerMin = curCorners / Math.max(10, minute);
    const projectedCorners = curCorners + pacePerMin * Math.max(0, 90 - minute);
    const activeCornerLine = curCorners + 1.5;
    let pOverCorn = 0;
    const remCornLam = Math.max(0.4, (match.homeTeam.avgCornersFor + match.awayTeam.avgCornersFor) * remainingFraction * (pacePerMin > 0.12 ? 1.15 : 0.95));
    for (let c = 0; c <= 16; c++) {
      if (curCorners + c > activeCornerLine) pOverCorn += poissonPMF(remCornLam, c);
    }
    const overCornPct = clampProb(pOverCorn * 100, false);
    const underCornPct = clampProb((1 - pOverCorn) * 100, false);
    const pickOver = overCornPct >= underCornPct;

    signals.push({
      id: `sig-corners-${match.id}-${curCorners}`,
      minute,
      triggerType: 'CORNER_SURGE',
      titleAr: `مؤشر رتم الركنيات (${curCorners} ركنية حتى د ${minute}')`,
      descriptionAr: `المعدل الحالي يتجه نحو ${projectedCorners.toFixed(1)} ركنية بنهاية المباراة (${s.cornersHome} لـ ${homeAr} · ${s.cornersAway} لـ ${awayAr}).`,
      suggestedMarketAr: `${pickOver ? 'أكثر من' : 'أقل من'} ${activeCornerLine} ركنية`,
      estimatedProbability: Math.max(overCornPct, underCornPct),
      referenceOdds: toFairOdds(Math.max(overCornPct, underCornPct)),
      isLiveBookmakerOdds: false,
      createdAt: nowIso,
    });
  }

  // 6. Card Tension Signal
  if (s && s.yellowCardsHome + s.yellowCardsAway >= 2) {
    const curY = s.yellowCardsHome + s.yellowCardsAway;
    const lineY = curY + 1.5;
    const remY = Math.max(0.3, (match.homeTeam.avgCardsFor + match.awayTeam.avgCardsFor) * remainingFraction);
    let pOverY = 0;
    for (let c = 0; c <= 12; c++) {
      if (curY + c > lineY) pOverY += poissonPMF(remY, c);
    }
    const bestPct = clampProb(Math.max(pOverY, 1 - pOverY) * 100, false);
    signals.push({
      id: `sig-cards-${match.id}-${curY}`,
      minute,
      triggerType: 'CARD_TENSION',
      titleAr: `إيقاع البطاقات (${curY} صفراء مسجلة)`,
      descriptionAr: `ارتفاع الالتحامات (${curY} بطاقات صفراء) يفتح خطًا حيًا جديدًا للإنذارات المتبقية.`,
      suggestedMarketAr: `${pOverY >= 0.5 ? 'أكثر من' : 'أقل من'} ${lineY} بطاقة صفراء`,
      estimatedProbability: bestPct,
      referenceOdds: toFairOdds(bestPct),
      isLiveBookmakerOdds: false,
      createdAt: nowIso,
    });
  }

  return signals.sort((a, b) => b.estimatedProbability - a.estimatedProbability);
}


