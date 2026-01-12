/**
 * Playbook Types - 플레이북 관련 타입 정의
 * @module @botame/core/types/playbook
 */

// ============================================
// 기본 타입
// ============================================

/** 지원하는 액션 타입 */
export const ACTION_TYPES = [
  'navigate',
  'click',
  'type',
  'select',
  'wait',
  'guide',
  'scroll',
  'hover',
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

/** 난이도 */
export const DIFFICULTY_LEVELS = ['쉬움', '보통', '어려움'] as const;
export type Difficulty = (typeof DIFFICULTY_LEVELS)[number];

/** 카테고리 (사이트 프로필에 따라 동적 정의) */
export type Category = string;

// ============================================
// 셀렉터 타입
// ============================================

/** 셀렉터 전략 */
export const SELECTOR_STRATEGIES = [
  'css',
  'xpath',
  'text',
  'role',
  'testId',
  'placeholder',
  'label',
] as const;

export type SelectorStrategy = (typeof SELECTOR_STRATEGIES)[number];

/** 셀렉터 정보 */
export interface SelectorInfo {
  strategy: SelectorStrategy;
  value: string;
  priority: number; // 낮을수록 높은 우선순위
}

/** 신뢰도가 포함된 셀렉터 */
export interface SelectorWithScore {
  strategy: SelectorStrategy;
  value: string;
  confidence: number; // 0-100, 높을수록 안정적
}

// ============================================
// 플레이북 구조
// ============================================

/**
 * 플레이북 스텝
 * @example
 * const step: PlaybookStep = {
 *   id: 'step-1',
 *   action: 'click',
 *   selector: '[aria-label="로그인"]',
 *   message: '로그인 버튼 클릭',
 * };
 */
export interface PlaybookStep {
  id: string;
  action: ActionType;
  selector?: string; // Primary selector (하위 호환)
  selectors?: SelectorInfo[]; // Multiple fallback selectors
  value?: string;
  message?: string;
  timeout?: number;
  optional?: boolean;
  waitAfter?: number;
}

/**
 * 플레이북 메타데이터
 */
export interface PlaybookMetadata {
  id: string;
  name: string;
  version: string;
  description?: string;
  category?: Category;
  difficulty?: Difficulty;
  keywords?: string[];
  estimatedTime?: string;
  createdAt?: string;
  updatedAt?: string;
  startUrl?: string;
  /** 자연어 별칭 (2~3레벨 단순화 구조) */
  aliases?: string[];
}

/**
 * 플레이북
 */
export interface Playbook {
  metadata: PlaybookMetadata;
  steps: PlaybookStep[];
}

/**
 * 플레이북 목록 아이템
 */
export interface PlaybookListItem {
  id: string;
  name: string;
  description?: string;
  category?: Category;
  difficulty?: Difficulty;
  stepCount: number;
  filePath: string;
  updatedAt?: string;
}

/**
 * 플레이북 카탈로그 아이템 (Supabase)
 */
export interface PlaybookCatalogItem {
  id: string;
  playbook_id: string;
  name: string;
  description: string;
  category: string;
  difficulty: string;
  estimated_time: string;
  version: string;
  is_published: boolean;
  status: string;
  keywords: string[];
  updated_at: string;
  step_count: number;
  level: number;
  start_url: string;
  aliases?: string[];
}

// ============================================
// 녹화 타입
// ============================================

/** 녹화 상태 */
export type RecordingState = 'idle' | 'recording' | 'paused';

/** 녹화된 액션 */
export interface RecordedAction {
  type: ActionType;
  selector?: string;
  selectors?: SelectorInfo[];
  value?: string;
  timestamp: number;
  clickX?: number;
  clickY?: number;
  elementInfo?: ElementInfo;
}

/** 요소 정보 */
export interface ElementInfo {
  tagName: string;
  id?: string;
  className?: string;
  text?: string;
  placeholder?: string;
  type?: string;
  role?: string;
  ariaLabel?: string;
  name?: string;
  dataTestId?: string;
}
