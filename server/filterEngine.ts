import type { AccumulatorPick, AnalysisConfig, AnalyzedPick } from '../shared/types.ts';

export interface FilterOutcome {
  qualifiedPicks: AnalyzedPick[];
  otherAnalyzedPicks: AnalyzedPick[];
  accumulators: AccumulatorPick[];
  emptyReasonAr?: string;
}

/**
 * Filters analyzed picks strictly by Target Odds (± tolerance), Target Probability,
 * selected Market Categories, and Result Count — sorting by Evidence Strength & Calibrated Probability
 * rather than highest odds.
 */
export function filterAndRankPicks(allPicks: AnalyzedPick[], config: AnalysisConfig): FilterOutcome {
  const minOdds = Math.max(1.01, config.targetOdds - config.oddsTolerance);
  const maxOdds = config.targetOdds + config.oddsTolerance;

  // Sort strictly by evidence strength + calibrated probability + data quality (never highest odds)
  const rankedAll = [...allPicks].sort((a, b) => {
    const scoreA = a.estimatedProbability * 0.55 + a.evidenceStrength * 0.25 + a.dataQuality * 0.20;
    const scoreB = b.estimatedProbability * 0.55 + b.evidenceStrength * 0.25 + b.dataQuality * 0.20;
    return scoreB - scoreA;
  });

  if (config.oddsMode === 'SINGLE') {
    const qualified = rankedAll.filter((p) => {
      if (p.status === 'DISQUALIFIED') return false;
      const inOddsBand = p.odds >= minOdds && p.odds <= maxOdds;
      const meetsProb = p.estimatedProbability >= config.targetProbability;
      return inOddsBand && meetsProb;
    });

    const sliced = config.maxResults === 'ALL' ? qualified : qualified.slice(0, config.maxResults);

    let emptyReasonAr: string | undefined;
    if (sliced.length === 0) {
      const maxProbSeen = rankedAll.length > 0 ? Math.max(...rankedAll.map((p) => p.estimatedProbability)) : 0;
      const inBandCount = rankedAll.filter((p) => p.odds >= minOdds && p.odds <= maxOdds).length;

      if (rankedAll.length === 0) {
        emptyReasonAr = 'لم تتوفر أسواق مطابقة للفحص في المباريات المحددة حاليًا.';
      } else if (config.targetProbability >= 99.5 && !rankedAll.some((p) => p.isMathematicallySettled)) {
        emptyReasonAr = `لا توجد اختيارات تستوفي شرط الأمان ${config.targetProbability}% بشكل موثوق وقابل للتحقق (أعلى احتمال معاير متاح حاليًا هو ${maxProbSeen.toFixed(1)}%). يرفض النظام ادعاء 100% لأي حدث مستقبلي غير محسوم حسابيًا.`;
      } else if (inBandCount === 0) {
        emptyReasonAr = `لا توجد أسواق متاحة ضمن نطاق الأود المطلوب (${minOdds.toFixed(2)} – ${maxOdds.toFixed(2)}). جرّب توسيع هامش التسامح.`;
      } else {
        emptyReasonAr = `وُجدت ${inBandCount} خيارات ضمن نطاق الأود، لكن لم يحقق أي منها الحد الأدنى لنسبة الأمان المطلوبة (${config.targetProbability}%). أعلى احتمال معاير ضمن النطاق هو ${maxProbSeen.toFixed(1)}%.`;
      }
    }

    return {
      qualifiedPicks: sliced,
      otherAnalyzedPicks: rankedAll.filter((p) => !sliced.some((s) => s.id === p.id)),
      accumulators: [],
      emptyReasonAr,
    };
  }

  // COMBINED / ACCUMULATOR ODDS MODE
  // Eligible legs: non-disqualified picks with high individual data quality and probability >= max(55, targetProb - 15)
  const legProbFloor = Math.min(config.targetProbability, Math.max(58, config.targetProbability - 12));
  const eligibleLegs = rankedAll.filter(
    (p) => p.status !== 'DISQUALIFIED' && p.estimatedProbability >= legProbFloor && p.odds >= 1.05
  );

  const accumulators: AccumulatorPick[] = [];
  const usedSignatures = new Set<string>();

  // Try 2-leg and 3-leg combinations across DIFFERENT matches (or flag statistical correlation if same match)
  for (let i = 0; i < Math.min(eligibleLegs.length, 14); i++) {
    for (let j = i + 1; j < Math.min(eligibleLegs.length, 14); j++) {
      const legA = eligibleLegs[i];
      const legB = eligibleLegs[j];
      const comboOdds2 = Number((legA.odds * legB.odds).toFixed(2));
      const sameMatch = legA.matchId === legB.matchId;

      if (comboOdds2 >= minOdds && comboOdds2 <= maxOdds) {
        const rawProb = (legA.estimatedProbability / 100) * (legB.estimatedProbability / 100) * 100;
        const correlationPenalty = sameMatch ? 0.86 : 0.97;
        const adjProb = Number((rawProb * correlationPenalty).toFixed(1));

        if (adjProb >= config.targetProbability) {
          const sig = [legA.id, legB.id].sort().join('|');
          if (!usedSignatures.has(sig)) {
            usedSignatures.add(sig);
            accumulators.push({
              id: `acc-${accumulators.length + 1}`,
              legs: [legA, legB],
              combinedOdds: comboOdds2,
              combinedProbability: Number(rawProb.toFixed(1)),
              correlationAdjustedProbability: adjProb,
              hasCorrelatedLegs: sameMatch,
              correlationWarningAr: sameMatch
                ? 'تحذير ارتباط إحصائي: الاختياران في نفس المباراة؛ تم تطبيق معامل خصم للارتباط وعدم افتراض الاستقلالية.'
                : undefined,
              averageAgreement: Math.round((legA.modelAgreement + legB.modelAgreement) / 2),
              minDataQuality: Math.min(legA.dataQuality, legB.dataQuality),
              riskLevel: sameMatch || adjProb < 65 ? 'HIGH' : adjProb < 78 ? 'MEDIUM' : 'LOW',
            });
          }
        }
      }

      // 3-leg check if still below maxOdds
      if (comboOdds2 < minOdds) {
        for (let k = j + 1; k < Math.min(eligibleLegs.length, 12); k++) {
          const legC = eligibleLegs[k];
          const comboOdds3 = Number((comboOdds2 * legC.odds).toFixed(2));
          if (comboOdds3 >= minOdds && comboOdds3 <= maxOdds) {
            const anySameMatch =
              legA.matchId === legB.matchId || legA.matchId === legC.matchId || legB.matchId === legC.matchId;
            const rawProb3 =
              (legA.estimatedProbability / 100) *
              (legB.estimatedProbability / 100) *
              (legC.estimatedProbability / 100) *
              100;
            const adjProb3 = Number((rawProb3 * (anySameMatch ? 0.82 : 0.95)).toFixed(1));
            if (adjProb3 >= config.targetProbability) {
              const sig3 = [legA.id, legB.id, legC.id].sort().join('|');
              if (!usedSignatures.has(sig3)) {
                usedSignatures.add(sig3);
                accumulators.push({
                  id: `acc-${accumulators.length + 1}`,
                  legs: [legA, legB, legC],
                  combinedOdds: comboOdds3,
                  combinedProbability: Number(rawProb3.toFixed(1)),
                  correlationAdjustedProbability: adjProb3,
                  hasCorrelatedLegs: anySameMatch,
                  correlationWarningAr: anySameMatch
                    ? 'تحذير ارتباط إحصائي: توجد أطراف من نفس المباراة؛ تم خفض الاحتمال المجمع.'
                    : undefined,
                  averageAgreement: Math.round((legA.modelAgreement + legB.modelAgreement + legC.modelAgreement) / 3),
                  minDataQuality: Math.min(legA.dataQuality, legB.dataQuality, legC.dataQuality),
                  riskLevel: anySameMatch || adjProb3 < 60 ? 'HIGH' : 'MEDIUM',
                });
              }
            }
          }
        }
      }
    }
  }

  accumulators.sort((a, b) => b.correlationAdjustedProbability - a.correlationAdjustedProbability);
  const slicedAcc = config.maxResults === 'ALL' ? accumulators : accumulators.slice(0, config.maxResults);

  let emptyReasonAr: string | undefined;
  if (slicedAcc.length === 0) {
    emptyReasonAr = `لم يتم العثور على تجميعة اختيارات تحقق إجمالي أود (${minOdds.toFixed(2)} – ${maxOdds.toFixed(2)}) مع احتمال مجمّع مصحح للارتباط >= ${config.targetProbability}%.`;
  }

  return {
    qualifiedPicks: [],
    otherAnalyzedPicks: rankedAll,
    accumulators: slicedAcc,
    emptyReasonAr,
  };
}
