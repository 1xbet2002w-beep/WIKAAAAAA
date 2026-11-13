import React, { useState } from 'react';
import { CheckCircle2, Cpu, Database, PlayCircle, RefreshCw, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import type { AIProviderType, ModelSlotId, SystemSettings } from '../../shared/types';
import type { QATestResult } from '../../server/qaSuite';

interface SettingsAndQAViewProps {
  settings: SystemSettings | null;
  onSaveSettings: (payload: any) => Promise<void>;
  onClearCache: () => Promise<void>;
}

export const SettingsAndQAView: React.FC<SettingsAndQAViewProps> = ({
  settings,
  onSaveSettings,
  onClearCache,
}) => {
  const [connectorInputs, setConnectorInputs] = useState<Record<string, string>>({});
  const [modelEdits, setModelEdits] = useState<
    Record<string, { provider?: AIProviderType; modelName?: string; endpointUrl?: string; enabled?: boolean; customKey?: string }>
  >({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [qaResults, setQaResults] = useState<QATestResult[] | null>(null);
  const [runningQa, setRunningQa] = useState(false);

  if (!settings) {
    return <div className="py-12 text-center text-sm text-slate-400">جارٍ تحميل الإعدادات...</div>;
  }

  const handleSaveAll = async (overrideMode?: 'REAL_API' | 'DEMO_STUDIO') => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const aiModelUpdates = Object.entries(modelEdits).map(([slotId, val]) => ({
        slotId: slotId as ModelSlotId,
        ...val,
      }));
      await onSaveSettings({
        dataSourceMode: overrideMode || settings.dataSourceMode,
        connectorKeyUpdates: connectorInputs,
        aiModelUpdates,
      });
      setConnectorInputs({});
      setSaveMsg('تم حفظ الإعدادات وتحديث موصلات البيانات بنجاح.');
    } catch {
      setSaveMsg('تعذر حفظ الإعدادات.');
    } finally {
      setSaving(false);
    }
  };

  const handleRunQA = async () => {
    setRunningQa(true);
    try {
      const res = await fetch('/api/qa/run');
      const data = await res.json();
      setQaResults(data.results || []);
    } finally {
      setRunningQa(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="text-xs font-mono text-sky-400">DATA CONNECTORS, AI MODELS & QA SUITE</div>
          <h1 className="font-display text-2xl font-extrabold text-slate-50">إدارة مصادر البيانات والنماذج والاختبارات</h1>
        </div>

        <button
          type="button"
          onClick={onClearCache}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#0D1526] px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer whitespace-nowrap"
        >
          <Trash2 className="h-3.5 w-3.5 text-amber-400" />
          <span>مسح الذاكرة المؤقتة (Cache)</span>
        </button>
      </div>

      {/* Mode Switch: Real API vs Demo Studio */}
      <section className="rounded-2xl border border-slate-800/90 bg-[#0D1526] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-50">وضع تشغيل بيانات المباريات</h2>
            <p className="mt-1 text-xs text-slate-400 max-w-2xl">
              يفصل النظام بالكامل بين البيانات الحقيقية الواردة من واجهات API وبين وضع الاستوديو التجريبي (Demo Studio) لاختبار النقاشات والمحاكاة دون خلط النتائج.
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-[#070B14] p-1">
            <button
              type="button"
              onClick={() => handleSaveAll('DEMO_STUDIO')}
              className={`px-4 py-2 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer ${
                settings.dataSourceMode === 'DEMO_STUDIO' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              وضع الاستوديو التجريبي (Demo)
            </button>
            <button
              type="button"
              onClick={() => handleSaveAll('REAL_API')}
              className={`px-4 py-2 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer ${
                settings.dataSourceMode === 'REAL_API' ? 'bg-teal-500/20 text-teal-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              واجهات البيانات الحقيقية (Real API)
            </button>
          </div>
        </div>
      </section>

      {/* Football Data Connectors */}
      <section className="rounded-2xl border border-slate-800/90 bg-[#0D1526] p-6 space-y-5">
        <div className="flex items-center gap-2.5 border-b border-slate-800/80 pb-4">
          <Database className="h-5 w-5 text-sky-400" />
          <div>
            <h2 className="font-display text-lg font-bold text-slate-50">موصلات بيانات كرة القدم والأسعار (Backend Vault)</h2>
            <p className="text-xs text-slate-400">تُحفظ المفاتيح في الخادم فقط ولا تُرسل إلى المتصفح، مع مراقبة حدود الطلبات اليومية.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {settings.connectors.map((c) => (
            <div key={c.id} className="rounded-xl border border-slate-800 bg-[#070B14] p-4 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-sm font-bold text-slate-100">{c.name}</span>
                  <span
                    className={`text-xs font-medium ${
                      c.status === 'CONNECTED'
                        ? 'text-teal-300'
                        : c.status === 'ERROR' || c.status === 'RATE_LIMITED'
                        ? 'text-red-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {c.status === 'CONNECTED' ? 'متصل' : c.status === 'NOT_CONFIGURED' ? 'غير مضبوط' : c.status}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">{c.descriptionAr}</p>
                {c.lastError && <p className="mt-1.5 text-xs text-red-400">{c.lastError}</p>}
              </div>

              <div className="space-y-2.5 pt-2 border-t border-slate-800/70">
                <div className="flex items-center justify-between text-[11px] text-slate-400 tabular-nums">
                  <span>الاستهلاك اليومي</span>
                  <span className="font-mono">
                    {c.requestsUsedToday} / {c.rateLimitDaily}
                  </span>
                </div>
                {c.id !== 'espn_public' ? (
                  <input
                    type="password"
                    placeholder={c.hasKey ? `المفتاح محفوظ (${c.maskedKey})` : 'أدخل API Key لهذا المزود...'}
                    value={connectorInputs[c.id] ?? ''}
                    onChange={(e) => setConnectorInputs((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    className="w-full rounded-lg border border-slate-700/80 bg-[#0B1220] px-3 py-2 font-mono text-xs text-slate-100 focus:border-teal-400 focus:outline-none"
                  />
                ) : (
                  <div className="rounded-lg border border-slate-800 bg-[#0B1220] px-3 py-2 text-[11px] text-teal-300">
                    يعمل تلقائيًا بدون مفتاح لتغطية الأندية والمنتخبات
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3 Independent AI Models Configuration */}
      <section className="rounded-2xl border border-slate-800/90 bg-[#0D1526] p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <Cpu className="h-5 w-5 text-teal-400" />
            <div>
              <h2 className="font-display text-lg font-bold text-slate-50">إعداد النماذج الثلاثة المستقلة (Zero-Budget Ready)</h2>
              <p className="text-xs text-slate-400">
                النماذج الافتراضية تعمل على الباقة المجانية المتاحة عبر الخادم، ويمكن تبديل أي نموذج إلى مزود خارجي (Groq / OpenRouter / OpenAI) دون تعديل الكود.
              </p>
            </div>
          </div>
          <div className="text-xs text-slate-300">
            محرك الخادم الأساسي: <span className={settings.geminiConfigured ? 'text-teal-300 font-semibold' : 'text-amber-300 font-semibold'}>
              {settings.geminiConfigured ? 'مفعّل وجاهز' : 'غير مضبوط في متغيرات البيئة'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {settings.aiModels.map((m) => {
            const edit = modelEdits[m.slotId] || {};
            const currentProvider = edit.provider ?? m.provider;
            const currentModelName = edit.modelName ?? m.modelName;
            const currentEnabled = edit.enabled ?? m.enabled;

            return (
              <div key={m.slotId} className="rounded-xl border border-slate-800 bg-[#070B14] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-display text-sm font-bold text-slate-100">{m.displayNameAr}</div>
                    <div className="text-[11px] text-slate-400">{m.roleTitleAr}</div>
                  </div>
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentEnabled}
                      onChange={(e) =>
                        setModelEdits((prev) => ({
                          ...prev,
                          [m.slotId]: { ...prev[m.slotId], enabled: e.target.checked },
                        }))
                      }
                      className="accent-teal-400"
                    />
                    <span>مفعّل</span>
                  </label>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">المزود</label>
                  <select
                    value={currentProvider}
                    onChange={(e) => {
                      const prov = e.target.value as AIProviderType;
                      const defaultModel =
                        prov === 'GEMINI'
                          ? 'gemini-4-hydrogen'
                          : prov === 'DEEPSEEK'
                          ? 'deepseek-flash'
                          : prov === 'GROQ'
                          ? 'llama-3.3-70b-versatile'
                          : prov === 'OPENROUTER'
                          ? 'meta-llama/llama-3.3-70b-instruct:free'
                          : 'gpt-4o-mini';
                      setModelEdits((prev) => ({
                        ...prev,
                        [m.slotId]: { ...prev[m.slotId], provider: prov, modelName: defaultModel },
                      }));
                    }}
                    className="w-full rounded-lg border border-slate-700/80 bg-[#0B1220] px-2.5 py-1.5 text-xs text-slate-100"
                  >
                    <option value="GEMINI">Gemini (الخادم الرئيسي — مجاني)</option>
                    <option value="DEEPSEEK">DeepSeek (deepseek-flash / v4-pro)</option>
                    <option value="GROQ">Groq (Llama / Mixtral — مجاني)</option>
                    <option value="OPENROUTER">OpenRouter (نماذج متعددة)</option>
                    <option value="OPENAI_COMPATIBLE">OpenAI-Compatible Endpoint</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">اسم النموذج (Model ID)</label>
                  {currentProvider === 'GEMINI' ? (
                    <select
                      value={currentModelName}
                      onChange={(e) =>
                        setModelEdits((prev) => ({
                          ...prev,
                          [m.slotId]: { ...prev[m.slotId], modelName: e.target.value },
                        }))
                      }
                      className="w-full rounded-lg border border-slate-700/80 bg-[#0B1220] px-2.5 py-1.5 font-mono text-xs text-slate-100"
                    >
                      <option value="gemini-4-hydrogen">gemini-4-hydrogen</option>
                      <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={currentModelName}
                      onChange={(e) =>
                        setModelEdits((prev) => ({
                          ...prev,
                          [m.slotId]: { ...prev[m.slotId], modelName: e.target.value },
                        }))
                      }
                      className="w-full rounded-lg border border-slate-700/80 bg-[#0B1220] px-2.5 py-1.5 font-mono text-xs text-slate-100"
                    />
                  )}
                </div>

                {currentProvider !== 'GEMINI' && (
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">مفتاح المزود الخارجي</label>
                    <input
                      type="password"
                      placeholder={m.hasCustomKey ? `محفوظ (${m.maskedCustomKey})` : `أدخل مفتاح ${currentProvider}...`}
                      value={edit.customKey ?? ''}
                      onChange={(e) =>
                        setModelEdits((prev) => ({
                          ...prev,
                          [m.slotId]: { ...prev[m.slotId], customKey: e.target.value },
                        }))
                      }
                      className="w-full rounded-lg border border-slate-700/80 bg-[#0B1220] px-2.5 py-1.5 font-mono text-xs text-slate-100"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-800/80">
          <div className="text-xs text-teal-300">{saveMsg}</div>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSaveAll()}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-teal-400 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${saving ? 'animate-spin' : ''}`} />
            <span>{saving ? 'جارٍ الحفظ...' : 'حفظ إعدادات المصادر والنماذج'}</span>
          </button>
        </div>
      </section>

      {/* 15-Point Quality Assurance Suite */}
      <section className="rounded-2xl border border-slate-800/90 bg-[#0D1526] p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-teal-400" />
            <div>
              <h2 className="font-display text-lg font-bold text-slate-50">مصفوفة الجودة والاختبارات الإلزامية (15 اختبارًا)</h2>
              <p className="text-xs text-slate-400">
                فحص آلي فعلي لقواعد الفلترة، عدم اختراع الأسواق، انقطاع API، تأخر Live، والتسويات الآسيوية الجزئية.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={runningQa}
            onClick={handleRunQA}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400 cursor-pointer whitespace-nowrap"
          >
            <PlayCircle className="h-4 w-4" />
            <span>{runningQa ? 'جارٍ الفحص...' : 'تشغيل الاختبارات الـ 15 الآن'}</span>
          </button>
        </div>

        {qaResults && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {qaResults.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-slate-800 bg-[#070B14] p-3.5 flex items-start gap-3 text-xs"
              >
                {t.passed ? (
                  <CheckCircle2 className="h-4 w-4 text-teal-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-semibold text-slate-100">
                    {t.id}. {t.titleAr}
                  </div>
                  <div className="mt-1 text-slate-400">{t.detailAr}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
