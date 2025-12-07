/**
 * Playbook Types - Shared between Electron and Renderer
 */

export type ActionType = 'navigate' | 'click' | 'type' | 'select' | 'wait' | 'guide' | 'scroll' | 'hover';
export type Category = '교부관리' | '집행관리' | '정산관리' | '사업관리' | '기타';
export type Difficulty = '쉬움' | '보통' | '어려움';

// Selector strategy types for multi-selector support
export type SelectorStrategy = 'css' | 'xpath' | 'text' | 'role' | 'testId' | 'placeholder' | 'label';

export interface SelectorInfo {
  strategy: SelectorStrategy;
  value: string;
  priority: number; // Lower is higher priority
}

export interface PlaybookStep {
  id: string;
  action: ActionType;
  selector?: string;  // Primary selector (backward compatible)
  selectors?: SelectorInfo[];  // Multiple fallback selectors
  value?: string;
  message?: string;
  timeout?: number;
  optional?: boolean;
  waitAfter?: number;
}

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
}

export interface Playbook {
  metadata: PlaybookMetadata;
  steps: PlaybookStep[];
}

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

// Playbook Catalog Item (from Supabase)
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
}

// Recording Types
export type RecordingState = 'idle' | 'recording' | 'paused';

export interface RecordedAction {
  type: ActionType;
  selector?: string;
  selectors?: SelectorInfo[];  // Multiple fallback selectors
  value?: string;
  timestamp: number;
  // 클릭 좌표 (CDP로 정확한 요소 조회용)
  clickX?: number;
  clickY?: number;
  elementInfo?: {
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
  };
}

// IPC Result Types
export interface IpcResult<T = unknown> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}

// ============================================
// 보탬e v2: 스냅샷 & 자가 치유 타입
// ============================================

/**
 * DOM 스냅샷 - 녹화 시점의 요소 상태
 */
export interface DOMSnapshot {
  timestamp: number;
  url: string;
  viewport: { width: number; height: number };
  elements: ElementSnapshot[];
}

/**
 * 요소 스냅샷 - 개별 요소의 완전한 정보
 */
export interface ElementSnapshot {
  // 식별자
  nodeId: number;
  backendNodeId: number;

  // 기본 정보
  tagName: string;
  attributes: Record<string, string>;
  textContent?: string;

  // 위치 정보
  boundingBox: BoundingBox;
  isVisible: boolean;
  isInViewport: boolean;

  // 계층 정보
  xpath: string;
  cssPath: string;
  parentNodeId?: number;

  // 접근성 정보
  role?: string;
  name?: string;
  description?: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 스마트 셀렉터 - 다중 전략 + 신뢰도
 */
export interface SmartSelector {
  primary: SelectorWithScore;
  fallbacks: SelectorWithScore[];
  coordinates: BoundingBox;
  elementHash: string;  // 요소 변경 감지용
  snapshot?: ElementSnapshot;
}

export interface SelectorWithScore {
  strategy: SelectorStrategy;
  value: string;
  confidence: number;  // 0-100, 높을수록 안정적
}

/**
 * 의미론적 워크플로우 스텝
 */
export interface SemanticStep extends PlaybookStep {
  smartSelector?: SmartSelector;
  waitCondition?: WaitCondition;
  onFailure?: FailureStrategy;
  healingHistory?: HealingRecord[];
}

export interface WaitCondition {
  type: 'visible' | 'hidden' | 'enabled' | 'networkIdle' | 'custom';
  timeout?: number;
  customScript?: string;
}

export type FailureStrategy = 'skip' | 'retry' | 'heal' | 'stop' | 'ask';

/**
 * 자가 치유 기록
 */
export interface HealingRecord {
  timestamp: number;
  originalSelector: string;
  healedSelector: string;
  strategy: SelectorStrategy;
  success: boolean;
}

/**
 * 실행 컨텍스트
 */
export interface ExecutionContext {
  currentUrl: string;
  snapshot?: DOMSnapshot;
  variables: Record<string, string>;
  healingEnabled: boolean;
}

// ============================================
// 보탬e v3: CDP-First Semantic Recording
// ============================================

/**
 * 요소 식별자 (v3)
 *
 * 핵심 원칙: Accessibility Tree 정보를 최우선으로 사용
 * DOM 구조 변경에도 role + name은 안정적으로 유지됨
 */
export interface ElementIdentity {
  // === 1순위: Accessibility 기반 (가장 안정적) ===
  axRole?: string;           // "button", "textbox", "link", "tab", etc.
  axName?: string;           // Computed accessible name (동적 상태 제거됨)

  // === 2순위: 시맨틱 속성 ===
  ariaLabel?: string;        // 원본 aria-label
  dataTestId?: string;       // data-testid 속성
  name?: string;             // form elements의 name 속성

  // === 3순위: 구조적 속성 ===
  tagName: string;
  id?: string;               // 안정적인 ID만 저장 (동적 ID 제외)
  type?: string;             // input type
  placeholder?: string;

  // === 4순위: 시각적 특성 ===
  boundingBox: BoundingBox;
  visualHash?: string;       // 색상, 크기 기반 해시 (레이아웃 변경 대응)

  // === 메타데이터 ===
  backendNodeId: number;     // CDP backendNodeId (세션 내 고유)
  textContent?: string;      // 요소의 텍스트 (50자 제한)
  capturedAt: number;        // 캡처 타임스탬프

  // === 부모 정보 (컨텍스트) ===
  parentRole?: string;
  parentName?: string;
}

/**
 * 확장된 매칭 전략 (v3)
 */
export type MatchingStrategy =
  | 'accessibility'  // getByRole(role, { name })
  | 'ariaLabel'      // [aria-label="..."]
  | 'name'           // [name="..."]
  | 'testId'         // [data-testid="..."]
  | 'placeholder'    // [placeholder="..."]
  | 'text'           // :has-text("...")
  | 'css'            // CSS selector
  | 'xpath'          // XPath
  | 'visual'         // Visual similarity
  | 'coordinates';   // 좌표 기반

/**
 * 확장된 SemanticStep (v3)
 */
export interface SemanticStepV3 extends PlaybookStep {
  // v3: 새로운 요소 식별 시스템
  identity?: ElementIdentity;

  // v2 하위 호환
  smartSelector?: SmartSelector;
  waitCondition?: WaitCondition;
  onFailure?: FailureStrategy;
  healingHistory?: HealingRecord[];
}

/**
 * 매칭 결과 (v3)
 */
export interface MatchResult {
  success: boolean;
  strategy: MatchingStrategy;
  selector?: string;
  confidence: number;        // 0-100
  elementFound?: boolean;
  error?: string;
}

/**
 * 확장된 치유 기록 (v3)
 */
export interface HealingRecordV3 extends HealingRecord {
  matchingStrategy: MatchingStrategy;
  identity?: ElementIdentity;
  attemptedStrategies: MatchingStrategy[];
}
