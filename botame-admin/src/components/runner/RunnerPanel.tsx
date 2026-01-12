import { useState, useEffect, useCallback } from 'react';
import { useRunnerStore, StepResult, StepStatus } from '../../stores/runner.store';
import { usePlaybookStore } from '../../stores/playbook.store';
import { useSupabaseStore } from '../../stores/supabase.store';
import { PlaybookStep, Playbook } from '../../../shared/types';

interface RunnerPanelProps {
  playbookId: string;
  onBack: () => void;
  fromCatalog?: boolean;
}

type RunMode = 'idle' | 'step' | 'full';

export function RunnerPanel({ playbookId, onBack }: RunnerPanelProps) {
  const { selectedPlaybook: localPlaybook, selectPlaybook, savePlaybook } = usePlaybookStore();
  const { selectedPlaybook: catalogPlaybook, saveCatalogPlaybook } = useSupabaseStore();
  const {
    state,
    isPaused,
    isPicking,
    error,
    run,
    runFromCatalog,
    runSingleStep,
    pause,
    resume,
    stop,
    reset,
    pickElement,
    cancelPicking,
    highlightElement,
    clearHighlight,
  } = useRunnerStore();

  // 로컬 편집용 플레이북 상태
  const [editablePlaybook, setEditablePlaybook] = useState<Playbook | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [startUrl, setStartUrl] = useState('');
  const [defaultStartUrl, setDefaultStartUrl] = useState('');
  const [runMode, setRunMode] = useState<RunMode>('idle');
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [expandedStepIndex, setExpandedStepIndex] = useState<number | null>(null);
  const [localStepResults, setLocalStepResults] = useState<Map<number, StepResult>>(new Map());

  // 원본 플레이북 (카탈로그 또는 로컬)
  const sourcePlaybook = catalogPlaybook || localPlaybook;

  // 기본 URL 로드 (설정에서)
  useEffect(() => {
    window.electron.invoke('config:getUrl', 'home').then((url: string) => {
      setDefaultStartUrl(url);
    });
  }, []);

  useEffect(() => {
    if (playbookId && !catalogPlaybook) {
      selectPlaybook(playbookId);
    }
    return () => {
      reset();
    };
  }, [playbookId, catalogPlaybook]);

  // 원본 플레이북이 로드되면 편집용 복사본 생성
  useEffect(() => {
    if (sourcePlaybook) {
      setEditablePlaybook(JSON.parse(JSON.stringify(sourcePlaybook)));
      setHasChanges(false);
    }
  }, [sourcePlaybook]);

  // 플레이북 저장
  const handleSave = useCallback(async () => {
    if (!editablePlaybook) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      if (catalogPlaybook) {
        await saveCatalogPlaybook(editablePlaybook);
      } else {
        await savePlaybook(editablePlaybook);
      }
      setHasChanges(false);
      setSaveMessage('저장되었습니다');
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (err) {
      setSaveMessage('저장 실패: ' + (err instanceof Error ? err.message : '알 수 없는 오류'));
    } finally {
      setIsSaving(false);
    }
  }, [editablePlaybook, catalogPlaybook, saveCatalogPlaybook, savePlaybook]);

  // 스텝 업데이트
  const updateStep = useCallback((index: number, updates: Partial<PlaybookStep>) => {
    if (!editablePlaybook) return;

    const updatedSteps = [...editablePlaybook.steps];
    updatedSteps[index] = { ...updatedSteps[index], ...updates };

    setEditablePlaybook({
      ...editablePlaybook,
      steps: updatedSteps,
    });
    setHasChanges(true);
  }, [editablePlaybook]);

  // 스텝 삭제
  const deleteStep = useCallback((index: number) => {
    if (!editablePlaybook) return;

    const updatedSteps = editablePlaybook.steps.filter((_, i) => i !== index);
    setEditablePlaybook({
      ...editablePlaybook,
      steps: updatedSteps,
    });
    setHasChanges(true);
    setExpandedStepIndex(null);
  }, [editablePlaybook]);

  // 스텝 순서 변경
  const moveStep = useCallback((index: number, direction: 'up' | 'down') => {
    if (!editablePlaybook) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= editablePlaybook.steps.length) return;

    const updatedSteps = [...editablePlaybook.steps];
    [updatedSteps[index], updatedSteps[newIndex]] = [updatedSteps[newIndex], updatedSteps[index]];

    setEditablePlaybook({
      ...editablePlaybook,
      steps: updatedSteps,
    });
    setHasChanges(true);
    setExpandedStepIndex(newIndex);
  }, [editablePlaybook]);

  // 전체 실행
  const handleRunAll = async () => {
    if (!editablePlaybook) return;

    // 변경사항이 있으면 먼저 저장
    if (hasChanges) {
      await handleSave();
    }

    setRunMode('full');
    setLocalStepResults(new Map());

    if (catalogPlaybook) {
      await runFromCatalog(playbookId, startUrl || undefined);
    } else {
      await run(playbookId, startUrl || undefined);
    }
  };

  // 단일 스텝 실행
  const handleRunStep = async (step: PlaybookStep, index: number) => {
    setRunMode('step');
    const result = await runSingleStep(step, index);
    setLocalStepResults((prev) => new Map(prev).set(index, result));
  };

  // 요소 피킹
  const handlePickSelector = async (stepIndex: number) => {
    setEditingStepIndex(stepIndex);
    const picked = await pickElement();

    if (picked && picked.selector) {
      updateStep(stepIndex, { selector: picked.selector });
      // 결과 초기화
      setLocalStepResults((prev) => {
        const newMap = new Map(prev);
        newMap.delete(stepIndex);
        return newMap;
      });
    }

    setEditingStepIndex(null);
  };

  // 중복 호출 방지를 위한 플래그
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = async () => {
    // 이미 닫기 처리 중이면 무시
    if (isClosing) return;
    setIsClosing(true);

    try {
      if (hasChanges) {
        const confirm = window.confirm('저장하지 않은 변경사항이 있습니다. 저장하시겠습니까?');
        if (confirm) {
          await handleSave();
        }
      }
      // 브라우저 상태만 정리 (메인 페이지 이동 불필요)
      await clearHighlight();
      onBack();
    } catch (error) {
      console.error('[RunnerPanel] Close error:', error);
      onBack();
    }
  };

  const getStepStatus = (index: number): StepStatus => {
    // 스텝 모드: 로컬 결과 우선
    const localResult = localStepResults.get(index);
    if (localResult) return localResult.status;

    // 전체 실행 모드: state 결과 사용
    const result = state.results.find((r) => r.stepIndex === index);
    if (result) return result.status;
    if (state.currentStepIndex === index && state.isRunning) return 'running';
    return 'pending';
  };

  const getStepResult = (index: number): StepResult | undefined => {
    const localResult = localStepResults.get(index);
    if (localResult) return localResult;
    return state.results.find((r) => r.stepIndex === index);
  };

  const successCount = state.results.filter((r) => r.status === 'success').length;
  const failedCount = state.results.filter((r) => r.status === 'failed').length;

  if (!editablePlaybook) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-background">
        {/* Title Row */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={handleClose} className="p-2 hover:bg-muted rounded" aria-label="Back">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
              <path d="M10 4L6 8L10 12" strokeWidth="1.5" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold flex items-center gap-2">
              {editablePlaybook.metadata.name}
              {hasChanges && <span className="text-orange-500 text-sm">(수정됨)</span>}
            </h1>
            <p className="text-sm text-muted-foreground">
              {editablePlaybook.steps.length}개 단계 | {editablePlaybook.metadata.category}
              {catalogPlaybook ? ' | 카탈로그' : ' | 로컬'}
            </p>
          </div>
          {/* Save Button - always visible when changes exist */}
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50"
            >
              {isSaving ? '저장 중...' : '💾 저장'}
            </button>
          )}
          {saveMessage && (
            <span className={`text-sm ${saveMessage.includes('실패') ? 'text-red-500' : 'text-green-500'}`}>
              {saveMessage}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Run All Button */}
          {!state.isRunning && (
            <button
              onClick={handleRunAll}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded text-sm font-medium flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 3L13 8L4 13V3Z" />
              </svg>
              전체 실행
            </button>
          )}

          {/* Pause/Resume/Stop */}
          {state.isRunning && !isPaused && (
            <button
              onClick={pause}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded text-sm font-medium"
            >
              일시정지
            </button>
          )}
          {state.isRunning && isPaused && (
            <button
              onClick={resume}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm font-medium"
            >
              계속
            </button>
          )}
          {state.isRunning && (
            <button
              onClick={stop}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded text-sm font-medium"
            >
              중지
            </button>
          )}
        </div>

        {/* Start URL Input */}
        <div className="mt-3">
          <label className="text-sm text-muted-foreground block mb-1">시작 URL</label>
          <input
            type="url"
            value={startUrl || editablePlaybook.metadata.startUrl || ''}
            onChange={(e) => setStartUrl(e.target.value)}
            placeholder={editablePlaybook.metadata.startUrl || defaultStartUrl}
            className="w-full px-3 py-2 border rounded text-sm"
            disabled={state.isRunning}
          />
          {!editablePlaybook.metadata.startUrl && (
            <p className="text-xs text-muted-foreground mt-1">
              플레이북에 시작 URL이 저장되어 있지 않습니다. 비워두면 기본 URL 사용
            </p>
          )}
        </div>

        {/* Progress Bar */}
        {(state.isRunning || state.results.length > 0) && runMode === 'full' && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm mb-1">
              <span>
                {state.isRunning
                  ? `실행 중 (${state.currentStepIndex + 1}/${state.totalSteps})`
                  : `완료: ${successCount} 성공, ${failedCount} 실패`}
              </span>
              {state.startTime && state.endTime && (
                <span className="text-muted-foreground">
                  {((state.endTime - state.startTime) / 1000).toFixed(1)}초
                </span>
              )}
            </div>
            <div className="h-2 bg-muted rounded overflow-hidden">
              <div
                className={`h-full transition-all ${failedCount > 0 ? 'bg-red-500' : 'bg-green-500'}`}
                style={{ width: `${((state.currentStepIndex + 1) / state.totalSteps) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 text-red-800 rounded text-sm">{error}</div>
      )}

      {/* Picking Mode Indicator */}
      {isPicking && (
        <div className="mx-6 mt-4 p-3 bg-purple-50 text-purple-800 rounded text-sm flex items-center justify-between">
          <span>🎯 브라우저에서 요소를 클릭하세요</span>
          <button
            onClick={cancelPicking}
            className="px-2 py-1 bg-purple-200 hover:bg-purple-300 rounded text-xs"
          >
            취소 (ESC)
          </button>
        </div>
      )}

      {/* Steps List */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-2">
          {editablePlaybook.steps.map((step, index) => (
            <StepItem
              key={step.id || index}
              step={step}
              index={index}
              totalSteps={editablePlaybook.steps.length}
              status={getStepStatus(index)}
              result={getStepResult(index)}
              isCurrent={state.currentStepIndex === index && state.isRunning}
              isExpanded={expandedStepIndex === index}
              isEditing={editingStepIndex === index}
              isPicking={isPicking}
              isRunning={state.isRunning}
              onToggleExpand={() => setExpandedStepIndex(expandedStepIndex === index ? null : index)}
              onRunStep={() => handleRunStep(step, index)}
              onPickSelector={() => handlePickSelector(index)}
              onHighlightSelector={highlightElement}
              onClearHighlight={clearHighlight}
              onUpdateStep={(updates) => updateStep(index, updates)}
              onDeleteStep={() => deleteStep(index)}
              onMoveUp={() => moveStep(index, 'up')}
              onMoveDown={() => moveStep(index, 'down')}
            />
          ))}
        </div>
      </div>

      {/* Footer - Results Summary */}
      {!state.isRunning && state.results.length > 0 && runMode === 'full' && (
        <div className="px-6 py-4 border-t flex items-center justify-between bg-muted/30">
          <div className="text-sm">
            {failedCount > 0 ? (
              <span className="text-red-600">
                {failedCount}개 단계에서 오류 발생 - 해당 스텝을 클릭하여 수정하세요
              </span>
            ) : (
              <span className="text-green-600">모든 단계가 성공적으로 완료되었습니다</span>
            )}
          </div>
          <button
            onClick={() => {
              reset();
              setLocalStepResults(new Map());
              setRunMode('idle');
            }}
            className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded text-sm"
          >
            결과 초기화
          </button>
        </div>
      )}
    </div>
  );
}

// Step Item Component
interface StepItemProps {
  step: PlaybookStep;
  index: number;
  totalSteps: number;
  status: StepStatus;
  result?: StepResult;
  isCurrent: boolean;
  isExpanded: boolean;
  isEditing: boolean;
  isPicking: boolean;
  isRunning: boolean;
  onToggleExpand: () => void;
  onRunStep: () => void;
  onPickSelector: () => void;
  onHighlightSelector: (selector: string) => Promise<{ success: boolean; error?: string }>;
  onClearHighlight: () => Promise<void>;
  onUpdateStep: (updates: Partial<PlaybookStep>) => void;
  onDeleteStep: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function StepItem({
  step,
  index,
  totalSteps,
  status,
  result,
  isCurrent,
  isExpanded,
  isEditing,
  isPicking,
  isRunning,
  onToggleExpand,
  onRunStep,
  onPickSelector,
  onHighlightSelector,
  onClearHighlight,
  onUpdateStep,
  onDeleteStep,
  onMoveUp,
  onMoveDown,
}: StepItemProps) {
  const [isStepRunning, setIsStepRunning] = useState(false);
  const [showScreenshot, setShowScreenshot] = useState(false);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const [highlightError, setHighlightError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<'valid' | 'invalid' | null>(null);

  const statusConfig = {
    pending: { icon: '○', color: 'text-gray-400', bg: 'bg-white border-gray-200' },
    running: { icon: '◉', color: 'text-blue-500', bg: 'bg-blue-50 border-blue-300' },
    success: { icon: '✓', color: 'text-green-600', bg: 'bg-green-50 border-green-300' },
    failed: { icon: '✗', color: 'text-red-600', bg: 'bg-red-50 border-red-300' },
    skipped: { icon: '⊘', color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-300' },
  };

  const config = statusConfig[status];

  const handleRunClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsStepRunning(true);
    await onRunStep();
    setIsStepRunning(false);
  };

  // 셀렉터 검증 및 하이라이트 (통합)
  const handleValidateClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setHighlightError(null);
    setValidationResult(null);

    if (isHighlighted) {
      // 하이라이트 해제
      await onClearHighlight();
      setIsHighlighted(false);
      return;
    }

    // 셀렉터 검증
    if (!step.selector) {
      setHighlightError('셀렉터 없음');
      setValidationResult('invalid');
      return;
    }

    setIsValidating(true);
    const result = await onHighlightSelector(step.selector);
    setIsValidating(false);

    if (result.success) {
      setIsHighlighted(true);
      setValidationResult('valid');
    } else {
      setHighlightError(result.error || '요소를 찾을 수 없습니다');
      setValidationResult('invalid');
    }
  };

  const canPickSelector = ['click', 'type', 'select', 'hover', 'scroll'].includes(step.action);

  return (
    <div
      className={`rounded border transition-all ${config.bg} ${
        isCurrent ? 'ring-2 ring-blue-500' : ''
      } ${isEditing ? 'ring-2 ring-purple-500' : ''}`}
    >
      {/* Step Header - Always Visible */}
      <div
        className="p-3 flex items-center gap-3 cursor-pointer hover:bg-black/5"
        onClick={onToggleExpand}
      >
        {/* Status Icon */}
        <span className={`text-lg ${config.color} shrink-0`}>
          {isStepRunning ? '◉' : config.icon}
        </span>

        {/* Step Summary */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono">#{index + 1}</span>
            <span className="font-medium">{step.action}</span>
            {step.optional && (
              <span className="text-xs px-1.5 py-0.5 bg-gray-200 rounded">선택</span>
            )}
            {result?.healed && (
              <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded flex items-center gap-1">
                🔧 복구됨
              </span>
            )}
            {highlightError && (
              <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded">
                {highlightError}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {step.message || step.selector || step.value || '-'}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* 셀렉터 검증 버튼 - 상태에 따라 색상 변경 */}
          {canPickSelector && step.selector && (
            <button
              onClick={handleValidateClick}
              disabled={isPicking || isValidating}
              className={`p-1.5 rounded transition-colors ${
                isValidating
                  ? 'text-blue-500 bg-blue-100'
                  : isHighlighted
                    ? 'text-green-600 bg-green-100 hover:bg-green-200'
                    : validationResult === 'invalid'
                      ? 'text-red-600 bg-red-100 hover:bg-red-200'
                      : 'text-orange-500 hover:bg-orange-100'
              } disabled:opacity-30`}
              title={
                isValidating
                  ? '검증 중...'
                  : isHighlighted
                    ? '하이라이트 해제'
                    : validationResult === 'invalid'
                      ? '셀렉터 오류 - 다시 검증'
                      : '셀렉터 검증'
              }
            >
              {isValidating ? (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="4 2" />
                </svg>
              ) : isHighlighted ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <circle cx="8" cy="8" r="6" />
                  <path d="M5 8L7 10L11 6" stroke="white" strokeWidth="1.5" fill="none" />
                </svg>
              ) : validationResult === 'invalid' ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <circle cx="8" cy="8" r="6" />
                  <path d="M5.5 5.5L10.5 10.5M10.5 5.5L5.5 10.5" stroke="white" strokeWidth="1.5" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <circle cx="8" cy="8" r="6" />
                </svg>
              )}
            </button>
          )}

          {/* Run Step Button */}
          <button
            onClick={handleRunClick}
            disabled={isStepRunning || isPicking || isRunning}
            className="p-1.5 text-green-600 hover:bg-green-100 rounded disabled:opacity-30"
            title="이 스텝만 실행"
          >
            {isStepRunning ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="4 2" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M5 3L12 8L5 13V3Z" />
              </svg>
            )}
          </button>

          {/* Pick Selector */}
          {canPickSelector && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPickSelector();
              }}
              disabled={isPicking || isRunning}
              className="p-1.5 text-purple-600 hover:bg-purple-100 rounded disabled:opacity-30"
              title="요소 다시 선택"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="6" cy="6" r="4" />
                <path d="M9 9L14 14" />
              </svg>
            </button>
          )}

          {/* Expand/Collapse */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            >
              <path d="M4 6L8 10L12 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded Edit Panel */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-0 border-t bg-white/50">
          <div className="space-y-3 mt-3">
            {/* Message */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">설명 메시지</label>
              <input
                type="text"
                value={step.message || ''}
                onChange={(e) => onUpdateStep({ message: e.target.value })}
                className="w-full px-2 py-1.5 border rounded text-sm"
                placeholder="이 단계가 하는 일"
              />
            </div>

            {/* Selector (if applicable) */}
            {canPickSelector && (
              <div>
                <label className="text-xs text-muted-foreground block mb-1 flex items-center justify-between">
                  <span>셀렉터</span>
                  <button
                    onClick={onPickSelector}
                    disabled={isPicking || isRunning}
                    className="text-purple-600 hover:underline text-xs disabled:opacity-50"
                  >
                    다시 선택
                  </button>
                </label>
                <input
                  type="text"
                  value={step.selector || ''}
                  onChange={(e) => onUpdateStep({ selector: e.target.value })}
                  className="w-full px-2 py-1.5 border rounded text-sm font-mono"
                  placeholder="CSS 또는 XPath 셀렉터"
                />
              </div>
            )}

            {/* Value (for type, navigate, etc.) */}
            {['type', 'navigate', 'select'].includes(step.action) && (
              <div>
                <label className="text-xs text-muted-foreground block mb-1">값</label>
                <input
                  type="text"
                  value={step.value || ''}
                  onChange={(e) => onUpdateStep({ value: e.target.value })}
                  className="w-full px-2 py-1.5 border rounded text-sm"
                  placeholder={step.action === 'navigate' ? 'URL' : '입력할 값'}
                />
              </div>
            )}

            {/* Timeout */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">타임아웃 (ms)</label>
              <input
                type="number"
                value={step.timeout || 30000}
                onChange={(e) => onUpdateStep({ timeout: parseInt(e.target.value) || 30000 })}
                className="w-full px-2 py-1.5 border rounded text-sm"
              />
            </div>

            {/* Healed Result - 셀렉터 자동 복구 성공 */}
            {result?.healed && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded text-sm">
                <div className="flex items-center gap-2 text-amber-800 mb-1">
                  <span className="text-base">🔧</span>
                  <strong>셀렉터 자동 복구됨</strong>
                  <span className="text-xs bg-amber-100 px-1.5 py-0.5 rounded">
                    {result.healMethod === 'fallback' && '폴백 셀렉터'}
                    {result.healMethod === 'dynamic' && '동적 탐색'}
                    {result.healMethod === 'text' && '텍스트 매칭'}
                    {result.healMethod === 'aria' && 'ARIA 매칭'}
                    {result.healMethod === 'manual' && '수동 수정'}
                  </span>
                </div>
                <div className="text-xs space-y-1 text-amber-700">
                  <div><span className="text-muted-foreground">기존:</span> <code className="bg-amber-100 px-1 rounded">{result.originalSelector}</code></div>
                  <div><span className="text-muted-foreground">변경:</span> <code className="bg-green-100 px-1 rounded">{result.healedSelector}</code></div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (result.healedSelector) {
                      onUpdateStep({ selector: result.healedSelector });
                    }
                  }}
                  className="mt-2 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs"
                >
                  플레이북에 적용
                </button>
              </div>
            )}

            {/* Error Result - 실패 및 수동 고침 필요 */}
            {result?.error && (
              <div className="p-2 bg-red-50 border border-red-200 rounded text-sm">
                <div className="text-red-700 mb-2">
                  <strong>오류:</strong> {result.error}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPickSelector();
                    }}
                    disabled={isPicking || isRunning}
                    className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded text-xs flex items-center gap-1 disabled:opacity-50"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="6" cy="6" r="4" />
                      <path d="M9 9L14 14" />
                    </svg>
                    수동으로 요소 선택
                  </button>
                  <span className="text-xs text-muted-foreground">
                    브라우저에서 올바른 요소를 클릭하세요
                  </span>
                </div>
              </div>
            )}

            {/* Screenshot */}
            {result?.screenshot && (
              <div>
                <button
                  onClick={() => setShowScreenshot(!showScreenshot)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {showScreenshot ? '스크린샷 숨기기' : '스크린샷 보기'}
                </button>
                {showScreenshot && (
                  <img
                    src={`data:image/png;base64,${result.screenshot}`}
                    alt="Step screenshot"
                    className="mt-2 max-w-full border rounded"
                  />
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-1">
                {/* Move Up */}
                <button
                  onClick={onMoveUp}
                  disabled={index === 0}
                  className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-30"
                  title="위로 이동"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M8 4L8 12M8 4L4 8M8 4L12 8" />
                  </svg>
                </button>
                {/* Move Down */}
                <button
                  onClick={onMoveDown}
                  disabled={index === totalSteps - 1}
                  className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-30"
                  title="아래로 이동"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M8 12L8 4M8 12L4 8M8 12L12 8" />
                  </svg>
                </button>
              </div>

              {/* Delete */}
              <button
                onClick={onDeleteStep}
                className="px-2 py-1 text-red-600 hover:bg-red-50 rounded text-sm"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
