import React from 'react';
import { Play, SlidersHorizontal } from 'lucide-react';
import type { AnalysisConfig, MarketCategoryId, MarketCategoryMeta } from '../../shared/types';

interface AnalysisSetupPanelProps {
  mode: 'LIVE' | 'PREMATCH';
  config: AnalysisConfig;
  categories: MarketCategoryMeta[];
  selectedMatchCount: number;
  totalMatchCount: number;
  isRunning: boolean;
  onChange: (next: AnalysisConfig) => void;
  onStart: () => void;
}

export const AnalysisSetupPanel: React.FC<AnalysisSetupPanelProps> = ({
  mode,
  config,
  categories,
  selectedMatchCount,
  totalMatchCount,
  isRunning,
  onChange,
  onStart,
}) => {
  const isAllCategories = config.selectedCategories === 'ALL';

  const toggleCategory = (catId: MarketCategoryId) => {
    if (config.selectedCategories === 'ALL') {
      onChange({ ...config, selectedCategories: [catId] });
      return;
    }
    const exists = config.selectedCategories.includes(catId);
    const updated = exists
      ? config.selectedCategories.filter((c) => c !== catId)
      : [...config.selectedCategories, catId];
    onChange({
      ...config,
      selectedCategories: updated.length === 0 ? 'ALL' : updated,
    });
  };

  return (
    <section className="rounded-xl border border-slate-800/90 bg-[#0D1424] p-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-2.5">
          <SlidersHorizontal className="h-4 w-4 text-sky-400 shrink-0" />
          <h2 className="font-display text-base font-bold text-slate-50">
            إعداد محرك البحث والتحليل الجماعي ({mode === 'LIVE' ? 'المباشر' : 'ما قبل المباراة'})
          </h2>
        </div>
        <div className="text-xs text-slate-400 tabular-nums">
          نطاق الفحص: {selectedMatchCount > 0 ? `${selectedMatchCount} مباراة محددة` : `جميع المباريات المتاحة (${totalMatchCount})`}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {/* Target Odds */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor={`odds-${mode}`}>
            الأود المطلوب (Target Odds)
          </label>
          <input
            id={`odds-${mode}`}
            type="number"
            step="0.01"
            min="1.01"
            max="50"
            value={config.targetOdds}
            onChange={(e) => onChange({ ...config, targetOdds: Math.max(1.01, Number(e.target.value) || 1.3) })}
            className="w-full rounded-lg border border-slate-700/80 bg-[#070B14] px-3 py-2 font-mono text-sm text-slate-100 tabular-nums focus:border-teal-400 focus:outline-none"
          />
        </div>

        {/* Target Probability */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor={`prob-${mode}`}>
            نسبة الأمان المستهدفة (%)
          </label>
          <input
            id={`prob-${mode}`}
            type="number"
            step="1"
            min="30"
            max="100"
            value={config.targetProbability}
            onChange={(e) =>
              onChange({
                ...config,
                targetProbability: Math.min(100, Math.max(30, Number(e.target.value) || 80)),
              })
            }
            className="w-full rounded-lg border border-slate-700/80 bg-[#070B14] px-3 py-2 font-mono text-sm text-slate-100 tabular-nums focus:border-teal-400 focus:outline-none"
          />
        </div>

        {/* Odds Mode */}
        <div>
          <span className="block text-xs font-medium text-slate-300 mb-1.5">وضع الأود</span>
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-700/80 bg-[#070B14] p-1">
            <button
              type="button"
              onClick={() => onChange({ ...config, oddsMode: 'SINGLE' })}
              className={`rounded-md py-1.5 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                config.oddsMode === 'SINGLE' ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              اختيار فردي
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...config, oddsMode: 'COMBINED' })}
              className={`rounded-md py-1.5 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                config.oddsMode === 'COMBINED' ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              تجميعة أود
            </button>
          </div>
        </div>

        {/* Odds Tolerance */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor={`tol-${mode}`}>
            نطاق الأود المقبول (±)
          </label>
          <select
            id={`tol-${mode}`}
            value={config.oddsTolerance}
            onChange={(e) => onChange({ ...config, oddsTolerance: Number(e.target.value) })}
            className="w-full rounded-lg border border-slate-700/80 bg-[#070B14] px-3 py-2 font-mono text-sm text-slate-100 tabular-nums focus:border-teal-400 focus:outline-none"
          >
            <option value={0.05}>± 0.05 (دقيق)</option>
            <option value={0.12}>± 0.12 (متوازن)</option>
            <option value={0.25}>± 0.25 (مرن)</option>
            <option value={0.5}>± 0.50 (واسع)</option>
          </select>
        </div>

        {/* Max Results */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor={`res-${mode}`}>
            عدد الترشيحات المطلوب
          </label>
          <select
            id={`res-${mode}`}
            value={String(config.maxResults)}
            onChange={(e) =>
              onChange({
                ...config,
                maxResults: e.target.value === 'ALL' ? 'ALL' : Number(e.target.value),
              })
            }
            className="w-full rounded-lg border border-slate-700/80 bg-[#070B14] px-3 py-2 text-sm text-slate-100 focus:border-teal-400 focus:outline-none"
          >
            <option value="ALL">جميع النتائج المطابقة</option>
            <option value="3">أفضل 3 ترشيحات</option>
            <option value="5">أفضل 5 ترشيحات</option>
            <option value="10">أفضل 10 ترشيحات</option>
          </select>
        </div>

        {/* Debate Rounds */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor={`rnd-${mode}`}>
            جولات نقاش النماذج
          </label>
          <select
            id={`rnd-${mode}`}
            value={config.maxDebateRounds}
            onChange={(e) => onChange({ ...config, maxDebateRounds: Number(e.target.value) })}
            className="w-full rounded-lg border border-slate-700/80 bg-[#070B14] px-3 py-2 font-mono text-sm text-slate-100 focus:border-teal-400 focus:outline-none"
          >
            <option value={1}>1 جولة (توفير API)</option>
            <option value={2}>2 جولة (تبادل ومراجعة)</option>
            <option value={3}>3 جولات (نقاش واعتراض)</option>
            <option value={4}>4 جولات (كامل المراحل)</option>
          </select>
        </div>
      </div>

      {/* Market Category Selector */}
      <div className="mt-4 pt-4 border-t border-slate-800/70">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
          <span className="text-xs font-medium text-slate-300">الأسواق المشمولة في الفحص:</span>
          <button
            type="button"
            onClick={() => onChange({ ...config, selectedCategories: 'ALL' })}
            className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              isAllCategories ? 'bg-teal-500/20 text-teal-300' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            جميع الأسواق المتاحة (10 فئات)
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => {
            const active = isAllCategories || (Array.isArray(config.selectedCategories) && config.selectedCategories.includes(cat.id));
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggleCategory(cat.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer border ${
                  active
                    ? 'border-sky-500/40 bg-sky-500/15 text-sky-200'
                    : 'border-slate-800 bg-[#070B14] text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat.nameAr}
              </button>
            );
          })}
        </div>
      </div>

      {/* Launch Action */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800/70">
        <div className="text-xs text-slate-400">
          سيتم إرسال نفس البيانات إلى النماذج الثلاثة بالتساوي، ولا تُعرض إلا الأسواق الموجودة فعليًا في مصدر البيانات.
        </div>
        <button
          type="button"
          disabled={isRunning || totalMatchCount === 0}
          onClick={onStart}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-6 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Play className="h-4 w-4 fill-current" />
          <span>{isRunning ? 'جارٍ تشغيل غرفة الذكاء...' : 'بدء التحليل الجماعي (START AI ANALYSIS)'}</span>
        </button>
      </div>
    </section>
  );
};
