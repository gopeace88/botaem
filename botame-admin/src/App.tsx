import { useState } from 'react';
import { PlaybookList } from './components/playbook/PlaybookList';
import { CatalogTreeView } from './components/playbook/CatalogTreeView';
import { RecordingPanel } from './components/recording/RecordingPanel';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { RunnerPanel } from './components/runner/RunnerPanel';
import { usePlaybookStore } from './stores/playbook.store';
import { useRecordingStore } from './stores/recording.store';
import { useSupabaseStore } from './stores/supabase.store';

type View = 'list' | 'catalog' | 'recording' | 'settings' | 'runner';

function App() {
  const [currentView, setCurrentView] = useState<View>('list');
  const [previousView, setPreviousView] = useState<View>('list');
  const [runnerPlaybookId, setRunnerPlaybookId] = useState<string | null>(null);
  const { clearSelection, selectPlaybook } = usePlaybookStore();
  const { state: recordingState } = useRecordingStore();
  const {
    connected: supabaseConnected,
    selectCatalogItem,
  } = useSupabaseStore();

  const handleNewPlaybook = () => {
    clearSelection();
    selectCatalogItem(null);
    setCurrentView('recording');
  };

  const handleBackToList = () => {
    const targetView = previousView === 'catalog' ? 'catalog' : 'list';
    clearSelection();
    selectCatalogItem(null);
    setRunnerPlaybookId(null);
    setCurrentView(targetView);
    setPreviousView('list');
  };

  const handleRecordingComplete = () => {
    setCurrentView('list');
  };

  // 플레이북 선택 시 RunnerPanel로 이동 (편집+실행 통합)
  const handleSelectPlaybook = async (id: string, fromCatalog: boolean = false) => {
    setRunnerPlaybookId(id);
    setPreviousView(fromCatalog ? 'catalog' : 'list');
    if (!fromCatalog) {
      await selectPlaybook(id);
    }
    setCurrentView('runner');
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Title Bar */}
      <header
        className="flex items-center justify-between h-10 px-4 bg-primary text-primary-foreground select-none"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">보탬e 관리자</span>
          <span className="text-xs text-primary-foreground/60">
            {currentView === 'list' && '로컬 플레이북'}
            {currentView === 'catalog' && 'DB 카탈로그'}
            {currentView === 'recording' && '녹화 모드'}
            {currentView === 'runner' && '플레이북 편집/실행'}
            {currentView === 'settings' && 'Supabase 설정'}
          </span>
        </div>

        <div
          className="flex items-center gap-1"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {recordingState === 'recording' && (
            <span className="flex items-center gap-1 text-xs text-red-400 mr-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              녹화 중
            </span>
          )}

          <button
            onClick={() => window.electron.invoke('window:minimize')}
            className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded"
            aria-label="최소화"
          >
            <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
              <rect width="10" height="1" />
            </svg>
          </button>
          <button
            onClick={() => window.electron.invoke('window:maximize')}
            className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded"
            aria-label="최대화"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor">
              <rect x="0.5" y="0.5" width="9" height="9" strokeWidth="1" />
            </svg>
          </button>
          <button
            onClick={() => window.electron.invoke('window:close')}
            className="w-8 h-8 flex items-center justify-center hover:bg-red-500 rounded"
            aria-label="닫기"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>
      </header>

      {/* Navigation */}
      <nav className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
        <button
          onClick={() => {
            setPreviousView('list');
            setCurrentView('list');
          }}
          className={`px-3 py-1.5 text-sm rounded transition-colors ${
            currentView === 'list'
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted'
          }`}
        >
          로컬
        </button>
        <button
          onClick={() => {
            setPreviousView('catalog');
            setCurrentView('catalog');
          }}
          className={`px-3 py-1.5 text-sm rounded transition-colors flex items-center gap-1 ${
            currentView === 'catalog'
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${supabaseConnected ? 'bg-green-400' : 'bg-gray-400'}`} />
          카탈로그
        </button>
        <button
          onClick={handleNewPlaybook}
          className={`px-3 py-1.5 text-sm rounded transition-colors ${
            currentView === 'recording'
              ? 'bg-red-500 text-white'
              : 'hover:bg-muted'
          }`}
        >
          새 녹화
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setCurrentView('settings')}
            className={`px-3 py-1.5 text-sm rounded transition-colors flex items-center gap-1 ${
              currentView === 'settings'
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                supabaseConnected ? 'bg-green-500' : 'bg-gray-400'
              }`}
            />
            Supabase
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {currentView === 'list' && (
          <PlaybookList
            onSelect={(id: string) => { handleSelectPlaybook(id, false); }}
            onNewRecording={handleNewPlaybook}
            onPlay={(id: string) => { handleSelectPlaybook(id, false); }}
          />
        )}
        {currentView === 'catalog' && (
          <CatalogTreeView
            onSelectPlaybook={(playbookId) => handleSelectPlaybook(playbookId, true)}
            onRunPlaybook={(playbookId) => handleSelectPlaybook(playbookId, true)}
          />
        )}
        {currentView === 'recording' && (
          <RecordingPanel onComplete={handleRecordingComplete} />
        )}
        {currentView === 'runner' && runnerPlaybookId && (
          <RunnerPanel
            playbookId={runnerPlaybookId}
            onBack={handleBackToList}
          />
        )}
        {currentView === 'settings' && (
          <SettingsPanel onBack={handleBackToList} />
        )}
      </main>

      {/* Status Bar */}
      <footer className="h-6 px-4 flex items-center justify-between text-xs text-muted-foreground border-t">
        <span>v1.0.0</span>
        <span>관리자 모드</span>
      </footer>
    </div>
  );
}

export default App;
