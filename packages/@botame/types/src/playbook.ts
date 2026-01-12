/**
 * Playbook Types - 플레이북 관련 타입 정의
 * @module @botame/types/playbook
 */

// ============================================
// 기본 타입
// ============================================

/** 지원하는 액션 타입 */
export const ACTION_TYPES = [
  "navigate",
  "click",
  "type",
  "select",
  "wait",
  "guide",
  "scroll",
  "hover",
  // Guide app additional actions
  "assert",
  "highlight",
  "condition",
  "loop",
  "extract",
  "validate",
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

/** Guide app specific action types (includes all ActionType plus more) */
export type StepAction = ActionType;

/** 난이도 */
export const DIFFICULTY_LEVELS = ["쉬움", "보통", "어려움"] as const;
export type Difficulty = (typeof DIFFICULTY_LEVELS)[number];

/** 카테고리 (사이트 프로필에 따라 동적 정의) */
export type Category = string;

// ============================================
// 셀렉터 타입
// ============================================

/** 셀렉터 전략 */
export const SELECTOR_STRATEGIES = [
  "css",
  "xpath",
  "text",
  "role",
  "testId",
  "placeholder",
  "label",
] as const;

export type SelectorStrategy = (typeof SELECTOR_STRATEGIES)[number];

/** 셀렉터 정보 */
export interface SelectorInfo {
  strategy: SelectorStrategy;
  value: string;
  priority: number; // 낮을수록 높은 우선순위
}

// ============================================
// 가이드 앱 확장 타입
// ============================================

export type WaitFor =
  | "element"
  | "navigation"
  | "network"
  | "user"
  | "user_input";
export type OnError = "retry" | "skip" | "abort";
export type ErrorAction = "retry" | "skip" | "abort" | "guide";
export type PreconditionAction = "warn" | "block";
export type VariableType = "string" | "number" | "date" | "select" | "boolean";

/** 스텝 검증 (Interactive Watch & Guide) */
export interface StepVerify {
  success_selector?: string;
  success_url_contains?: string;
  success_text?: string;
  condition?: string;
  fallback_vision?: boolean;
}

export type VerifyMethod = "dom" | "vision";

export interface VerifyResult {
  success: boolean;
  method: VerifyMethod;
  message?: string;
  guidance?: string;
  retryCount: number;
}

/** 변수 정의 */
export interface VariableDefinition {
  type: VariableType;
  label: string;
  required?: boolean;
  default?: string;
  options?: string[] | Array<{ value: string; label: string }>;
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
}

/** 사전 조건 */
export interface Precondition {
  check: string;
  message: string;
  action: PreconditionAction;
}

/** 에러 핸들러 */
export interface ErrorHandler {
  match: string;
  action: ErrorAction;
  message?: string;
}

// ============================================
// 플레이북 구조
// ============================================

/**
 * 플레이북 스텝 (통합 버전)
 * admin과 guide 앱 모두에서 사용
 */
export interface PlaybookStep {
  // === 기본 필드 (모든 앱 공통) ===
  id: string;
  action: ActionType;
  selector?: string; // Primary selector (하위 호환)
  selectors?: SelectorInfo[]; // Multiple fallback selectors
  value?: string;
  message?: string;
  timeout?: number;
  optional?: boolean;
  waitAfter?: number;

  // === 가이드 앱 확장 (선택적) ===
  wait_for?: WaitFor;
  condition?: string;
  on_error?: OnError;
  then?: PlaybookStep[];
  else?: PlaybookStep[];
  variable?: string;
  steps?: PlaybookStep[];
  verify?: StepVerify;

  // === 실행 히스토리 (런타임 전용) ===
  healingHistory?: import("./execution").HealingRecord[];

  [key: string]: unknown; // Index signature for interpolation
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
  estimated_time?: string; // 가이드 앱 호환용
  createdAt?: string;
  updatedAt?: string;
  last_updated?: string; // 가이드 앱 호환용
  startUrl?: string;
  start_url?: string; // 가이드 앱 호환용
  author?: string;
  /** 자연어 별칭 (2~3레벨 단순화 구조) */
  aliases?: string[];
}

/**
 * 플레이북 (통합 버전)
 */
export interface Playbook {
  metadata: PlaybookMetadata;
  steps: PlaybookStep[];

  // === 가이드 앱 확장 ===
  variables?: Record<string, VariableDefinition>;
  preconditions?: Precondition[];
  error_handlers?: ErrorHandler[];
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
// 녹화 타입 (다른 모듈에서 정의)
// ============================================

// RecordingState은 recording.ts에서 정의
// RecordedAction은 recording.ts에서 정의
// ElementInfo는 recording.ts에서 정의

// ============================================
// 유효성 검증 타입
// ============================================

/** 유효성 검증 결과 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/** 유효성 검증 에러 */
export interface ValidationError {
  path: string;
  message: string;
  keyword?: string;
}

// ============================================
// 엔진 이벤트 타입
// ============================================

/** 플레이북 엔진 이벤트 */
export type PlaybookEngineEvent =
  | { type: "loaded"; playbook: Playbook }
  | { type: "started" }
  | { type: "step_started"; stepIndex: number; step: PlaybookStep }
  | {
      type: "step_completed";
      stepIndex: number;
      result: import("./execution").StepResult;
    }
  | { type: "waiting_user"; stepIndex: number; message?: string }
  | { type: "verifying"; stepIndex: number }
  | { type: "verify_success"; stepIndex: number; result: VerifyResult }
  | { type: "verify_failed"; stepIndex: number; result: VerifyResult }
  | { type: "paused" }
  | { type: "resumed" }
  | { type: "completed" }
  | { type: "error"; error: import("./execution").ExecutionError }
  | { type: "stopped" };
