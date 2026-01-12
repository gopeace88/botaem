/**
 * Execution Types - 실행 컨텍스트 및 결과 타입
 * @module @botame/types/execution
 */

import { MatchingStrategy } from "./selector";
import { SelectorStrategy } from "./playbook";

// ============================================
// 실행 상태
// ============================================

export type ExecutionStatus =
  | "idle"
  | "loading"
  | "validating"
  | "executing"
  | "waiting_user"
  | "verifying"
  | "paused"
  | "completed"
  | "error";

export interface ExecutionError {
  stepId: string;
  message: string;
  code?: string;
  timestamp: Date;
}

// ============================================
// 실행 컨텍스트
// ============================================

/** 실행 컨텍스트 (통합) */
export interface ExecutionContext {
  // Guide-app 필드
  variables: Record<string, unknown>;
  currentStepIndex: number;
  status: ExecutionStatus;
  errors: ExecutionError[];
  startedAt?: Date;
  completedAt?: Date;

  // Admin-app 필드 (선택적)
  currentUrl?: string;
  healingEnabled?: boolean;

  // 브라우저 제어는 각 앱이 제공
  browserAdapter?: BrowserAdapter;
}

/** 브라우저 어댑터 인터페이스 */
export interface BrowserAdapter {
  click(selector: string, options?: ClickOptions): Promise<ActionResult>;
  type(selector: string, text: string): Promise<ActionResult>;
  select(selector: string, value: string): Promise<ActionResult>;
  navigate(url: string): Promise<ActionResult>;
  waitFor(selector: string, timeout?: number): Promise<ActionResult>;

  getUrl(): string;
  getTitle(): Promise<string>;

  getTextContent(selector: string): Promise<string>;
  getAriaLabel(selector: string): Promise<string>;
  isVisible(selector: string): Promise<boolean>;
}

export interface ClickOptions {
  timeout?: number;
  force?: boolean;
}

export interface ActionResult {
  success: boolean;
  error?: Error;
  duration?: number;
  screenshot?: string;
}

// ============================================
// 스텝 결과
// ============================================

export interface StepResult {
  // Guide-app: 성공 플래그
  success: boolean;
  waitForUser?: boolean;
  error?: string;
  data?: unknown;

  // Admin-app: 상세 실행 결과 (모두 선택적)
  stepId?: string;
  stepIndex?: number;
  status?: "pending" | "running" | "success" | "failed" | "skipped";
  message?: string;
  duration?: number;
  screenshot?: string;

  // 자동 고침 결과
  healed?: boolean;
  healedSelector?: string;
  originalSelector?: string;
  healMethod?: "fallback" | "text" | "aria" | "dynamic" | "manual";
}

export interface ExecutionResult {
  success: boolean;
  steps: StepResult[];
  duration: number;
  error?: string;
}

// ============================================
// 자동 고침 기록
// ============================================

export interface HealingRecord {
  timestamp: number;
  originalSelector: string;
  healedSelector: string;
  strategy: SelectorStrategy;
  success: boolean;
}

export interface MatchResult {
  success: boolean;
  strategy: MatchingStrategy;
  selector?: string;
  confidence: number;
  elementFound?: boolean;
  error?: string;
}

export interface HealingRecordV3 extends HealingRecord {
  matchingStrategy: MatchingStrategy;
  identity?: import("./selector").ElementIdentity;
  attemptedStrategies: MatchingStrategy[];
}
