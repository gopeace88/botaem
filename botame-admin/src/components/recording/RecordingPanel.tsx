import { useCallback, useState, useEffect } from 'react';
import { useRecordingStore } from '../../stores/recording.store';
import { PlaybookStep, Category, Difficulty } from '../../../shared/types';

interface RecordingPanelProps {
  onComplete: () => void;
}

export function RecordingPanel({ onComplete }: RecordingPanelProps) {
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [defaultStartUrl, setDefaultStartUrl] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);

  // 기본 URL 및 카테고리 로드 (설정에서)
  useEffect(() => {
    window.electron.invoke('config:getUrl', 'home').then((url: string) => {
      setDefaultStartUrl(url);
    });
    window.electron.invoke('config:getCategories').then((cats: string[]) => {
      setCategories(cats as Category[]);
    });
  }, []);

  const {
    state,
    steps,
    metadata,
    targetUrl,
    isModalOpen,
    setTargetUrl,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecording,
    deleteStep,
    setMetadata,
    openModal,
    closeModal,
    savePlaybook,
  } = useRecordingStore();

  const handleStartStop = useCallback(async () => {
    if (state === 'idle') {
      await startRecording();
    } else {
      await stopRecording();
      openModal();
    }
  }, [state, startRecording, stopRecording, openModal]);

  const handlePauseResume = useCallback(() => {
    if (state === 'recording') {
      pauseRecording();
    } else if (state === 'paused') {
      resumeRecording();
    }
  }, [state, pauseRecording, resumeRecording]);

  const handleSave = useCallback(async () => {
    setSaveError(null);
    setIsSaving(true);
    try {
      const success = await savePlaybook();
      if (success) {
        closeModal();
        onComplete();
      } else {
        setSaveError('플레이북 저장에 실패했습니다. ID와 이름을 확인해주세요.');
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  }, [savePlaybook, closeModal, onComplete]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'navigate':
        return '🔗';
      case 'click':
        return '👆';
      case 'type':
        return '⌨️';
      case 'select':
        return '📋';
      case 'wait':
        return '⏳';
      case 'guide':
        return '💡';
      default:
        return '•';
    }
  };

  const getActionLabel = (step: PlaybookStep) => {
    switch (step.action) {
      case 'navigate':
        return `이동: ${step.value?.slice(0, 30)}...`;
      case 'click':
        return `클릭: ${step.message || step.selector?.slice(0, 30)}`;
      case 'type':
        return `입력: ${step.message || '텍스트 입력'}`;
      case 'select':
        return `선택: ${step.value}`;
      case 'wait':
        return `대기: ${step.timeout}ms`;
      case 'guide':
        return `안내: ${step.message?.slice(0, 30)}`;
      default:
        return step.action;
    }
  };

  const difficulties: Difficulty[] = ['쉬움', '보통', '어려움'];

  return (
    <div className="h-full flex flex-col">
      {/* URL Input */}
      <div className="px-6 py-4 border-b">
        <label className="text-sm text-muted-foreground block mb-2">
          시작 URL (선택사항 - 비워두면 기본 URL 사용)
        </label>
        <input
          type="url"
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          placeholder={defaultStartUrl}
          className="w-full px-3 py-2 border rounded text-sm"
          disabled={state !== 'idle'}
        />
        <p className="text-xs text-muted-foreground mt-1">
          기본: {defaultStartUrl}
        </p>
      </div>

      {/* Recording Controls */}
      <div className="px-6 py-4 border-b">
        <div className="flex items-center gap-2">
          {/* Start/Stop Button */}
          <button
            onClick={handleStartStop}
            className={`flex-1 py-3 px-4 rounded font-medium text-sm transition-colors ${
              state === 'idle'
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-gray-700 hover:bg-gray-800 text-white'
            }`}
          >
            {state === 'idle' ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3 h-3 rounded-full bg-white animate-pulse" />
                녹화 시작
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3 h-3 rounded bg-red-500" />
                녹화 중지
              </span>
            )}
          </button>

          {/* Pause/Resume Button */}
          {state !== 'idle' && (
            <button
              onClick={handlePauseResume}
              className="py-3 px-4 rounded font-medium text-sm bg-yellow-500 hover:bg-yellow-600 text-white"
            >
              {state === 'recording' ? '일시정지' : '재개'}
            </button>
          )}

          {/* Clear Button */}
          {steps.length > 0 && state === 'idle' && (
            <button
              onClick={clearRecording}
              className="py-3 px-4 rounded font-medium text-sm bg-gray-200 hover:bg-gray-300 text-gray-800"
            >
              초기화
            </button>
          )}
        </div>

        {/* Status */}
        <div className="mt-3 text-sm text-muted-foreground flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              state === 'recording'
                ? 'bg-red-500 animate-pulse'
                : state === 'paused'
                ? 'bg-yellow-500'
                : 'bg-gray-400'
            }`}
          />
          {state === 'recording' && '녹화 중... 브라우저에서 작업을 수행하세요.'}
          {state === 'paused' && '일시정지됨'}
          {state === 'idle' && steps.length === 0 && '녹화를 시작하세요.'}
          {state === 'idle' && steps.length > 0 && `${steps.length}개의 단계가 기록되었습니다.`}
        </div>
      </div>

      {/* Steps List */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {steps.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <p className="mb-2">녹화된 단계가 없습니다.</p>
            <p className="text-sm">녹화를 시작하고 브라우저에서 작업을 수행하세요.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {steps.map((step, index) => (
              <li
                key={step.id || index}
                className="flex items-start gap-3 p-3 rounded bg-muted/50 hover:bg-muted group"
              >
                <span className="text-lg shrink-0">{getActionIcon(step.action)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{getActionLabel(step)}</div>
                  {step.selector && (
                    <div className="text-xs text-muted-foreground truncate font-mono">
                      {step.selector}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => deleteStep(index)}
                  className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 p-1"
                  aria-label="삭제"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor">
                    <path d="M3 3L11 11M11 3L3 11" strokeWidth="1.5" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Save Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg shadow-lg w-96 p-6">
            <h3 className="font-semibold text-lg mb-4">플레이북 저장</h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">플레이북 ID *</label>
                <input
                  type="text"
                  value={metadata.id || ''}
                  onChange={(e) => setMetadata({ id: e.target.value })}
                  placeholder="예: auto-login"
                  className="w-full px-3 py-2 border rounded text-sm"
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground block mb-1">이름 *</label>
                <input
                  type="text"
                  value={metadata.name || ''}
                  onChange={(e) => setMetadata({ name: e.target.value })}
                  placeholder="예: 자동 로그인"
                  className="w-full px-3 py-2 border rounded text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">카테고리</label>
                  <select
                    value={metadata.category || '기타'}
                    onChange={(e) => setMetadata({ category: e.target.value as Category })}
                    className="w-full px-3 py-2 border rounded text-sm"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">난이도</label>
                  <select
                    value={metadata.difficulty || '보통'}
                    onChange={(e) => setMetadata({ difficulty: e.target.value as Difficulty })}
                    className="w-full px-3 py-2 border rounded text-sm"
                  >
                    {difficulties.map((diff) => (
                      <option key={diff} value={diff}>
                        {diff}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground block mb-1">설명</label>
                <textarea
                  value={metadata.description || ''}
                  onChange={(e) => setMetadata({ description: e.target.value })}
                  placeholder="이 플레이북이 하는 일을 설명하세요"
                  rows={2}
                  className="w-full px-3 py-2 border rounded text-sm resize-none"
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground block mb-1">시작 URL</label>
                <input
                  type="url"
                  value={metadata.startUrl || ''}
                  onChange={(e) => setMetadata({ startUrl: e.target.value })}
                  placeholder={`${defaultStartUrl} (녹화 시 자동 설정)`}
                  className="w-full px-3 py-2 border rounded text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  비워두면 기본 URL 사용
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">버전</label>
                  <input
                    type="text"
                    value={metadata.version || '1.0.0'}
                    onChange={(e) => setMetadata({ version: e.target.value })}
                    placeholder="1.0.0"
                    className="w-full px-3 py-2 border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">키워드</label>
                  <input
                    type="text"
                    value={(metadata.keywords || []).join(', ')}
                    onChange={(e) => setMetadata({ keywords: e.target.value.split(',').map(k => k.trim()).filter(k => k) })}
                    placeholder="로그인, 인증, 보안"
                    className="w-full px-3 py-2 border rounded text-sm"
                  />
                </div>
              </div>
            </div>

            {/* 에러 메시지 */}
            {saveError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {saveError}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setSaveError(null);
                  closeModal();
                }}
                disabled={isSaving}
                className="flex-1 py-2 px-4 rounded bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={!metadata.id || !metadata.name || isSaving}
                className="flex-1 py-2 px-4 rounded bg-primary hover:bg-primary/90 text-primary-foreground text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
