import { useEffect, useState, useMemo } from 'react';
import { usePlaybookStore } from '../../stores/playbook.store';
import { PlaybookListItem, Category } from '../../../shared/types';

interface PlaybookListProps {
  onSelect: () => void;
  onNewRecording: () => void;
  onPlay?: (id: string) => void;
}

// Category order and icons
const CATEGORY_CONFIG: Record<Category | '기타', { order: number; icon: string; color: string }> = {
  '교부관리': { order: 1, icon: '📋', color: 'bg-blue-100 text-blue-800' },
  '집행관리': { order: 2, icon: '💰', color: 'bg-green-100 text-green-800' },
  '정산관리': { order: 3, icon: '📊', color: 'bg-yellow-100 text-yellow-800' },
  '사업관리': { order: 4, icon: '📁', color: 'bg-purple-100 text-purple-800' },
  '기타': { order: 5, icon: '📎', color: 'bg-gray-100 text-gray-800' },
};

type ViewMode = 'tree' | 'list';

export function PlaybookList({ onSelect, onNewRecording, onPlay }: PlaybookListProps) {
  const { playbooks, isLoading, error, loadPlaybooks, selectPlaybook, deletePlaybook } =
    usePlaybookStore();
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['교부관리', '집행관리', '정산관리', '사업관리', '기타']));
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadPlaybooks();
  }, [loadPlaybooks]);

  // Group playbooks by category
  const groupedPlaybooks = useMemo(() => {
    const groups: Record<string, PlaybookListItem[]> = {};

    // Initialize all categories
    Object.keys(CATEGORY_CONFIG).forEach(cat => {
      groups[cat] = [];
    });

    // Filter by search query and group
    const filtered = playbooks.filter(pb =>
      !searchQuery ||
      pb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pb.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    filtered.forEach(playbook => {
      const category = playbook.category || '기타';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(playbook);
    });

    // Sort categories by order and filter empty ones
    return Object.entries(groups)
      .filter(([_, items]) => items.length > 0)
      .sort(([a], [b]) => {
        const orderA = CATEGORY_CONFIG[a as Category]?.order ?? 99;
        const orderB = CATEGORY_CONFIG[b as Category]?.order ?? 99;
        return orderA - orderB;
      });
  }, [playbooks, searchQuery]);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedCategories(new Set(Object.keys(CATEGORY_CONFIG)));
  };

  const collapseAll = () => {
    setExpandedCategories(new Set());
  };

  const handleSelect = async (id: string) => {
    await selectPlaybook(id);
    onSelect();
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('이 플레이북을 삭제하시겠습니까?')) {
      await deletePlaybook(id);
    }
  };

  const handlePlay = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onPlay?.(id);
  };

  const getCategoryColor = (category?: string) => {
    return CATEGORY_CONFIG[category as Category]?.color || 'bg-gray-100 text-gray-800';
  };

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty) {
      case '쉬움':
        return 'bg-green-100 text-green-800';
      case '보통':
        return 'bg-yellow-100 text-yellow-800';
      case '어려움':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-red-500">
        <p className="mb-4">{error}</p>
        <button
          onClick={loadPlaybooks}
          className="px-4 py-2 bg-primary text-primary-foreground rounded"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-semibold">플레이북 관리</h1>
            <p className="text-sm text-muted-foreground">{playbooks.length}개의 플레이북</p>
          </div>
          <button
            onClick={onNewRecording}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded text-sm font-medium flex items-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            새 녹화
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="플레이북 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 pl-8 border rounded text-sm bg-muted/30"
            />
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
            >
              <circle cx="7" cy="7" r="5" strokeWidth="1.5" />
              <path d="M11 11L14 14" strokeWidth="1.5" />
            </svg>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center border rounded overflow-hidden">
            <button
              onClick={() => setViewMode('tree')}
              className={`px-3 py-1.5 text-sm ${
                viewMode === 'tree' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
              title="트리 뷰"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                <path d="M2 4H6M2 8H8M2 12H6" strokeWidth="1.5" />
                <path d="M10 6L14 6M10 10L14 10" strokeWidth="1.5" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-sm ${
                viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
              title="목록 뷰"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                <path d="M2 4H14M2 8H14M2 12H14" strokeWidth="1.5" />
              </svg>
            </button>
          </div>

          {/* Expand/Collapse All (Tree mode only) */}
          {viewMode === 'tree' && (
            <div className="flex items-center gap-1">
              <button
                onClick={expandAll}
                className="px-2 py-1.5 text-xs hover:bg-muted rounded"
                title="모두 펼치기"
              >
                펼치기
              </button>
              <button
                onClick={collapseAll}
                className="px-2 py-1.5 text-xs hover:bg-muted rounded"
                title="모두 접기"
              >
                접기
              </button>
            </div>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6">
        {playbooks.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <p className="mb-4">등록된 플레이북이 없습니다.</p>
            <button
              onClick={onNewRecording}
              className="px-4 py-2 bg-primary text-primary-foreground rounded"
            >
              첫 번째 플레이북 만들기
            </button>
          </div>
        ) : viewMode === 'tree' ? (
          /* Tree View */
          <div className="space-y-2">
            {groupedPlaybooks.map(([category, items]) => (
              <CategoryFolder
                key={category}
                category={category}
                items={items}
                isExpanded={expandedCategories.has(category)}
                onToggle={() => toggleCategory(category)}
                onSelect={handleSelect}
                onDelete={handleDelete}
                onPlay={handlePlay}
                getCategoryColor={getCategoryColor}
                getDifficultyColor={getDifficultyColor}
              />
            ))}
          </div>
        ) : (
          /* List View */
          <div className="grid gap-4">
            {playbooks
              .filter(pb =>
                !searchQuery ||
                pb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                pb.description?.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((playbook) => (
                <PlaybookCard
                  key={playbook.id}
                  playbook={playbook}
                  onSelect={() => handleSelect(playbook.id)}
                  onDelete={(e) => handleDelete(e, playbook.id)}
                  onPlay={(e) => handlePlay(e, playbook.id)}
                  getCategoryColor={getCategoryColor}
                  getDifficultyColor={getDifficultyColor}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Category Folder Component for Tree View
interface CategoryFolderProps {
  category: string;
  items: PlaybookListItem[];
  isExpanded: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
  onPlay: (e: React.MouseEvent, id: string) => void;
  getCategoryColor: (category?: string) => string;
  getDifficultyColor: (difficulty?: string) => string;
}

function CategoryFolder({
  category,
  items,
  isExpanded,
  onToggle,
  onSelect,
  onDelete,
  onPlay,
  getCategoryColor,
  getDifficultyColor,
}: CategoryFolderProps) {
  const config = CATEGORY_CONFIG[category as Category] || CATEGORY_CONFIG['기타'];

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Category Header */}
      <button
        onClick={onToggle}
        className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors ${
          isExpanded ? 'bg-muted/30' : ''
        }`}
      >
        {/* Expand/Collapse Arrow */}
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
        >
          <path d="M6 4L10 8L6 12" strokeWidth="1.5" />
        </svg>

        {/* Folder Icon */}
        <span className="text-lg">{config.icon}</span>

        {/* Category Name */}
        <span className="font-medium">{category}</span>

        {/* Item Count */}
        <span className={`px-2 py-0.5 rounded text-xs ${config.color}`}>
          {items.length}개
        </span>
      </button>

      {/* Items */}
      {isExpanded && (
        <div className="border-t divide-y">
          {items.map((playbook) => (
            <PlaybookTreeItem
              key={playbook.id}
              playbook={playbook}
              onSelect={() => onSelect(playbook.id)}
              onDelete={(e) => onDelete(e, playbook.id)}
              onPlay={(e) => onPlay(e, playbook.id)}
              getDifficultyColor={getDifficultyColor}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Tree Item Component (compact version for tree view)
interface PlaybookTreeItemProps {
  playbook: PlaybookListItem;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onPlay: (e: React.MouseEvent) => void;
  getDifficultyColor: (difficulty?: string) => string;
}

function PlaybookTreeItem({
  playbook,
  onSelect,
  onDelete,
  onPlay,
  getDifficultyColor,
}: PlaybookTreeItemProps) {
  return (
    <div
      onClick={onSelect}
      className="pl-12 pr-4 py-2.5 hover:bg-muted/30 cursor-pointer transition-colors group flex items-center"
    >
      {/* File Icon */}
      <svg className="w-4 h-4 mr-3 text-muted-foreground" viewBox="0 0 16 16" fill="none" stroke="currentColor">
        <path d="M3 2H10L13 5V14H3V2Z" strokeWidth="1" />
        <path d="M10 2V5H13" strokeWidth="1" />
      </svg>

      {/* Name and Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{playbook.name}</span>
          {playbook.difficulty && (
            <span className={`px-1.5 py-0.5 rounded text-xs ${getDifficultyColor(playbook.difficulty)}`}>
              {playbook.difficulty}
            </span>
          )}
          <span className="text-xs text-muted-foreground">{playbook.stepCount}단계</span>
        </div>
        {playbook.description && (
          <p className="text-xs text-muted-foreground truncate">{playbook.description}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onPlay}
          className="p-1.5 text-green-600 hover:bg-green-50 rounded"
          title="실행"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 3L13 8L4 13V3Z" />
          </svg>
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 text-red-500 hover:bg-red-50 rounded"
          title="삭제"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor">
            <path d="M4 4L12 12M12 4L4 12" strokeWidth="1.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}

interface PlaybookCardProps {
  playbook: PlaybookListItem;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onPlay: (e: React.MouseEvent) => void;
  getCategoryColor: (category?: string) => string;
  getDifficultyColor: (difficulty?: string) => string;
}

function PlaybookCard({
  playbook,
  onSelect,
  onDelete,
  onPlay,
  getCategoryColor,
  getDifficultyColor,
}: PlaybookCardProps) {
  return (
    <div
      onClick={onSelect}
      className="p-4 border rounded-lg hover:border-primary hover:bg-muted/30 cursor-pointer transition-all group"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium truncate">{playbook.name}</h3>
            {playbook.category && (
              <span className={`px-2 py-0.5 rounded text-xs ${getCategoryColor(playbook.category)}`}>
                {playbook.category}
              </span>
            )}
            {playbook.difficulty && (
              <span
                className={`px-2 py-0.5 rounded text-xs ${getDifficultyColor(playbook.difficulty)}`}
              >
                {playbook.difficulty}
              </span>
            )}
          </div>
          {playbook.description && (
            <p className="text-sm text-muted-foreground truncate">{playbook.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span>{playbook.stepCount}개 단계</span>
            {playbook.updatedAt && (
              <span>수정: {new Date(playbook.updatedAt).toLocaleDateString('ko-KR')}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onPlay}
            className="p-2 text-green-600 hover:bg-green-50 rounded"
            aria-label="실행"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 3L13 8L4 13V3Z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-red-500 hover:bg-red-50 rounded"
            aria-label="삭제"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
              <path d="M4 4L12 12M12 4L4 12" strokeWidth="1.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
