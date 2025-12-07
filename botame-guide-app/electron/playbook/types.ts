// === Step Action Types ===
export type StepAction =
  | 'navigate'
  | 'click'
  | 'type'
  | 'select'
  | 'wait'
  | 'assert'
  | 'highlight'
  | 'guide'
  | 'condition'
  | 'loop';

export type WaitFor = 'element' | 'navigation' | 'network' | 'user';
export type OnError = 'retry' | 'skip' | 'abort';
export type ErrorAction = 'retry' | 'skip' | 'abort' | 'guide';
export type PreconditionAction = 'warn' | 'block';
export type VariableType = 'string' | 'number' | 'date' | 'select' | 'boolean';
export type Category = '회원관리' | '사업선정' | '교부관리' | '집행관리' | '정산관리' | '사후관리' | '기타';
export type Difficulty = '쉬움' | '보통' | '어려움';

// === Step Verification (Interactive Watch & Guide) ===
export interface StepVerify {
  // DOM 검증 (무료)
  success_selector?: string;      // 이 요소 존재 시 성공
  success_url_contains?: string;  // URL에 문자열 포함 시 성공
  success_text?: string;          // 화면에 텍스트 존재 시 성공

  // Vision 검증 (폴백)
  condition?: string;             // AI에게 전달할 검증 조건
  fallback_vision?: boolean;      // false면 Vision 사용 안 함 (기본: true)
}

export type VerifyMethod = 'dom' | 'vision';

export interface VerifyResult {
  success: boolean;
  method: VerifyMethod;
  message?: string;
  guidance?: string;
  retryCount: number;
}

// === Step Definition ===
export interface PlaybookStep {
  id: string;
  action: StepAction;
  selector?: string;
  value?: string;
  message?: string;
  wait_for?: WaitFor;
  timeout?: number;
  optional?: boolean;
  condition?: string;
  on_error?: OnError;
  then?: PlaybookStep[];
  else?: PlaybookStep[];
  variable?: string;
  steps?: PlaybookStep[];
  verify?: StepVerify;  // Interactive Watch & Guide
}

// === Variable Definition ===
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

// === Precondition Definition ===
export interface Precondition {
  check: string;
  message: string;
  action: PreconditionAction;
}

// === Error Handler Definition ===
export interface ErrorHandler {
  match: string;
  action: ErrorAction;
  message?: string;
}

// === Metadata ===
export interface PlaybookMetadata {
  id: string;
  name: string;
  version: string;
  description?: string;
  category: Category;
  difficulty: Difficulty;
  estimated_time?: string;
  keywords?: string[];
  author?: string;
  last_updated?: string;
}

// === Playbook Definition ===
export interface Playbook {
  metadata: PlaybookMetadata;
  variables?: Record<string, VariableDefinition>;
  preconditions?: Precondition[];
  steps: PlaybookStep[];
  error_handlers?: ErrorHandler[];
}

// === Execution Context ===
export interface ExecutionContext {
  variables: Record<string, unknown>;
  currentStepIndex: number;
  status: ExecutionStatus;
  errors: ExecutionError[];
  startedAt?: Date;
  completedAt?: Date;
}

export type ExecutionStatus =
  | 'idle'
  | 'loading'
  | 'validating'
  | 'executing'
  | 'waiting_user'
  | 'verifying'
  | 'paused'
  | 'completed'
  | 'error';

export interface ExecutionError {
  stepId: string;
  message: string;
  code?: string;
  timestamp: Date;
}

// === Step Result ===
export interface StepResult {
  success: boolean;
  waitForUser?: boolean;
  error?: string;
  data?: unknown;
}

// === Validation Result ===
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
  keyword?: string;
}

// === Engine Events ===
export type PlaybookEngineEvent =
  | { type: 'loaded'; playbook: Playbook }
  | { type: 'started' }
  | { type: 'step_started'; stepIndex: number; step: PlaybookStep }
  | { type: 'step_completed'; stepIndex: number; result: StepResult }
  | { type: 'waiting_user'; stepIndex: number; message?: string }
  | { type: 'verifying'; stepIndex: number }
  | { type: 'verify_success'; stepIndex: number; result: VerifyResult }
  | { type: 'verify_failed'; stepIndex: number; result: VerifyResult }
  | { type: 'paused' }
  | { type: 'resumed' }
  | { type: 'completed' }
  | { type: 'error'; error: ExecutionError }
  | { type: 'stopped' };
