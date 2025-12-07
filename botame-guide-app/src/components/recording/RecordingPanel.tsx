import { useEffect, useCallback } from 'react';
import { useRecordingStore } from '@/stores/recording.store';
import { PlaybookStep } from '@electron/playbook/types';

interface RecordingPanelProps {
  onClose?: () => void;
}

export function RecordingPanel({ onClose }: RecordingPanelProps) {
  const {
    state,
    steps,
    metadata,
    isModalOpen,
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
    addStep,
  } = useRecordingStore();

  // Subscribe to recording events from main process
  useEffect(() => {
    const unsubAction = window.electron.on('recording:action', (_action: unknown, step: unknown) => {
      addStep(step as PlaybookStep);
    });

    return () => {
      unsubAction();
    };
  }, [addStep]);

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
    const success = await savePlaybook();
    if (success) {
      closeModal();
      onClose?.();
    }
  }, [savePlaybook, closeModal, onClose]);

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

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h2 className="font-semibold text-sm">녹화 모드</h2>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
          aria-label="닫기"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>

      {/* Recording Controls */}
      <div className="px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          {/* Start/Stop Button */}
          <button
            onClick={handleStartStop}
            className={`flex-1 py-2 px-4 rounded font-medium text-sm transition-colors ${
              state === 'idle'
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
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
              className="py-2 px-4 rounded font-medium text-sm bg-yellow-500 hover:bg-yellow-600 text-white"
            >
              {state === 'recording' ? '일시정지' : '재개'}
            </button>
          )}

          {/* Clear Button */}
          {steps.length > 0 && state === 'idle' && (
            <button
              onClick={clearRecording}
              className="py-2 px-4 rounded font-medium text-sm bg-gray-200 hover:bg-gray-300 text-gray-800"
            >
              초기화
            </button>
          )}
        </div>

        {/* Status */}
        <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
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
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {steps.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            녹화된 단계가 없습니다.
          </div>
        ) : (
          <ul className="space-y-2">
            {steps.map((step, index) => (
              <li
                key={step.id || index}
                className="flex items-start gap-2 p-2 rounded bg-muted/50 hover:bg-muted group"
              >
                <span className="text-lg shrink-0">{getActionIcon(step.action)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{getActionLabel(step)}</div>
                  {step.selector && (
                    <div className="text-xs text-muted-foreground truncate">
                      {step.selector}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => deleteStep(index)}
                  className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 p-1"
                  aria-label="삭제"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                    <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" />
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
          <div className="bg-background rounded-lg shadow-lg w-80 p-4">
            <h3 className="font-semibold mb-4">플레이북 저장</h3>

            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">
                  플레이북 ID
                </label>
                <input
                  type="text"
                  value={metadata.id}
                  onChange={(e) => setMetadata({ id: e.target.value })}
                  placeholder="예: auto-login"
                  className="w-full px-3 py-2 border rounded text-sm"
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground block mb-1">
                  이름
                </label>
                <input
                  type="text"
                  value={metadata.name}
                  onChange={(e) => setMetadata({ name: e.target.value })}
                  placeholder="예: 자동 로그인"
                  className="w-full px-3 py-2 border rounded text-sm"
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground block mb-1">
                  설명
                </label>
                <textarea
                  value={metadata.description}
                  onChange={(e) => setMetadata({ description: e.target.value })}
                  placeholder="이 플레이북이 하는 일을 설명하세요"
                  rows={2}
                  className="w-full px-3 py-2 border rounded text-sm resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={closeModal}
                className="flex-1 py-2 px-4 rounded bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={!metadata.id || !metadata.name}
                className="flex-1 py-2 px-4 rounded bg-primary hover:bg-primary/90 text-primary-foreground text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RecordingPanel;
