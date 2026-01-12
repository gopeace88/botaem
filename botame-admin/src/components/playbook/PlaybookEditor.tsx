import { useState, useEffect, useCallback } from 'react';
import { usePlaybookStore } from '../../stores/playbook.store';
import { useSupabaseStore } from '../../stores/supabase.store';
import { Playbook, PlaybookStep, Category, Difficulty } from '../../../shared/types';

interface PlaybookEditorProps {
  onBack: () => void;
}

export function PlaybookEditor({ onBack }: PlaybookEditorProps) {
  const { selectedPlaybook: localSelectedPlaybook, savePlaybook, isLoading: localIsLoading } = usePlaybookStore();
  const {
    highlightElement,
    clearHighlight,
    selectedPlaybook: catalogSelectedPlaybook,
    saveCatalogPlaybook,
    isLoading: catalogIsLoading,
  } = useSupabaseStore();

  // Use catalog playbook if available, otherwise local playbook
  const selectedPlaybook = catalogSelectedPlaybook || localSelectedPlaybook;

  const [playbook, setPlaybook] = useState<Playbook | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [previewingStepIndex, setPreviewingStepIndex] = useState<number | null>(null);
  const [highlightError, setHighlightError] = useState<string | null>(null);
  const [isCatalogPlaybook, setIsCatalogPlaybook] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  // 카테고리 목록 로드 (설정에서)
  useEffect(() => {
    window.electron.invoke('config:getCategories').then((cats: string[]) => {
      setCategories(cats as Category[]);
    });
  }, []);

  useEffect(() => {
    if (selectedPlaybook) {
      setPlaybook(JSON.parse(JSON.stringify(selectedPlaybook)));
      setIsDirty(false);
      setIsCatalogPlaybook(!!catalogSelectedPlaybook);
    }
  }, [selectedPlaybook, catalogSelectedPlaybook]);

  const handleMetadataChange = (
    key: keyof Playbook['metadata'],
    value: string
  ) => {
    if (!playbook) return;
    setPlaybook({
      ...playbook,
      metadata: {
        ...playbook.metadata,
        [key]: value,
      },
    });
    setIsDirty(true);
  };

  const handleStepChange = (index: number, key: keyof PlaybookStep, value: string | number) => {
    if (!playbook) return;
    const newSteps = [...playbook.steps];
    newSteps[index] = { ...newSteps[index], [key]: value };
    setPlaybook({ ...playbook, steps: newSteps });
    setIsDirty(true);
  };

  const handleDeleteStep = (index: number) => {
    if (!playbook) return;
    const newSteps = playbook.steps.filter((_, i) => i !== index);
    setPlaybook({ ...playbook, steps: newSteps });
    setIsDirty(true);
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    if (!playbook) return;
    const newSteps = [...playbook.steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSteps.length) return;

    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    setPlaybook({ ...playbook, steps: newSteps });
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!playbook) return;

    let success = false;
    if (isCatalogPlaybook) {
      // 카탈로그 플레이북은 DB에 저장
      const result = await saveCatalogPlaybook(playbook);
      success = result.success;
      if (!success) {
        alert(result.message || '카탈로그 저장 실패');
      }
    } else {
      // 로컬 플레이북은 파일에 저장
      success = await savePlaybook(playbook);
    }

    if (success) {
      setIsDirty(false);
    }
  };

  const handleBack = async () => {
    await clearHighlight();
    if (isDirty) {
      if (confirm('저장하지 않은 변경사항이 있습니다. 나가시겠습니까?')) {
        onBack();
      }
    } else {
      onBack();
    }
  };

  // Preview step in browser by highlighting the selector
  const handlePreviewStep = useCallback(async (index: number, step: PlaybookStep) => {
    setHighlightError(null);

    // If already previewing this step, clear it
    if (previewingStepIndex === index) {
      await clearHighlight();
      setPreviewingStepIndex(null);
      return;
    }

    // Check if step has a selector
    if (!step.selector) {
      setHighlightError('이 단계에는 셀렉터가 없습니다');
      setPreviewingStepIndex(null);
      return;
    }

    // Highlight the element
    const result = await highlightElement(step.selector);
    if (result.success) {
      setPreviewingStepIndex(index);
    } else {
      setHighlightError(result.error || '요소를 찾을 수 없습니다');
      setPreviewingStepIndex(null);
    }
  }, [previewingStepIndex, highlightElement, clearHighlight]);

  // Clear highlight when unmounting
  useEffect(() => {
    return () => {
      clearHighlight();
    };
  }, [clearHighlight]);

  if (!playbook) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">플레이북을 선택하세요</p>
      </div>
    );
  }

  const difficulties: Difficulty[] = ['쉬움', '보통', '어려움'];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={handleBack} className="p-2 hover:bg-muted rounded" aria-label="뒤로">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
              <path d="M10 4L6 8L10 12" strokeWidth="1.5" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">{playbook.metadata.name}</h1>
              {isCatalogPlaybook && (
                <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">카탈로그</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{playbook.steps.length}개 단계</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isDirty && <span className="text-xs text-yellow-600">변경사항 있음</span>}
          <button
            onClick={handleSave}
            disabled={!isDirty || localIsLoading || catalogIsLoading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium disabled:opacity-50"
          >
            {(localIsLoading || catalogIsLoading) ? '저장 중...' : (isCatalogPlaybook ? 'DB 저장' : '저장')}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {/* Metadata Section */}
          <section className="border rounded-lg p-4">
            <h2 className="font-medium mb-4">메타데이터</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">ID</label>
                <input
                  type="text"
                  value={playbook.metadata.id}
                  onChange={(e) => handleMetadataChange('id', e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm"
                  disabled
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">이름</label>
                <input
                  type="text"
                  value={playbook.metadata.name}
                  onChange={(e) => handleMetadataChange('name', e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">카테고리</label>
                <select
                  value={playbook.metadata.category || '기타'}
                  onChange={(e) => handleMetadataChange('category', e.target.value)}
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
                  value={playbook.metadata.difficulty || '보통'}
                  onChange={(e) => handleMetadataChange('difficulty', e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm"
                >
                  {difficulties.map((diff) => (
                    <option key={diff} value={diff}>
                      {diff}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-sm text-muted-foreground block mb-1">설명</label>
                <textarea
                  value={playbook.metadata.description || ''}
                  onChange={(e) => handleMetadataChange('description', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border rounded text-sm resize-none"
                />
              </div>
            </div>
          </section>

          {/* Steps Section */}
          <section className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium">단계 ({playbook.steps.length})</h2>
              {highlightError && (
                <span className="text-xs text-red-500">{highlightError}</span>
              )}
            </div>
            <div className="space-y-3">
              {playbook.steps.map((step, index) => (
                <StepEditor
                  key={step.id || index}
                  step={step}
                  index={index}
                  totalSteps={playbook.steps.length}
                  isPreviewing={previewingStepIndex === index}
                  onChange={(key, value) => handleStepChange(index, key, value)}
                  onDelete={() => handleDeleteStep(index)}
                  onMove={(dir) => handleMoveStep(index, dir)}
                  onPreview={() => handlePreviewStep(index, step)}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

interface StepEditorProps {
  step: PlaybookStep;
  index: number;
  totalSteps: number;
  isPreviewing?: boolean;
  onChange: (key: keyof PlaybookStep, value: string | number) => void;
  onDelete: () => void;
  onMove: (direction: 'up' | 'down') => void;
  onPreview?: () => void;
}

function StepEditor({ step, index, totalSteps, isPreviewing, onChange, onDelete, onMove, onPreview }: StepEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

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

  return (
    <div className={`border rounded p-3 transition-colors ${
      isPreviewing ? 'bg-orange-50 border-orange-300' : 'bg-muted/20'
    }`}>
      <div className="flex items-center gap-2">
        <span className="text-lg">{getActionIcon(step.action)}</span>
        <span className="text-xs text-muted-foreground">#{index + 1}</span>
        <span className="font-medium text-sm">{step.action}</span>
        <span className="text-sm text-muted-foreground truncate flex-1">
          {step.message || step.selector?.slice(0, 40)}
        </span>

        <div className="flex items-center gap-1">
          {/* Preview button - only show if step has a selector */}
          {step.selector && onPreview && (
            <button
              onClick={onPreview}
              className={`p-1 rounded transition-colors ${
                isPreviewing
                  ? 'bg-orange-500 text-white'
                  : 'text-orange-500 hover:bg-orange-50'
              }`}
              title={isPreviewing ? '미리보기 끄기' : '브라우저에서 미리보기'}
              aria-label={isPreviewing ? '미리보기 끄기' : '브라우저에서 미리보기'}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor">
                <circle cx="7" cy="7" r="3" strokeWidth="1.5" />
                <circle cx="7" cy="7" r="6" strokeWidth="1.5" />
              </svg>
            </button>
          )}
          <button
            onClick={() => onMove('up')}
            disabled={index === 0}
            className="p-1 hover:bg-muted rounded disabled:opacity-30"
            aria-label="위로"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor">
              <path d="M7 3V11M7 3L3 7M7 3L11 7" strokeWidth="1.5" />
            </svg>
          </button>
          <button
            onClick={() => onMove('down')}
            disabled={index === totalSteps - 1}
            className="p-1 hover:bg-muted rounded disabled:opacity-30"
            aria-label="아래로"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor">
              <path d="M7 11V3M7 11L3 7M7 11L11 7" strokeWidth="1.5" />
            </svg>
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-muted rounded"
            aria-label="확장"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            >
              <path d="M3 5L7 9L11 5" strokeWidth="1.5" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-red-500 hover:bg-red-50 rounded"
            aria-label="삭제"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor">
              <path d="M3 3L11 11M11 3L3 11" strokeWidth="1.5" />
            </svg>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-3 text-sm">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">메시지</label>
            <input
              type="text"
              value={step.message || ''}
              onChange={(e) => onChange('message', e.target.value)}
              className="w-full px-2 py-1.5 border rounded text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">타임아웃 (ms)</label>
            <input
              type="number"
              value={step.timeout || 5000}
              onChange={(e) => onChange('timeout', parseInt(e.target.value) || 5000)}
              className="w-full px-2 py-1.5 border rounded text-sm"
            />
          </div>
          {step.selector && (
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground block mb-1">셀렉터</label>
              <input
                type="text"
                value={step.selector}
                onChange={(e) => onChange('selector', e.target.value)}
                className="w-full px-2 py-1.5 border rounded text-sm font-mono"
              />
            </div>
          )}
          {step.value !== undefined && (
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground block mb-1">값</label>
              <input
                type="text"
                value={step.value}
                onChange={(e) => onChange('value', e.target.value)}
                className="w-full px-2 py-1.5 border rounded text-sm"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
