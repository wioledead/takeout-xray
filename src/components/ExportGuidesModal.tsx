import { useEffect, useState } from 'react';
import { BookOpen, Check, Copy, FileArchive, Info, X } from 'lucide-react';
import { EXPORT_GUIDES, type GuideServiceId } from '../i18n/exportGuides';
import { useI18n } from '../i18n/useI18n';

interface ExportGuidesModalProps {
  initialService?: GuideServiceId;
  onClose: () => void;
}

export function ExportGuidesModal({
  initialService = 'antigravity',
  onClose,
}: ExportGuidesModalProps) {
  const { lang, t } = useI18n();
  const guides = EXPORT_GUIDES[lang];
  const [selectedId, setSelectedId] = useState<GuideServiceId>(initialService);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const activeGuide = guides.find((g) => g.id === selectedId) ?? guides[0];

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1600);
    } catch {
      // Clipboard API unavailable
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.dropzone.guidesModalTitle}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[#1E293B] bg-[#0D1117] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#1E293B] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <BookOpen className="h-4 w-4 text-[#00FF9D]" />
            <div>
              <h2 className="font-mono text-sm font-bold text-slate-100">
                {t.dropzone.guidesModalTitle}
              </h2>
              <p className="text-xs text-slate-400">{t.dropzone.guidesModalSubtitle}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t.shareModal.close}
            className="rounded border border-[#1E293B] p-1.5 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
          <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-[#1E293B] bg-[#07090D] p-3 md:w-56 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r">
            {guides.map((g) => {
              const isSelected = g.id === activeGuide.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedId(g.id)}
                  className={`flex shrink-0 items-center gap-2.5 rounded border px-3 py-2 text-left font-mono text-xs transition cursor-pointer ${
                    isSelected
                      ? 'border-[#00FF9D]/60 bg-[#00FF9D]/10 text-slate-100'
                      : 'border-transparent text-slate-400 hover:border-[#1E293B] hover:bg-[#0D1117] hover:text-slate-200'
                  }`}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: g.badgeColor }}
                  />
                  <span className="truncate">{g.name}</span>
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: activeGuide.badgeColor }}
              />
              <h3 className="font-mono text-base font-bold text-slate-100">{activeGuide.name}</h3>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded border border-[#1E293B] bg-[#07090D] px-3 py-2 font-mono text-[11px] text-slate-300">
              <FileArchive className="h-3.5 w-3.5 shrink-0 text-[#38BDF8]" />
              <span className="text-slate-500">{t.dropzone.guidesExpectedLabel}:</span>
              <span className="text-[#38BDF8]">{activeGuide.expectedFiles}</span>
            </div>

            {activeGuide.paths && activeGuide.paths.length > 0 && (
              <div className="mt-3 space-y-2">
                {activeGuide.paths.map((p) => {
                  const key = `${activeGuide.id}:${p.label}`;
                  const isCopied = copiedKey === key;
                  return (
                    <div
                      key={key}
                      className="flex flex-wrap items-center justify-between gap-2 rounded border border-[#1E293B] bg-[#07090D] px-3 py-2 font-mono text-[11px]"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="mr-2 text-slate-500">{p.label}:</span>
                        <code className="select-all break-all text-[#00FF9D]">{p.value}</code>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleCopy(key, p.value)}
                        className="inline-flex shrink-0 items-center gap-1 rounded border border-[#1E293B] bg-[#0D1117] px-2 py-0.5 text-[10px] text-slate-300 transition hover:border-[#00FF9D]/50 hover:text-[#00FF9D] cursor-pointer"
                      >
                        {isCopied ? (
                          <>
                            <Check className="h-3 w-3 text-[#00FF9D]" />
                            <span className="text-[#00FF9D]">{t.dropzone.copiedPath}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>{t.dropzone.copyPath}</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <ol className="mt-4 space-y-3">
              {activeGuide.steps.map((step, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-3 rounded border border-[#1E293B]/60 bg-[#07090D]/60 p-3 text-xs leading-relaxed text-slate-200"
                >
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded font-mono text-[11px] font-bold"
                    style={{
                      backgroundColor: `${activeGuide.badgeColor}20`,
                      color: activeGuide.badgeColor,
                    }}
                  >
                    {idx + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            {activeGuide.tip && (
              <div className="mt-4 flex items-start gap-2.5 rounded border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-3 text-xs text-amber-200">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#F59E0B]" />
                <span>{activeGuide.tip}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
