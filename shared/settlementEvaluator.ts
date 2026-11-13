import type { MarketCategoryId, MatchData, SettlementOutcome } from './types.ts';
import { settleAsianHandicap, settleAsianTotal } from '../server/markets.ts';

export interface BetEvalInput {
  selectionAr: string;
  selectionCode?: string;
  catalogIndex?: number;
  category?: MarketCategoryId;
  line?: number;
}

/**
 * Evaluates any bet/projection against a finished match (status === 'FT').
 * Returns 'PENDING' if the match has not ended yet or if a specialized stat (e.g. missing 1H score) is unavailable.
 */
export function evaluateBetOutcome(match: MatchData | undefined, bet: BetEvalInput): SettlementOutcome {
  if (!match || match.status !== 'FT') return 'PENDING';
  if (match.scoreHome === null || match.scoreAway === null) return 'PENDING';

  const h = match.scoreHome;
  const a = match.scoreAway;
  const tot = h + a;
  const homeAr = match.homeTeam.nameAr;
  const awayAr = match.awayTeam.nameAr;
  const sel = bet.selectionAr || '';
  const code = (bet.selectionCode || '').toUpperCase();
  const numMatch = sel.match(/([+-]?\d+(?:\.\d+)?)/);
  const parsedLine = bet.line ?? (numMatch ? Number(numMatch[1]) : undefined);

  // Derive HT scores if missing from <45' goal events when liveEvents are complete
  let htH = match.htScoreHome;
  let htA = match.htScoreAway;
  if ((htH === null || htA === null) && match.liveEvents && match.liveEvents.some((e) => e.type === 'GOAL')) {
    const goals1H = match.liveEvents.filter((e) => e.type === 'GOAL' && e.minute <= 45);
    const totalGoalEvents = match.liveEvents.filter((e) => e.type === 'GOAL').length;
    if (totalGoalEvents === tot) {
      htH = goals1H.filter((e) => e.team === 'HOME').length;
      htA = goals1H.filter((e) => e.team === 'AWAY').length;
    }
  }

  // 1. 1X2 / Full Time Result
  if (code === '1' || ((bet.catalogIndex === 1 || bet.catalogIndex === 5) && sel.includes(homeAr) && !sel.includes('أو التعادل'))) {
    return h > a ? 'WIN' : 'LOSS';
  }
  if (code === '2' || ((bet.catalogIndex === 1 || bet.catalogIndex === 5) && sel.includes(awayAr) && !sel.includes('أو التعادل'))) {
    return a > h ? 'WIN' : 'LOSS';
  }
  if (code === 'X' || ((bet.catalogIndex === 1 || bet.catalogIndex === 5) && sel.includes('التعادل'))) {
    return h === a ? 'WIN' : 'LOSS';
  }

  // 2. Double Chance
  if (code === '1X' || sel.includes('(1X)') || (sel.includes('أو التعادل') && sel.includes(homeAr) && !sel.includes('الشوط'))) {
    return h >= a ? 'WIN' : 'LOSS';
  }
  if (code === 'X2' || sel.includes('(X2)') || (sel.includes('أو التعادل') && sel.includes(awayAr) && !sel.includes('الشوط'))) {
    return a >= h ? 'WIN' : 'LOSS';
  }
  if (code === '12' || sel.includes('(12)') || sel.includes('فوز أحد الفريقين')) {
    return h !== a ? 'WIN' : 'LOSS';
  }

  // 3. Draw No Bet
  if (code.includes('DNB') || bet.catalogIndex === 3 || sel.includes('DNB') || sel.includes('التعادل لا رهان')) {
    const isHome = code.includes('HOME') || sel.includes(homeAr);
    const diff = isHome ? h - a : a - h;
    if (diff > 0) return 'WIN';
    if (diff === 0) return 'PUSH';
    return 'LOSS';
  }

  // 4. Half Time Result
  if (bet.catalogIndex === 4 || code.startsWith('1H_')) {
    if (htH === null || htA === null) return 'PENDING';
    if (code === '1H_1' || (sel.includes(homeAr) && !sel.includes('أو التعادل'))) return htH > htA ? 'WIN' : 'LOSS';
    if (code === '1H_2' || (sel.includes(awayAr) && !sel.includes('أو التعادل'))) return htA > htH ? 'WIN' : 'LOSS';
    if (code === '1H_X' || sel.includes('تعادل الشوط')) return htH === htA ? 'WIN' : 'LOSS';
    if (sel.includes('أو التعادل') && sel.includes(homeAr)) return htH >= htA ? 'WIN' : 'LOSS';
    if (sel.includes('أو التعادل') && sel.includes(awayAr)) return htA >= htH ? 'WIN' : 'LOSS';
    if (parsedLine !== undefined) {
      const htTot = htH + htA;
      return settleAsianTotal(htTot, parsedLine, code.includes('OVER') || sel.includes('أكثر') ? 'OVER' : 'UNDER').outcome;
    }
  }

  // 5. Half Time / Full Time
  if (bet.catalogIndex === 6) {
    if (htH === null || htA === null) return 'PENDING';
    const parts = sel.split('/').map((s) => s.trim());
    if (parts.length === 2) {
      const htWin = parts[0].includes(homeAr) ? htH > htA : parts[0].includes(awayAr) ? htA > htH : htH === htA;
      const ftWin = parts[1].includes(homeAr) ? h > a : parts[1].includes(awayAr) ? a > h : h === a;
      return htWin && ftWin ? 'WIN' : 'LOSS';
    }
  }

  // 6. Both Teams To Score (BTTS)
  if (bet.category === 'btts' || bet.catalogIndex === 10 || code.includes('BTTS') || sel.includes('كلا الفريقين') || sel.includes('الفريقان يسجلان')) {
    const isNo = code === 'BTTS_NO' || sel.includes(': لا');
    const bothScored = h > 0 && a > 0;
    return isNo ? (!bothScored ? 'WIN' : 'LOSS') : bothScored ? 'WIN' : 'LOSS';
  }

  // 7. Total Goals Odd/Even
  if (bet.catalogIndex === 9 || sel.includes('زوجي') || sel.includes('فردي')) {
    const isEven = tot % 2 === 0;
    return sel.includes('زوجي') ? (isEven ? 'WIN' : 'LOSS') : !isEven ? 'WIN' : 'LOSS';
  }

  // 8. Correct Score
  if (bet.catalogIndex === 11 || code.startsWith('CS_') || sel.includes('النتيجة الصحيحة')) {
    const csMatch = sel.match(/(\d+)\s*-\s*(\d+)/);
    if (csMatch) {
      return h === Number(csMatch[1]) && a === Number(csMatch[2]) ? 'WIN' : 'LOSS';
    }
  }

  // 9. Asian & European Handicap
  if (bet.category === 'handicap' || bet.catalogIndex === 12 || bet.catalogIndex === 13 || bet.catalogIndex === 14 || sel.includes('هاندكاب')) {
    const isHome = code.includes('HOME') || sel.includes(homeAr);
    const diff = isHome ? h - a : a - h;
    if (parsedLine !== undefined) {
      if (bet.catalogIndex === 13 || bet.catalogIndex === 14 || sel.includes('أوروبي')) {
        return diff + parsedLine > 0 ? 'WIN' : 'LOSS';
      }
      return settleAsianHandicap(diff, parsedLine).outcome;
    }
  }

  // 10. Total In Interval
  if (bet.catalogIndex === 15 || sel.includes('نطاق')) {
    const rangeMatch = sel.match(/من\s*(\d+)\s*إلى\s*(\d+)/);
    if (rangeMatch) {
      return tot >= Number(rangeMatch[1]) && tot <= Number(rangeMatch[2]) ? 'WIN' : 'LOSS';
    }
  }

  // 11. Individual / Team Total
  if (
    bet.catalogIndex === 8 ||
    bet.catalogIndex === 16 ||
    code.startsWith('HOME_OVER') ||
    code.startsWith('AWAY_OVER')
  ) {
    if (parsedLine !== undefined) {
      const teamGoals = code.includes('AWAY') || sel.includes(awayAr) ? a : h;
      return settleAsianTotal(teamGoals, parsedLine, sel.includes('أقل') ? 'UNDER' : 'OVER').outcome;
    }
  }

  // 12. First / Last Team To Score
  if (bet.catalogIndex === 17 || sel.includes('أول فريق يسجل') || sel.includes('سجل أولاً')) {
    if (tot === 0) return 'LOSS';
    const firstGoal = [...(match.liveEvents || [])].sort((x, y) => x.minute - y.minute).find((e) => e.type === 'GOAL');
    if (firstGoal) {
      const wantHome = sel.includes(homeAr);
      return (wantHome && firstGoal.team === 'HOME') || (!wantHome && firstGoal.team === 'AWAY') ? 'WIN' : 'LOSS';
    }
    if ((h > 0 && a === 0) || (a > 0 && h === 0)) {
      const wantHome = sel.includes(homeAr);
      return (wantHome && h > 0) || (!wantHome && a > 0) ? 'WIN' : 'LOSS';
    }
    return 'PENDING';
  }

  if (bet.catalogIndex === 18 || code.startsWith('LAST_') || sel.includes('آخر فريق يسجل') || sel.includes('الهدف الأخير')) {
    if (tot === 0) return 'LOSS';
    const lastGoal = [...(match.liveEvents || [])].sort((x, y) => y.minute - x.minute).find((e) => e.type === 'GOAL');
    if (lastGoal) {
      const wantHome = code.includes('HOME') || sel.includes(homeAr);
      return (wantHome && lastGoal.team === 'HOME') || (!wantHome && lastGoal.team === 'AWAY') ? 'WIN' : 'LOSS';
    }
    if ((h > 0 && a === 0) || (a > 0 && h === 0)) {
      const wantHome = code.includes('HOME') || sel.includes(homeAr);
      return (wantHome && h > 0) || (!wantHome && a > 0) ? 'WIN' : 'LOSS';
    }
    return 'PENDING';
  }

  // 13. Next Goal / No Goal
  if (bet.catalogIndex === 19 || sel.includes('الهدف رقم')) {
    const numG = sel.match(/رقم\s*(\d+)/);
    if (numG) {
      const targetN = Number(numG[1]);
      if (sel.includes('لا أهداف')) {
        return tot < targetN ? 'WIN' : 'LOSS';
      }
      if (tot < targetN) return 'LOSS';
      const goalsSorted = [...(match.liveEvents || [])].filter((e) => e.type === 'GOAL').sort((x, y) => x.minute - y.minute);
      const nthGoal = goalsSorted[targetN - 1];
      if (nthGoal) {
        const wantHome = sel.includes(homeAr);
        return (wantHome && nthGoal.team === 'HOME') || (!wantHome && nthGoal.team === 'AWAY') ? 'WIN' : 'LOSS';
      }
    }
    return 'PENDING';
  }

  if (bet.catalogIndex === 20 || sel.includes('عدم تسجيل أهداف')) {
    if (sel.includes('عكس No Goal') || sel.includes('هدف واحد على الأقل')) {
      return tot >= 1 ? 'WIN' : 'LOSS';
    }
    return tot === 0 ? 'WIN' : 'LOSS';
  }

  // 14. Winning Margin
  if (bet.catalogIndex === 21 || sel.includes('فارق')) {
    if (sel.includes('التعادل')) return h === a ? 'WIN' : 'LOSS';
    const wantHome = sel.includes(homeAr);
    return (wantHome ? h - a : a - h) === 1 ? 'WIN' : 'LOSS';
  }

  // 15. Exact Number Of Goals
  if (bet.catalogIndex === 22 || sel.includes('العدد الدقيق')) {
    if (parsedLine !== undefined) return tot === parsedLine ? 'WIN' : 'LOSS';
  }

  // 16. Goal In Both Halves / Team To Score In Both Halves
  if (bet.catalogIndex === 23) {
    if (htH === null || htA === null) return 'PENDING';
    const g1H = htH + htA;
    const g2H = tot - g1H;
    return g1H > 0 && g2H > 0 ? 'WIN' : 'LOSS';
  }
  if (bet.catalogIndex === 24) {
    if (htH === null || htA === null) return 'PENDING';
    const wantHome = sel.includes(homeAr);
    const g1H = wantHome ? htH : htA;
    const g2H = wantHome ? h - htH : a - htA;
    return g1H > 0 && g2H > 0 ? 'WIN' : 'LOSS';
  }

  // 17. Corners Markets
  if (bet.category === 'corners' || bet.catalogIndex === 25 || bet.catalogIndex === 26 || bet.catalogIndex === 27 || sel.includes('ركني')) {
    if (!match.liveStats) return 'PENDING';
    const ch = match.liveStats.cornersHome;
    const ca = match.liveStats.cornersAway;
    if (bet.catalogIndex === 27 || code.includes('MOST_CORNERS') || sel.includes('الأكثر ركنيات')) {
      const wantHome = code.includes('HOME') || sel.includes(homeAr);
      return wantHome ? (ch > ca ? 'WIN' : 'LOSS') : ca > ch ? 'WIN' : 'LOSS';
    }
    if (bet.catalogIndex === 26 || sel.includes('هاندكاب الركنيات')) {
      const wantHome = sel.includes(homeAr);
      const lineC = parsedLine ?? 0;
      const diffC = wantHome ? ch - ca : ca - ch;
      return settleAsianHandicap(diffC, lineC).outcome;
    }
    if (parsedLine !== undefined) {
      return settleAsianTotal(ch + ca, parsedLine, code.includes('UNDER') || sel.includes('أقل') ? 'UNDER' : 'OVER').outcome;
    }
  }

  // 18. Cards Markets
  if (bet.category === 'cards' || bet.catalogIndex === 28 || bet.catalogIndex === 29 || sel.includes('بطاقة')) {
    if (!match.liveStats) return 'PENDING';
    if (bet.catalogIndex === 29 || sel.includes('حمراء')) {
      const totalReds = match.liveStats.redCardsHome + match.liveStats.redCardsAway;
      const wantNo = sel.includes('لا');
      return wantNo ? (totalReds === 0 ? 'WIN' : 'LOSS') : totalReds > 0 ? 'WIN' : 'LOSS';
    }
    if (parsedLine !== undefined) {
      const totalY = match.liveStats.yellowCardsHome + match.liveStats.yellowCardsAway;
      return settleAsianTotal(totalY, parsedLine, code.includes('UNDER') || sel.includes('أقل') ? 'UNDER' : 'OVER').outcome;
    }
  }

  // 19. Shots on Target
  if (bet.category === 'shots' || code.includes('SOT') || sel.includes('تسديدة')) {
    if (!match.liveStats || parsedLine === undefined) return 'PENDING';
    const totalSot = match.liveStats.shotsOnTargetHome + match.liveStats.shotsOnTargetAway;
    return settleAsianTotal(totalSot, parsedLine, code.includes('UNDER') || sel.includes('أقل') ? 'UNDER' : 'OVER').outcome;
  }

  // 20. Player To Score Anytime
  if (bet.category === 'player_props' || bet.catalogIndex === 30 || sel.includes('يسجل في أي وقت')) {
    if (tot === 0) return 'LOSS';
    const goalEvents = (match.liveEvents || []).filter((e) => e.type === 'GOAL');
    if (goalEvents.length === 0) return 'PENDING';
    const cleanSel = sel.replace('يسجل في أي وقت', '').replace('يسجل هدفًا', '').trim().toLowerCase();
    const lastToken = cleanSel.split(/\s+/).pop() || cleanSel;
    const scored = goalEvents.some(
      (g) =>
        g.player.toLowerCase().includes(cleanSel) ||
        (lastToken.length >= 3 && g.player.toLowerCase().includes(lastToken))
    );
    return scored ? 'WIN' : 'LOSS';
  }

  // 21. Win to Nil
  if (code.includes('WIN_TO_NIL') || sel.includes('شباك نظيفة')) {
    const wantHome = code.includes('HOME') || sel.includes(homeAr);
    return wantHome ? (h > 0 && a === 0 ? 'WIN' : 'LOSS') : a > 0 && h === 0 ? 'WIN' : 'LOSS';
  }

  // 22. Generic Total Goals Over/Under fallback
  if (bet.category === 'total_goals' || bet.catalogIndex === 7 || code.startsWith('OVER_') || code.startsWith('UNDER_') || sel.includes('أكثر من') || sel.includes('أقل من')) {
    if (parsedLine !== undefined && sel.includes('هدف')) {
      return settleAsianTotal(tot, parsedLine, code.includes('UNDER') || sel.includes('أقل') ? 'UNDER' : 'OVER').outcome;
    }
  }

  return 'PENDING';
}
