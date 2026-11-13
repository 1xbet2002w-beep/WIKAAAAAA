import React, { useState } from 'react';
import { ArrowLeft, Calendar, CheckCircle2, Radio, ShieldAlert, ShieldCheck, Tv } from 'lucide-react';
import stadiumHeroImg from '../assets/images/stadium_broadcast_hero_1794522509457.jpg';
import studioDeskImg from '../assets/images/tactical_studio_desk_1794522509922.jpg';
import type { MatchData, PerformanceMetrics, SystemSettings, WarRoomResult } from '../../shared/types';
import { TeamCrest } from './TeamCrest';
import type { NavTab } from './TopBar';

interface DashboardViewProps {
  matches: MatchData[];
  settings: SystemSettings | null;
  recentSessions: WarRoomResult[];
  metrics: PerformanceMetrics | null;
  onNavigate: (tab: NavTab) => void;
  onOpenMatch: (matchId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  matches,
  settings,
  recentSessions,
  metrics,
  onNavigate,
  onOpenMatch,
}) => {
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [deskImgFailed, setDeskImgFailed] = useState(false);

  const liveCount = matches.filter((m) => m.mode === 'LIVE' && m.status !== 'FT').length;
  const ftCount = matches.filter((m) => m.status === 'FT').length;
  const prematchCount = matches.filter((m) => m.mode === 'PREMATCH').length;
  const nationalCount = matches.filter((m) => m.teamType === 'NATIONAL').length;
  const clubCount = matches.filter((m) => m.teamType === 'CLUB').length;
  const leagueCount = new Set(matches.map((m) => m.leagueNameEn)).size;
  const todayFormatted = new Intl.DateTimeFormat('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  const readyModelsCount = settings ? settings.aiModels.filter((m) => m.status === 'READY').length : 0;
  const connectedApisCount = settings ? settings.connectors.filter((c) => c.hasKey && c.status === 'CONNECTED').length : 0;

  return (
    <div className="space-y-8">
      {/* Broadcast Studio Hero Banner */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-800/90 bg-[#0B1220]">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-between z-10">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 tabular-nums">
                <span>بث الاستوديو التحليلي</span>
                <span aria-hidden="true">·</span>
                <span>{todayFormatted}</span>
                <span aria-hidden="true">·</span>
                <span className={settings?.dataSourceMode === 'REAL_API' ? 'text-teal-300' : 'text-amber-300'}>
                  {settings?.dataSourceMode === 'REAL_API' ? 'مصادر بيانات حقيقية' : 'وضع الاستوديو التجريبي'}
                </span>
              </div>

              <h1 className="mt-3 font-display text-3xl sm:text-4xl font-extrabold text-slate-50 leading-tight max-w-2xl [text-wrap:balance]">
                منظومة RASD AI للاستخبارات الكروية وتحليل الأسواق المتكامل
              </h1>

              <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl">
                ثلاثة نماذج ذكاء اصطناعي متساوية الصلاحيات تفحص كل مباراة وسوق متاح، تتبادل الأدلة وتعترض على الفرضيات الضعيفة، ثم تُصدر تقارير معايرة وفق الأود ونسبة الأمان المطلوبة.
              </p>
            </div>

            {/* Clean Unboxed Telemetry Strip */}
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-6 border-t border-slate-800/80 pt-6">
              <div>
                <div className="text-xs text-slate-400">تغطية اليوم (أندية / منتخبات)</div>
                <div className="mt-1 font-mono text-2xl font-bold text-slate-50 tabular-nums">{matches.length}</div>
                <div className="mt-0.5 text-[11px] text-slate-400 tabular-nums">
                  {nationalCount} منتخب · {clubCount} نادي
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">مباريات مباشرة الآن</div>
                <div className="mt-1 font-mono text-2xl font-bold text-teal-300 tabular-nums">{liveCount}</div>
                <div className="mt-0.5 text-[11px] text-[#5EEAD4] tabular-nums">
                  +{ftCount} انتهت (FT)
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">البطولات المرصودة</div>
                <div className="mt-1 font-mono text-2xl font-bold text-sky-300 tabular-nums">{leagueCount}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">جاهزية النماذج الثلاثة</div>
                <div className="mt-1 font-mono text-2xl font-bold text-slate-50 tabular-nums">{readyModelsCount}/3</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 relative min-h-[240px] lg:min-h-full bg-[#090F1C]">
            {!heroImgFailed ? (
              <img
                src={stadiumHeroImg}
                alt="منظر علوي لملعب كرة قدم مضاء ليلاً من منصة البث التلفزيوني"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgFailed(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-[#070B14] p-6 text-slate-400">
                <Tv className="h-10 w-10 text-teal-400 mb-2" />
                <span className="text-sm font-medium">استوديو البث المباشر — RASD AI</span>
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-[#0B1220]/30 to-[#0B1220] hidden lg:block" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0B1220] via-transparent to-transparent lg:hidden" />
          </div>
        </div>
      </section>

      {/* Two Main Broadcast Portals: LIVE ANALYSIS & PREMATCH ANALYSIS */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button
          type="button"
          onClick={() => onNavigate('live')}
          className="group text-right rounded-2xl border border-slate-800/90 bg-[#0D1526] p-6 sm:p-7 transition-colors hover:border-teal-500/50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300">
                <Radio className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-mono text-teal-300">LIVE ANALYSIS</div>
                <h2 className="font-display text-xl font-bold text-slate-50">تحليل المباريات المباشرة</h2>
              </div>
            </div>
            <ArrowLeft className="h-5 w-5 text-slate-400 transition-transform group-hover:-translate-x-1 group-hover:text-teal-300" />
          </div>
          <p className="mt-4 text-sm text-slate-300 leading-relaxed">
            رصد لحظي للدقيقة والنتيجة والاستحواذ والتسديدات والركنيات والبطاقات وتغير الأسعار، مع إعادة تقييم تلقائية عند الأهداف وحالات الطرد وتعليق فوري عند تأخر البيانات.
          </p>
          <div className="mt-5 flex items-center gap-3 border-t border-slate-800/80 pt-4 text-xs text-slate-400 tabular-nums">
            <span>{liveCount} مباريات جارية الآن</span>
            <span aria-hidden="true">·</span>
            <span>فحص كافة الأسواق المتاحة</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('prematch')}
          className="group text-right rounded-2xl border border-slate-800/90 bg-[#0D1526] p-6 sm:p-7 transition-colors hover:border-sky-500/50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-mono text-sky-300">PREMATCH ANALYSIS</div>
                <h2 className="font-display text-xl font-bold text-slate-50">تحليل ما قبل المباراة</h2>
              </div>
            </div>
            <ArrowLeft className="h-5 w-5 text-slate-400 transition-transform group-hover:-translate-x-1 group-hover:text-sky-300" />
          </div>
          <p className="mt-4 text-sm text-slate-300 leading-relaxed">
            تحليل عميق لمباريات اليوم والغد يشمل التشكيلات المتوقعة والرسمية، الإصابات والإيقافات، المواجهات المباشرة، الأداء داخل وخارج الأرض، وأسواق اللاعبين والهاندكاب.
          </p>
          <div className="mt-5 flex items-center gap-3 border-t border-slate-800/80 pt-4 text-xs text-slate-400 tabular-nums">
            <span>{prematchCount} مباريات مجدولة</span>
            <span aria-hidden="true">·</span>
            <span>اليوم والغد</span>
          </div>
        </button>
      </section>

      {/* Featured Today's Matches (Clubs & National Teams with Crests) */}
      {matches.length > 0 && (
        <section className="rounded-2xl border border-slate-800/90 bg-[#0D1526] p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-50">
                أبرز مباريات اليوم والغد (اضغط على أي مباراة لفتح صفحتها التحليلية)
              </h2>
              <p className="text-xs text-slate-400">
                يشمل المباريات المتوفرة بأسعار أسواق ومباريات المنتخبات والأندية العالمية
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('prematch')}
              className="text-xs font-semibold text-teal-300 hover:text-teal-200 cursor-pointer"
            >
              عرض جميع المباريات ({matches.length})
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {[...matches]
              .sort((a, b) => b.availableMarkets.length - a.availableMarkets.length)
              .slice(0, 6)
              .map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onOpenMatch(m.id)}
                  className="text-right rounded-xl border border-slate-800 bg-[#070B14] p-4 hover:border-teal-500/50 transition-colors cursor-pointer space-y-3"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="truncate max-w-[65%]">{m.leagueNameAr}</span>
                    <span
                      className={`font-mono tabular-nums ${
                        m.status === 'FT' ? 'text-[#5EEAD4] font-bold' : 'text-sky-300'
                      }`}
                    >
                      {m.status === 'FT'
                        ? 'انتهت (FT)'
                        : m.mode === 'LIVE'
                        ? `مباشر ${m.minute ?? 0}'`
                        : new Intl.DateTimeFormat('ar-EG', { hour: '2-digit', minute: '2-digit' }).format(new Date(m.kickoffTime))}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <TeamCrest
                        logoUrl={m.homeTeam.logoUrl}
                        name={m.homeTeam.nameAr}
                        shortCode={m.homeTeam.shortCode}
                        size="sm"
                      />
                      <span className="font-display text-xs font-bold text-slate-100 truncate">{m.homeTeam.nameAr}</span>
                    </div>

                    <span
                      className={`font-mono text-xs font-bold px-1.5 tabular-nums shrink-0 ${
                        m.status === 'FT' ? 'text-[#5EEAD4]' : 'text-teal-300'
                      }`}
                    >
                      {m.mode === 'LIVE' ? `${m.scoreHome ?? 0}-${m.scoreAway ?? 0}` : 'VS'}
                    </span>

                    <div className="flex items-center justify-end gap-2 min-w-0 flex-1">
                      <span className="font-display text-xs font-bold text-slate-100 truncate">{m.awayTeam.nameAr}</span>
                      <TeamCrest
                        logoUrl={m.awayTeam.logoUrl}
                        name={m.awayTeam.nameAr}
                        shortCode={m.awayTeam.shortCode}
                        size="sm"
                      />
                    </div>
                  </div>
                </button>
              ))}
          </div>
        </section>
      )}

      {/* AI Panel Readiness & Data Connectors Status + Studio Desk Showcase */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 rounded-2xl border border-slate-800/90 bg-[#0D1526] p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
              <h3 className="font-display text-lg font-bold text-slate-50">حالة طاقم التحليل الجماعي ومصادر البيانات</h3>
              <button
                type="button"
                onClick={() => onNavigate('settings')}
                className="text-xs font-medium text-sky-300 hover:text-sky-200 whitespace-nowrap cursor-pointer"
              >
                إدارة المفاتيح والمزودين
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {settings?.aiModels.map((model) => (
                <div key={model.slotId} className="flex flex-wrap items-center justify-between gap-3 py-2 border-b border-slate-800/50 last:border-b-0">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{model.displayNameAr}</div>
                    <div className="text-xs text-slate-400">
                      {model.roleTitleAr} · <span className="font-mono">{model.provider} / {model.modelName}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    {model.status === 'READY' ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-teal-400" />
                        <span className="text-teal-300">جاهز للتحليل</span>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="h-4 w-4 text-amber-400" />
                        <span className="text-amber-300">ينقصه التفعيل</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-sky-400" />
              <span>
                مصادر كرة القدم المتصلة: <strong className="text-slate-200 font-mono tabular-nums">{connectedApisCount}</strong> من 3
              </span>
            </div>
            <div>الوضع النشط: {settings?.dataSourceMode === 'REAL_API' ? 'حقيقي (Real API)' : 'تجريبي مفصول (Demo Studio)'}</div>
          </div>
        </div>

        <div className="lg:col-span-5 relative overflow-hidden rounded-2xl border border-slate-800/90 bg-[#0D1526] min-h-[240px]">
          {!deskImgFailed ? (
            <img
              src={studioDeskImg}
              alt="طاولة الاستوديو التحليلي بثلاثة محللين في بث رياضي احترافي"
              referrerPolicy="no-referrer"
              onError={() => setDeskImgFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-slate-900 text-slate-400 p-6">
              <span>طاولة النقاش الثلاثي — غرفة الذكاء</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#070B14] via-[#070B14]/45 to-transparent flex flex-col justify-end p-6">
            <div className="text-xs font-mono text-teal-300">AI WAR ROOM</div>
            <h3 className="mt-1 font-display text-lg font-bold text-slate-50">نقاش متوازن دون تفرد أو مجاملة</h3>
            <p className="mt-1 text-xs text-slate-300">
              مراقبة حية لتبادل الأدلة والاعتراضات وإعادة التقييم قبل قرار محرك التجميع المستقل.
            </p>
          </div>
        </div>
      </section>

      {/* Recent War Room Sessions & System Performance Summary */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-2xl border border-slate-800/90 bg-[#0D1526] p-6">
          <div className="flex items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
            <h3 className="font-display text-lg font-bold text-slate-50">آخر جلسات التحليل الجماعي</h3>
            <button
              type="button"
              onClick={() => onNavigate('warroom')}
              className="text-xs font-medium text-sky-300 hover:text-sky-200 cursor-pointer"
            >
              فتح غرفة الذكاء
            </button>
          </div>

          {recentSessions.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-400">لم تُنفذ أي جلسة تحليل جماعي بعد في هذه الجلسة.</p>
              <button
                type="button"
                onClick={() => onNavigate('prematch')}
                className="mt-3 rounded-lg bg-slate-800 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 cursor-pointer"
              >
                انتقل لاختيار المباريات وتشغيل التحليل
              </button>
            </div>
          ) : (
            <div className="mt-3 divide-y divide-slate-800/60">
              {recentSessions.slice(0, 4).map((s) => (
                <div key={s.sessionId} className="py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div>
                    <div className="font-semibold text-slate-100">
                      تحليل {s.config.mode === 'LIVE' ? 'مباشر' : 'ما قبل المباراة'} · أود مستهدف {s.config.targetOdds.toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-400 tabular-nums mt-0.5">
                      {s.matchesScanned} مباريات · {s.marketsAnalyzed} سوق · أمان ≥ {s.config.targetProbability}%
                    </div>
                  </div>
                  <div className="font-mono text-xs font-bold text-teal-300 tabular-nums">
                    {s.qualifiedCount} ترشيح مؤهل
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 rounded-2xl border border-slate-800/90 bg-[#0D1526] p-6">
          <div className="flex items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
            <h3 className="font-display text-lg font-bold text-slate-50">ملخص أداء النظام والمعايرة</h3>
            <button
              type="button"
              onClick={() => onNavigate('performance')}
              className="text-xs font-medium text-sky-300 hover:text-sky-200 cursor-pointer"
            >
              التقرير الكامل
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-5">
            <div>
              <div className="text-xs text-slate-400">إجمالي التوقعات المسجلة</div>
              <div className="mt-1 font-mono text-2xl font-bold text-slate-100 tabular-nums">
                {metrics?.totalPredictions ?? 0}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">معدل النجاح الفعلي</div>
              <div className="mt-1 font-mono text-2xl font-bold text-teal-300 tabular-nums">
                {metrics ? `${metrics.actualWinRate}%` : '—'}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Brier Score</div>
              <div className="mt-1 font-mono text-xl font-semibold text-sky-300 tabular-nums">
                {metrics?.brierScore !== null && metrics?.brierScore !== undefined ? metrics.brierScore.toFixed(4) : 'غير متاح بعد'}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Log Loss</div>
              <div className="mt-1 font-mono text-xl font-semibold text-slate-200 tabular-nums">
                {metrics?.logLoss !== null && metrics?.logLoss !== undefined ? metrics.logLoss.toFixed(4) : 'غير متاح بعد'}
              </div>
            </div>
          </div>
          <p className="mt-5 text-xs text-slate-400 leading-relaxed">
            يُحفظ كل ترشيح ببصمة رقمية ثابتة ولا يُعدّل بأثر رجعي لضمان مصداقية المعايرة الإحصائية.
          </p>
        </div>
      </section>
    </div>
  );
};
