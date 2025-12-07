import { useState, useEffect } from 'react';
import { useRunnerStore, StepResult, StepStatus } from '../../stores/runner.store';
import { usePlaybookStore } from '../../stores/playbook.store';
import { useSupabaseStore } from '../../stores/supabase.store';
import { Playbook, PlaybookStep } from '../../../shared/types';

interface RunnerPanelProps {
  playbookId: string;
  onBack: () => void;
  onEdit: () => void;
  fromCatalog?: boolean; // Flag to indicate playbook source
}

export function RunnerPanel({ playbookId, onBack, onEdit, fromCatalog }: RunnerPanelProps) {
  const { selectedPlaybook: localPlaybook, selectPlaybook } = usePlaybookStore();
  const { selectedPlaybook: catalogPlaybook } = useSupabaseStore();
  const { state, isPaused, error, run, runFromCatalog, pause, resume, stop, closeBrowser, reset } = useRunnerStore();
  const [startUrl, setStartUrl] = useState('');

  // Use catalog playbook if available, otherwise local
  const selectedPlaybook = catalogPlaybook || localPlaybook;

  useEffect(() => {
    // Only load from local if we don't already have a catalog playbook
    if (playbookId && !catalogPlaybook) {
      selectPlaybook(playbookId);
    }
    return () => {
      reset();
    };
  }, [playbookId, catalogPlaybook]);

  const handleRun = async () => {
    // Use runFromCatalog if we have a catalog playbook
    if (catalogPlaybook) {
      await runFromCatalog(playbookId, startUrl || undefined);
    } else {
      await run(playbookId, startUrl || undefined);
    }
  };

  const handleClose = async () => {
    await closeBrowser();
    onBack();
  };

  const getStepStatus = (index: number): StepStatus => {
    const result = state.results.find((r) => r.stepIndex === index);
    if (result) return result.status;
    if (state.currentStepIndex === index) return 'running';
    return 'pending';
  };

  const getStepResult = (index: number): StepResult | undefined => {
    return state.results.find((r) => r.stepIndex === index);
  };

  const successCount = state.results.filter((r) => r.status === 'success').length;
  const failedCount = state.results.filter((r) => r.status === 'failed').length;
  const skippedCount = state.results.filter((r) => r.status === 'skipped').length;

  if (!selectedPlaybook) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-muted rounded" aria-label="Back">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                <path d="M10 4L6 8L10 12" strokeWidth="1.5" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-semibold">{selectedPlaybook.metadata.name}</h1>
              <p className="text-sm text-muted-foreground">
                {selectedPlaybook.steps.length}개 단계 | {selectedPlaybook.metadata.category}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="px-3 py-1.5 text-sm hover:bg-muted rounded"
            >
              편집
            </button>
            {!state.isRunning && (
              <button
                onClick={handleRun}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded text-sm font-medium flex items-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4 3L13 8L4 13V3Z" />
                </svg>
                실행
              </button>
            )}
            {state.isRunning && !isPaused && (
              <button
                onClick={pause}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded text-sm font-medium flex items-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="3" y="3" width="4" height="10" />
                  <rect x="9" y="3" width="4" height="10" />
                </svg>
                일시정지
              </button>
            )}
            {state.isRunning && isPaused && (
              <button
                onClick={resume}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm font-medium flex items-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4 3L13 8L4 13V3Z" />
                </svg>
                계속
              </button>
            )}
            {state.isRunning && (
              <button
                onClick={stop}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded text-sm font-medium flex items-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="3" y="3" width="10" height="10" />
                </svg>
                중지
              </button>
            )}
          </div>
        </div>

        {/* Start URL Input */}
        {!state.isRunning && state.results.length === 0 && (
          <div className="mt-3">
            <label className="text-sm text-muted-foreground block mb-1">시작 URL (선택)</label>
            <input
              type="url"
              value={startUrl}
              onChange={(e) => setStartUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
        )}

        {/* Progress Bar */}
        {(state.isRunning || state.results.length > 0) && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm mb-1">
              <span>
                {state.isRunning
                  ? `실행 중 (${state.currentStepIndex + 1}/${state.totalSteps})`
                  : `완료: ${successCount} 성공, ${failedCount} 실패, ${skippedCount} 건너뜀`}
              </span>
              {state.startTime && state.endTime && (
                <span className="text-muted-foreground">
                  {((state.endTime - state.startTime) / 1000).toFixed(1)}초
                </span>
              )}
            </div>
            <div className="h-2 bg-muted rounded overflow-hidden">
              <div
                className={`h-full transition-all ${
                  failedCount > 0 ? 'bg-red-500' : 'bg-green-500'
                }`}
                style={{
                  width: `${((state.currentStepIndex + 1) / state.totalSteps) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 text-red-800 rounded text-sm">{error}</div>
      )}

      {/* Steps List */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-2">
          {selectedPlaybook.steps.map((step, index) => (
            <StepItem
              key={step.id}
              step={step}
              index={index}
              status={getStepStatus(index)}
              result={getStepResult(index)}
              isCurrent={state.currentStepIndex === index}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      {!state.isRunning && state.results.length > 0 && (
        <div className="px-6 py-4 border-t flex items-center justify-between bg-muted/30">
          <div className="text-sm">
            {failedCount > 0 ? (
              <span className="text-red-600">
                {failedCount}개 단계에서 오류가 발생했습니다. 플레이북을 수정하세요.
              </span>
            ) : (
              <span className="text-green-600">모든 단계가 성공적으로 완료되었습니다.</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {failedCount > 0 && (
              <button
                onClick={onEdit}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded text-sm font-medium"
              >
                플레이북 수정
              </button>
            )}
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium"
            >
              메인으로
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Step Item Component
interface StepItemProps {
  step: PlaybookStep;
  index: number;
  status: StepStatus;
  result?: StepResult;
  isCurrent: boolean;
}

function StepItem({ step, index, status, result, isCurrent }: StepItemProps) {
  const [showScreenshot, setShowScreenshot] = useState(false);

  const statusConfig = {
    pending: { icon: '○', color: 'text-gray-400', bg: 'bg-gray-50' },
    running: { icon: '◉', color: 'text-blue-500', bg: 'bg-blue-50' },
    success: { icon: '✓', color: 'text-green-600', bg: 'bg-green-50' },
    failed: { icon: '✗', color: 'text-red-600', bg: 'bg-red-50' },
    skipped: { icon: '⊘', color: 'text-yellow-600', bg: 'bg-yellow-50' },
  };

  const config = statusConfig[status];

  return (
    <div
      className={`p-3 rounded border transition-colors ${isCurrent ? 'border-blue-500 ring-1 ring-blue-500' : ''} ${config.bg}`}
    >
      <div className="flex items-start gap-3">
        {/* Status Icon */}
        <span className={`text-lg ${config.color}`}>{config.icon}</span>

        {/* Step Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">#{index + 1}</span>
            <span className="font-medium">{step.action}</span>
            {step.optional && (
              <span className="text-xs px-1.5 py-0.5 bg-gray-200 rounded">선택</span>
            )}
          </div>

          {step.message && (
            <p className="text-sm text-muted-foreground mt-0.5">{step.message}</p>
          )}

          {step.selector && (
            <p className="text-xs text-muted-foreground font-mono mt-1 truncate">
              {step.selector}
            </p>
          )}

          {/* Result Details */}
          {result && (
            <div className="mt-2 text-sm">
              {result.error && (
                <p className="text-red-600">{result.error}</p>
              )}
              {result.duration && (
                <p className="text-muted-foreground">{result.duration}ms</p>
              )}
            </div>
          )}

          {/* Screenshot */}
          {result?.screenshot && (
            <div className="mt-2">
              <button
                onClick={() => setShowScreenshot(!showScreenshot)}
                className="text-xs text-blue-600 hover:underline"
              >
                {showScreenshot ? '스크린샷 숨기기' : '스크린샷 보기'}
              </button>
              {showScreenshot && (
                <img
                  src={`data:image/png;base64,${result.screenshot}`}
                  alt="Error screenshot"
                  className="mt-2 max-w-full border rounded"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
