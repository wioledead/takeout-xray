import { useEffect, useState, useSyncExternalStore } from 'react';
import { BarChart3, BookOpen, Compass, Terminal } from 'lucide-react';
import { xrayClient } from './client/xrayClient';
import { BehaviorTab } from './components/BehaviorTab';
import { DropZoneHero } from './components/DropZoneHero';
import { HeaderTelemetry } from './components/HeaderTelemetry';
import { LexiconTab } from './components/LexiconTab';
import { OverviewTab } from './components/OverviewTab';
import { ShareCardModal } from './components/ShareCardModal';
import { SqlConsoleTab } from './components/SqlConsoleTab';
import { useI18n } from './i18n/useI18n';
import type { DashboardSnapshot, DemoKind, IngestionProgress, TabId } from './types/domain';
import { networkGuard } from './utils/networkGuard';

export function App() {
  const { t } = useI18n();
  const networkState = useSyncExternalStore(networkGuard.subscribe, networkGuard.getSnapshot);

  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [progress, setProgress] = useState<IngestionProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [wrappedOpen, setWrappedOpen] = useState(false);

  useEffect(() => {
    networkGuard.install();
    const unsubscribe = xrayClient.onProgress((p) => {
      setProgress(p);
    });

    xrayClient
      .init()
      .catch(() => {
        // Worker init error will surface cleanly if an operation runs
      })
      .finally(() => {
        networkGuard.markInitialized();
      });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleSelectFile = async (file: File) => {
    setIsLoading(true);
    setErrorMessage(null);
    setProgress({
      phase: 'detecting',
      bytesRead: 0,
      totalBytes: file.size,
      rowsIngested: 0,
      threadsFound: 0,
      elapsedMs: 0,
    });

    try {
      const res = await xrayClient.ingestFile(file);
      setSnapshot(res.snapshot);
      setActiveTab('overview');
    } catch (err) {
      const code = err instanceof Error && 'code' in err ? (err as { code?: string }).code : undefined;
      if (code === 'UNSUPPORTED_FORMAT') {
        setErrorMessage(t.dropzone.unsupportedFormat);
      } else {
        setErrorMessage(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectDemo = async (demo: DemoKind) => {
    setIsLoading(true);
    setErrorMessage(null);
    setProgress({
      phase: 'streaming',
      bytesRead: 0,
      totalBytes: 100,
      rowsIngested: 0,
      threadsFound: 0,
      elapsedMs: 0,
    });

    try {
      const res = await xrayClient.loadDemo(demo);
      setSnapshot(res.snapshot);
      setActiveTab('overview');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectThread = async (threadId: string) => {
    if (!snapshot) return;
    setIsLoading(true);
    try {
      const next = await xrayClient.getDashboard(threadId);
      setSnapshot(next);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    setSnapshot(null);
    setProgress(null);
    setErrorMessage(null);
    setWrappedOpen(false);
    await xrayClient.reset().catch(() => {});
  };

  const tabs: Array<{ id: TabId; label: string; icon: typeof Compass }> = [
    { id: 'overview', label: t.tabs.overview, icon: Compass },
    { id: 'behavior', label: t.tabs.behavior, icon: BarChart3 },
    { id: 'lexicon', label: t.tabs.lexicon, icon: BookOpen },
    { id: 'sql', label: t.tabs.sql, icon: Terminal },
  ];

  return (
    <div className="min-h-screen bg-[#07090D] xray-grid-bg text-slate-100">
      <HeaderTelemetry
        format={snapshot?.format ?? null}
        threads={snapshot?.overview.threads ?? []}
        selectedThreadId={snapshot?.selectedThreadId ?? 'ALL'}
        onSelectThread={(id) => void handleSelectThread(id)}
        onReset={() => void handleReset()}
        onOpenWrapped={() => setWrappedOpen(true)}
        networkState={networkState}
      />

      {!snapshot ? (
        <main>
          <DropZoneHero
            onSelectFile={(f) => void handleSelectFile(f)}
            onSelectDemo={(d) => void handleSelectDemo(d)}
            progress={progress}
            isLoading={isLoading}
            errorMessage={errorMessage}
          />
        </main>
      ) : (
        <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">
          <nav
            aria-label="Forensic views"
            className="mb-6 flex flex-wrap gap-2 border-b border-[#1E293B] pb-3"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-md border px-3.5 py-2 font-mono text-xs font-medium transition cursor-pointer ${
                    isActive
                      ? 'border-[#00FF9D]/60 bg-[#00FF9D]/10 text-[#00FF9D]'
                      : 'border-[#1E293B] bg-[#0D1117] text-slate-400 hover:border-slate-600 hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {activeTab === 'overview' && (
            <OverviewTab format={snapshot.format} overview={snapshot.overview} />
          )}
          {activeTab === 'behavior' && (
            <BehaviorTab format={snapshot.format} behavior={snapshot.behavior} />
          )}
          {activeTab === 'lexicon' && <LexiconTab lexicon={snapshot.lexicon} />}
          {activeTab === 'sql' && (
            <SqlConsoleTab onRunSql={(query) => xrayClient.runSql(query)} />
          )}
        </main>
      )}

      {wrappedOpen && snapshot && (
        <ShareCardModal snapshot={snapshot} onClose={() => setWrappedOpen(false)} />
      )}
    </div>
  );
}

export default App;
