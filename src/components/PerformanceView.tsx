import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import type { PerformanceMetrics, PredictionRecord, SettlementOutcome } from '../../shared/types';
import { buildBetExplanationAr } from '../utils/betExplainer';
import { getOutcomeStyle, getSafetyTier } from '../utils/safetyTheme';

interface PerformanceViewProps {
  predictions: PredictionRecord[];
  metrics: PerformanceMetrics | null;
  includeDemo: boolean;
  onToggleIncludeDemo: (val: boolean) => void;
  onSettlePrediction: (id: string, outcome: SettlementOutcome, score?: string) => Promise<void>;
}

const OUTCOME_LABELS: Record<SettlementOutcome, { text: string; cls: string }> = {
  PENDING: { text: 'قيد الانتظار', cls: 'text-sky-300' },
  WIN: { text: 'رابح (WIN)', cls: 'text-teal-300' },
  HALF_WIN: { text: 'نصف ربح', cls: 'text-teal-200' },
  PUSH: { text: 'استرداد (PUSH)', cls: 'text-slate-300' },
  HALF_LOSS: { text: 'نصف خسارة', cls: 'text-amber-300' },
  LOSS: { text: 'خاسر (LOSS)', cls: 'text-red-400' },
  VOID: { text: 'ملغى (VOID)', cls: 'text-slate-400' },
};

export const PerformanceView: React.FC<PerformanceViewProps> = ({
  predictions,
  metrics,
  includeDemo,
  onToggleIncludeDemo,
  onSettlePrediction,
}) => {
  const [settlingId, setSettlingId] = useState<string | null>(null);

  const handleSettle = async (id: string, outcome: SettlementOutcome) => {
    setSettlingId(id);
    await onSettlePrediction(id, outcome);
    setSettlingId(null);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="text-xs font-mono text-sky-400">PERFORMANCE & CALIBRATION LEDGER</div>
          <h1 className="font-display text-2xl font-extrabold text-slate-50">لوحة الأداء والمعايرة الإحصائية</h1>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0D1526] p-1">
          <button
            type="button"
            onClick={() => onToggleIncludeDemo(false)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer ${
              !includeDemo ? 'bg-teal-500/20 text-teal-300' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            السجل الحقيقي فقط
          </button>
          <button
            type="button"
            onClick={() => onToggleIncludeDemo(true)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer ${
              includeDemo ? 'bg-sky-500/20 text-sky-200' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            شامل نتائج المحاكاة
          </button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 rounded-2xl border border-slate-800/90 bg-[#0D1526] p-5 tabular-nums">
        <div>
          <div className="text-xs text-slate-400">إجمالي التوقعات</div>
          <div className="mt-1 font-mono text-2xl font-bold text-slate-100">{metrics?.totalPredictions ?? 0}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400">الرابح / نصف ربح</div>
          <div className="mt-1 font-mono text-2xl font-bold text-teal-300">
            {(metrics?.wonCount ?? 0) + (metrics?.halfWonCount ?? 0)}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400">الخاسر / نصف خسارة</div>
          <div className="mt-1 font-mono text-2xl font-bold text-red-400">
            {(metrics?.lostCount ?? 0) + (metrics?.halfLostCount ?? 0)}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400">المسترد / الملغى</div>
          <div className="mt-1 font-mono text-2xl font-bold text-slate-300">
            {(metrics?.pushCount ?? 0) + (metrics?.voidCount ?? 0)}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400">معدل النجاح الفعلي</div>
          <div className="mt-1 font-mono text-2xl font-bold text-teal-300">
            {metrics ? `${metrics.actualWinRate}%` : '—'}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Brier / Log Loss</div>
          <div className="mt-1 font-mono text-sm font-bold text-sky-300">
            {metrics?.brierScore !== null && metrics?.brierScore !== undefined
              ? `${metrics.brierScore.toFixed(3)} / ${metrics.logLoss?.toFixed(3)}`
              : 'بانتظار التسوية'}
          </div>
        </div>
      </section>

      {/* Per-Model vs Collective Accuracy & Category/League Breakdowns */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-slate-800/90 bg-[#0D1526] p-5">
          <h2 className="font-display text-base font-bold text-slate-50 mb-4">أداء النماذج الثلاثة منفردة vs الجماعي</h2>
          <div className="space-y-4">
            <div className="pb-3 border-b border-slate-800/80 flex items-center justify-between text-xs tabular-nums">
              <span className="font-bold text-teal-300">النظام الجماعي (Aggregator)</span>
              <span className="font-mono font-bold text-teal-300">{metrics?.collectiveAccuracy ?? 0}%</span>
            </div>
            {(metrics?.perModelStats || []).map((ms) => (
              <div key={ms.slotId} className="space-y-1 text-xs tabular-nums">
                <div className="flex items-center justify-between">
                  <span className="text-slate-200">{ms.displayNameAr}</span>
                  <span className="font-mono text-sky-300">
                    {ms.predictionsEvaluated > 0 ? `${ms.accuracyPercent}% (Brier ${ms.brierScore?.toFixed(3)})` : 'لا توجد تسويات'}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-sky-400" style={{ width: `${ms.accuracyPercent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/90 bg-[#0D1526] p-5">
          <h2 className="font-display text-base font-bold text-slate-50 mb-4">الأداء حسب نوع السوق</h2>
          {!metrics || metrics.byCategory.length === 0 ? (
            <p className="text-xs text-slate-400 py-6">لا توجد ترشيحات مسوّاة بعد لعرض التوزيع حسب السوق.</p>
          ) : (
            <div className="space-y-2.5 text-xs tabular-nums">
              {metrics.byCategory.map((c) => (
                <div key={c.category} className="flex items-center justify-between border-b border-slate-800/50 pb-2 last:border-b-0">
                  <span className="text-slate-200">{c.nameAr}</span>
                  <span className="font-mono text-teal-300">
                    {c.won}/{c.total} ({c.winRate}%)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-800/90 bg-[#0D1526] p-5">
          <h2 className="font-display text-base font-bold text-slate-50 mb-4">الأداء حسب البطولة</h2>
          {!metrics || metrics.byLeague.length === 0 ? (
            <p className="text-xs text-slate-400 py-6">لا توجد ترشيحات مسوّاة بعد لعرض التوزيع حسب البطولة.</p>
          ) : (
            <div className="space-y-2.5 text-xs tabular-nums">
              {metrics.byLeague.map((l) => (
                <div key={l.leagueNameAr} className="flex items-center justify-between border-b border-slate-800/50 pb-2 last:border-b-0">
                  <span className="text-slate-200">{l.leagueNameAr}</span>
                  <span className="font-mono text-sky-300">
                    {l.won}/{l.total} ({l.winRate}%)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Immutable Ledger Table */}
      <section className="rounded-2xl border border-slate-800/90 bg-[#0D1526] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-teal-400" />
            <h2 className="font-display text-lg font-bold text-slate-50">السجل الثابت للتوقعات والمقارنة بالنتائج الفعلية</h2>
          </div>
          <span className="text-xs text-slate-400">لا يُسمح بتعديل التوقع الأصلي بعد حفظه</span>
        </div>

        {predictions.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            السجل فارغ حاليًا. احفظ أي ترشيح من غرفة الذكاء لتتبع دقته ومقارنته بالنتيجة الفعلية هنا.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 font-medium">المباراة والبطولة</th>
                  <th className="py-2.5 font-medium">السوق والاختيار</th>
                  <th className="py-2.5 font-medium">الأود</th>
                  <th className="py-2.5 font-medium">الاحتمال الأصلي</th>
                  <th className="py-2.5 font-medium">البصمة الثابتة</th>
                  <th className="py-2.5 font-medium">النتيجة الفعلية / التسوية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {predictions.map((rec) => {
                  const lbl = OUTCOME_LABELS[rec.settlementOutcome];
                  const tier = getSafetyTier(rec.estimatedProbability, rec.riskLevel);
                  const outStyle = getOutcomeStyle(rec.settlementOutcome);
                  const activeCls = outStyle || tier;
                  return (
                    <tr
                      key={rec.id}
                      className={`transition-colors ${outStyle ? `${outStyle.bgCls} border-b ${outStyle.borderCls}` : 'hover:bg-slate-800/25'}`}
                    >
                      <td className="py-3 pr-2">
                        <div className="font-semibold text-slate-100">
                          {rec.homeTeamAr} × {rec.awayTeamAr}
                        </div>
                        <div className="text-slate-400">
                          {rec.leagueNameAr} · {rec.isDemo ? 'محاكاة' : 'حقيقي'}
                          {rec.settledScore ? ` · النتيجة ${rec.settledScore}` : ''}
                        </div>
                      </td>
                      <td className="py-3 max-w-[300px]">
                        <div className="text-slate-200">{rec.marketNameAr}</div>
                        <div className={`font-bold ${activeCls.textCls} ${outStyle?.strikeTitle ? 'line-through decoration-red-500/60' : ''}`}>
                          {rec.selectionAr}
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-400 leading-relaxed">
                          {buildBetExplanationAr({
                            selectionAr: rec.selectionAr,
                            marketNameAr: rec.marketNameAr,
                            category: rec.category,
                            homeTeamAr: rec.homeTeamAr,
                            awayTeamAr: rec.awayTeamAr,
                          })}
                        </p>
                      </td>
                      <td className="py-3 font-mono font-bold text-slate-100 tabular-nums">{rec.odds.toFixed(2)}</td>
                      <td className="py-3 tabular-nums">
                        <div className={`font-mono font-extrabold ${activeCls.textCls}`}>{rec.estimatedProbability}%</div>
                        <div className={`text-[10px] font-bold ${activeCls.textCls}`}>{activeCls.labelAr}</div>
                      </td>
                      <td className="py-3 font-mono text-slate-500 tabular-nums">{rec.immutableHash}</td>
                      <td className="py-3">
                        <div className={`font-semibold mb-1.5 ${lbl.cls}`}>{lbl.text}</div>
                        {rec.settlementOutcome === 'PENDING' && (
                          <div className="flex flex-wrap gap-1">
                            {(
                              [
                                { k: 'WIN', t: 'ربح' },
                                { k: 'HALF_WIN', t: 'نصف ربح' },
                                { k: 'PUSH', t: 'استرداد' },
                                { k: 'HALF_LOSS', t: 'نصف خسارة' },
                                { k: 'LOSS', t: 'خسارة' },
                                { k: 'VOID', t: 'إلغاء' },
                              ] as const
                            ).map((act) => (
                              <button
                                key={act.k}
                                type="button"
                                disabled={settlingId === rec.id}
                                onClick={() => handleSettle(rec.id, act.k)}
                                className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-200 hover:bg-slate-700 cursor-pointer"
                              >
                                {act.t}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
