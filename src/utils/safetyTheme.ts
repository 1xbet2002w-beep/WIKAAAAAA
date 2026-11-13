import type { AnalyzedPick, SettlementOutcome } from '../../shared/types';

export type SafetyTierId = 'VERY_SAFE' | 'SEMI_SAFE' | 'UNSAFE';

export interface SafetyTierStyle {
  id: SafetyTierId;
  labelAr: string;
  textCls: string;
  borderCls: string;
  bgCls: string;
  dotCls: string;
}

export interface OutcomeVisualStyle {
  outcome: SettlementOutcome;
  labelAr: string;
  textCls: string;
  borderCls: string;
  bgCls: string;
  dotCls: string;
  strikeTitle?: boolean;
}

/**
 * Post-match visual styling requested by user:
 * - WIN / HALF_WIN: slightly greenish-teal blue (#14B8A6 / #2DD4BF / #0B3B46)
 * - LOSS / HALF_LOSS: black background with vertical stripes (.bet-lost-stripes)
 */
export function getOutcomeStyle(outcome?: SettlementOutcome): OutcomeVisualStyle | null {
  if (!outcome || outcome === 'PENDING') return null;

  if (outcome === 'WIN' || outcome === 'HALF_WIN') {
    return {
      outcome,
      labelAr: outcome === 'HALF_WIN' ? 'نصف ربح ✓' : 'فائز ✓',
      textCls: 'text-[#5EEAD4]',
      borderCls: 'border-[#14B8A6]/85',
      bgCls: 'bg-[#0B3B46]/70',
      dotCls: 'bg-[#2DD4BF]',
    };
  }

  if (outcome === 'LOSS' || outcome === 'HALF_LOSS') {
    return {
      outcome,
      labelAr: outcome === 'HALF_LOSS' ? 'نصف خسارة ✕' : 'خاسر ✕',
      textCls: 'text-red-400',
      borderCls: 'border-zinc-700',
      bgCls: 'bet-lost-stripes',
      dotCls: 'bg-red-500',
      strikeTitle: true,
    };
  }

  return {
    outcome,
    labelAr: outcome === 'PUSH' ? 'مسترد (PUSH)' : 'ملغى (VOID)',
    textCls: 'text-slate-300',
    borderCls: 'border-slate-600/80',
    bgCls: 'bg-slate-900/80',
    dotCls: 'bg-slate-400',
  };
}

/**
 * Maps estimated probability (and optional risk/status overrides) into the
 * 3-color vivid safety classification requested by the user:
 * - VERY_SAFE (≥ 75%): Vivid Green (#22C55E / #4ADE80)
 * - SEMI_SAFE (55% – 74.9%): Vivid Yellow (#FACC15)
 * - UNSAFE (< 55%): Vivid Red (#EF4444 / #FF4D4D)
 */
export function getSafetyTier(
  probability: number,
  riskLevel?: AnalyzedPick['riskLevel'],
  status?: AnalyzedPick['status']
): SafetyTierStyle {
  if (status === 'DISQUALIFIED' && probability < 60) {
    return {
      id: 'UNSAFE',
      labelAr: 'غير آمن',
      textCls: 'text-[#FF4D4D]',
      borderCls: 'border-[#EF4444]/80',
      bgCls: 'bg-[#EF4444]/12',
      dotCls: 'bg-[#FF3B30]',
    };
  }

  if (probability >= 75 && riskLevel !== 'HIGH' && riskLevel !== 'CRITICAL') {
    return {
      id: 'VERY_SAFE',
      labelAr: 'آمن جدًا',
      textCls: 'text-[#22FF66]',
      borderCls: 'border-[#22C55E]/80',
      bgCls: 'bg-[#22C55E]/12',
      dotCls: 'bg-[#22FF66]',
    };
  }

  if (probability >= 55 && riskLevel !== 'CRITICAL') {
    return {
      id: 'SEMI_SAFE',
      labelAr: 'شبه آمن',
      textCls: 'text-[#FFE600]',
      borderCls: 'border-[#FACC15]/80',
      bgCls: 'bg-[#FACC15]/12',
      dotCls: 'bg-[#FFE600]',
    };
  }

  return {
    id: 'UNSAFE',
    labelAr: 'غير آمن',
    textCls: 'text-[#FF4D4D]',
    borderCls: 'border-[#EF4444]/80',
    bgCls: 'bg-[#EF4444]/12',
    dotCls: 'bg-[#FF3B30]',
  };
}

