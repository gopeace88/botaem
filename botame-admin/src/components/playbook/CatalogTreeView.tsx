import { useEffect, useState, useMemo } from 'react';
import { useSupabaseStore } from '../../stores/supabase.store';
import { PlaybookCatalogItem } from '../../../shared/types';

// Category configuration
const CATEGORY_CONFIG: Record<string, { order: number; icon: string; color: string }> = {
  '회원관리': { order: 1, icon: '👤', color: 'bg-blue-100 text-blue-800' },
  '사업선정': { order: 2, icon: '📝', color: 'bg-indigo-100 text-indigo-800' },
  '교부관리': { order: 3, icon: '📋', color: 'bg-cyan-100 text-cyan-800' },
  '집행관리': { order: 4, icon: '💰', color: 'bg-green-100 text-green-800' },
  '정산관리': { order: 5, icon: '📊', color: 'bg-yellow-100 text-yellow-800' },
  '공통': { order: 6, icon: '🔧', color: 'bg-gray-100 text-gray-800' },
  '기타': { order: 99, icon: '📎', color: 'bg-gray-100 text-gray-600' },
};

// Level configuration
const LEVEL_CONFIG: Record<number, { name: string; icon: string; color: string }> = {
  1: { name: 'Atomic', icon: '⚛️', color: 'bg-purple-100 text-purple-800' },
  2: { name: 'Function', icon: '🔧', color: 'bg-blue-100 text-blue-800' },
  3: { name: 'Scenario', icon: '📋', color: 'bg-green-100 text-green-800' },
};

interface CatalogTreeViewProps {
  onSelectPlaybook?: (playbookId: string) => void;
  onRunPlaybook?: (playbookId: string) => void;
}

export function CatalogTreeView({ onSelectPlaybook, onRunPlaybook }: CatalogTreeViewProps) {
  const {
    connected,
    isLoading,
    catalog,
    catalogByCategory,
    selectedCatalogItem,
    loadCatalog,
    selectCatalogItem,
    loadPlaybookFromCatalog,
    runPlaybookFromCatalog,
  } = useSupabaseStore();

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'category' | 'level'>('level'); // Default to level view

  // Load catalog when connected
  useEffect(() => {
    if (connected) {
      loadCatalog();
    }
  }, [connected, loadCatalog]);

  // Auto-expand categories with items
  useEffect(() => {
    if (Object.keys(catalogByCategory).length > 0) {
      setExpandedCategories(new Set(Object.keys(catalogByCategory)));
    }
  }, [catalogByCategory]);

  // Filter and sort categories
  const sortedCategories = useMemo(() => {
    const filtered: Record<string, PlaybookCatalogItem[]> = {};

    for (const [category, items] of Object.entries(catalogByCategory)) {
      const filteredItems = searchQuery
        ? items.filter(
            item =>
              item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.playbook_id.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : items;

      if (filteredItems.length > 0) {
        filtered[category] = filteredItems;
      }
    }

    return Object.entries(filtered).sort(([a], [b]) => {
      const orderA = CATEGORY_CONFIG[a]?.order ?? 99;
      const orderB = CATEGORY_CONFIG[b]?.order ?? 99;
      return orderA - orderB;
    });
  }, [catalogByCategory, searchQuery]);

  // Group by level (Bottom-up view)
  const sortedByLevel = useMemo(() => {
    const filtered: Record<number, PlaybookCatalogItem[]> = {};

    for (const item of catalog) {
      const level = item.level || 2;
      const matchesSearch = !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.playbook_id.toLowerCase().includes(searchQuery.toLowerCase());

      if (matchesSearch) {
        if (!filtered[level]) filtered[level] = [];
        filtered[level].push(item);
      }
    }

    // Sort: Level 3 (Scenario) first, then 2, then 1
    return Object.entries(filtered)
      .map(([level, items]) => [Number(level), items] as [number, PlaybookCatalogItem[]])
      .sort(([a], [b]) => b - a);
  }, [catalog, searchQuery]);

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

  const handleSelectItem = async (item: PlaybookCatalogItem) => {
    selectCatalogItem(item);
    await loadPlaybookFromCatalog(item.playbook_id);
    onSelectPlaybook?.(item.playbook_id);
  };

  const handleRunPlaybook = async (e: React.MouseEvent, item: PlaybookCatalogItem) => {
    e.stopPropagation(); // Prevent selecting the item
    // Load the playbook first, then navigate to runner
    await loadPlaybookFromCatalog(item.playbook_id);
    onRunPlaybook?.(item.playbook_id);
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

  const getStatusBadge = (item: PlaybookCatalogItem) => {
    if (item.is_published) {
      return <span className="px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700">발행됨</span>;
    }
    if (item.status === 'draft') {
      return <span className="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">초안</span>;
    }
    return null;
  };

  if (!connected) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p className="mb-2">Supabase에 연결되지 않았습니다.</p>
        <p className="text-sm">설정에서 Supabase 연결을 구성하세요.</p>
      </div>
    );
  }

  if (isLoading && catalog.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b">
        <h2 className="font-semibold mb-2">플레이북 카탈로그</h2>
        <p className="text-xs text-muted-foreground mb-3">
          {catalog.length}개 플레이북 (DB)
        </p>

        {/* View Mode Toggle */}
        <div className="flex gap-1 mb-2">
          <button
            onClick={() => setViewMode('level')}
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              viewMode === 'level' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
            }`}
          >
            📊 레벨별
          </button>
          <button
            onClick={() => setViewMode('category')}
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              viewMode === 'category' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
            }`}
          >
            📁 카테고리별
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="검색..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
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
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* Level View */}
        {viewMode === 'level' && (
          sortedByLevel.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>{searchQuery ? '검색 결과가 없습니다.' : '카탈로그가 비어있습니다.'}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {sortedByLevel.map(([level, items]) => {
                const config = LEVEL_CONFIG[level] || { name: `Level ${level}`, icon: '📄', color: 'bg-gray-100 text-gray-800' };
                const isExpanded = expandedCategories.has(`level-${level}`);

                return (
                  <div key={`level-${level}`} className="border rounded overflow-hidden">
                    {/* Level Header */}
                    <button
                      onClick={() => toggleCategory(`level-${level}`)}
                      className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-muted/50 transition-colors text-sm ${
                        isExpanded ? 'bg-muted/30' : ''
                      }`}
                    >
                      <svg
                        className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path d="M6 4L10 8L6 12" strokeWidth="2" />
                      </svg>
                      <span>{config.icon}</span>
                      <span className="font-medium">Level {level}: {config.name}</span>
                      <span className={`ml-auto px-1.5 py-0.5 rounded text-xs ${config.color}`}>
                        {items.length}
                      </span>
                    </button>

                    {/* Items */}
                    {isExpanded && (
                      <div className="border-t">
                        {items.map(item => (
                          <div
                            key={item.id}
                            onClick={() => handleSelectItem(item)}
                            className={`px-3 py-2 pl-9 cursor-pointer transition-colors border-l-2 ${
                              selectedCatalogItem?.id === item.id
                                ? 'bg-primary/10 border-l-primary'
                                : 'hover:bg-muted/30 border-l-transparent'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <svg className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                                <path d="M3 2H10L13 5V14H3V2Z" strokeWidth="1" />
                                <path d="M10 2V5H13" strokeWidth="1" />
                              </svg>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-medium text-sm truncate">{item.name}</span>
                                  <span className={`px-1 py-0.5 rounded text-xs ${CATEGORY_CONFIG[item.category || '기타']?.color || 'bg-gray-100'}`}>
                                    {item.category}
                                  </span>
                                  {getStatusBadge(item)}
                                </div>
                                {item.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>
                                )}
                                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                  <span>{item.step_count}단계</span>
                                  <span className="font-mono text-xs opacity-50">{item.playbook_id}</span>
                                </div>
                              </div>
                              {/* Run Button */}
                              <button
                                onClick={(e) => handleRunPlaybook(e, item)}
                                className="shrink-0 px-2 py-1 rounded text-xs font-medium transition-colors bg-green-100 text-green-700 hover:bg-green-200"
                                title="플레이북 실행"
                              >
                                ▶ 실행
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Category View */}
        {viewMode === 'category' && (
          sortedCategories.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>{searchQuery ? '검색 결과가 없습니다.' : '카탈로그가 비어있습니다.'}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {sortedCategories.map(([category, items]) => {
              const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG['기타'];
              const isExpanded = expandedCategories.has(category);

              return (
                <div key={category} className="border rounded overflow-hidden">
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category)}
                    className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-muted/50 transition-colors text-sm ${
                      isExpanded ? 'bg-muted/30' : ''
                    }`}
                  >
                    {/* Arrow */}
                    <svg
                      className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path d="M6 4L10 8L6 12" strokeWidth="2" />
                    </svg>

                    {/* Icon */}
                    <span>{config.icon}</span>

                    {/* Name */}
                    <span className="font-medium">{category}</span>

                    {/* Count */}
                    <span className={`ml-auto px-1.5 py-0.5 rounded text-xs ${config.color}`}>
                      {items.length}
                    </span>
                  </button>

                  {/* Items */}
                  {isExpanded && (
                    <div className="border-t">
                      {items.map(item => (
                        <div
                          key={item.id}
                          onClick={() => handleSelectItem(item)}
                          className={`px-3 py-2 pl-9 cursor-pointer transition-colors border-l-2 ${
                            selectedCatalogItem?.id === item.id
                              ? 'bg-primary/10 border-l-primary'
                              : 'hover:bg-muted/30 border-l-transparent'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {/* File icon */}
                            <svg
                              className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                            >
                              <path d="M3 2H10L13 5V14H3V2Z" strokeWidth="1" />
                              <path d="M10 2V5H13" strokeWidth="1" />
                            </svg>

                            <div className="flex-1 min-w-0">
                              {/* Name */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-medium text-sm truncate">
                                  {item.name}
                                </span>
                                {item.difficulty && (
                                  <span
                                    className={`px-1 py-0.5 rounded text-xs ${getDifficultyColor(
                                      item.difficulty
                                    )}`}
                                  >
                                    {item.difficulty}
                                  </span>
                                )}
                                {getStatusBadge(item)}
                              </div>

                              {/* Description */}
                              {item.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                  {item.description}
                                </p>
                              )}

                              {/* Meta */}
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <span>{item.step_count}단계</span>
                                {item.estimated_time && <span>{item.estimated_time}</span>}
                                <span className="font-mono text-xs opacity-50">
                                  {item.playbook_id}
                                </span>
                              </div>
                            </div>
                            {/* Run Button */}
                            <button
                              onClick={(e) => handleRunPlaybook(e, item)}
                              className="shrink-0 px-2 py-1 rounded text-xs font-medium transition-colors bg-green-100 text-green-700 hover:bg-green-200"
                              title="플레이북 실행"
                            >
                              ▶ 실행
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t text-xs text-muted-foreground flex items-center justify-between">
        <span>
          {catalog.filter(p => p.is_published).length}개 발행됨
        </span>
        <button
          onClick={() => loadCatalog()}
          disabled={isLoading}
          className="px-2 py-1 hover:bg-muted rounded disabled:opacity-50"
        >
          {isLoading ? '로딩...' : '새로고침'}
        </button>
      </div>
    </div>
  );
}
