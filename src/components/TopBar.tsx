import React from 'react';

export type NavTab = 'dashboard' | 'live' | 'prematch' | 'warroom' | 'performance' | 'settings';

interface TopBarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

const NAV_ITEMS: { id: NavTab; label: string }[] = [
  { id: 'dashboard', label: 'لوحة الاستوديو' },
  { id: 'live', label: 'تحليل مباشر' },
  { id: 'prematch', label: 'ما قبل المباراة' },
  { id: 'warroom', label: 'غرفة الذكاء' },
  { id: 'performance', label: 'الأداء والسجل' },
];

export const TopBar: React.FC<TopBarProps> = ({ activeTab, onSelectTab }) => {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#070B14]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('dashboard')}
          className="font-display text-xl font-extrabold tracking-tight text-slate-50 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 rounded-sm"
        >
          RASD AI
        </button>

        {/* Zone 2: 5 concise single-line text nav links */}
        <nav className="hidden lg:flex items-center gap-7" aria-label="التنقل الرئيسي">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-1 text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 rounded-sm ${
                  isActive ? 'text-teal-300' : 'text-slate-300 hover:text-slate-50'
                }`}
              >
                {item.label}
                {isActive && (
                  <span className="absolute inset-x-0 -bottom-3.5 h-0.5 bg-teal-400" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => onSelectTab('settings')}
            className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
              activeTab === 'settings'
                ? 'bg-teal-400 text-slate-950'
                : 'bg-teal-500 text-slate-950 hover:bg-teal-400'
            }`}
          >
            مصادر البيانات
          </button>
        </div>
      </div>

      {/* Mobile Secondary Navigation Row */}
      <nav className="flex lg:hidden items-center gap-4 overflow-x-auto border-t border-slate-800/70 px-4 py-2" aria-label="تنقل الجوال">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`text-xs font-medium whitespace-nowrap shrink-0 py-1 px-1 transition-colors cursor-pointer ${
                isActive ? 'text-teal-300 border-b border-teal-400' : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
