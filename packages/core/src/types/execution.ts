import type { PlaybookStep } from './playbook';
import type { SmartSelector, ElementIdentity, DOMSnapshot } from './selector';
import type {
  HealingRecord,
  HealStrategy,
  HealMethodV4,
  EnhancedFallbacks,
  StructuralPosition,
  TextPatterns,
} from './healing';

export type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export interface StepResult {
  stepId: string;
  stepIndex: number;
  status: StepStatus;
  message?: string;
  error?: string;
  duration?: number;
  screenshot?: string;
  healed?: boolean;
  healedSelector?: string;
  originalSelector?: string;
  healMethod?: HealStrategy | HealMethodV4;
}

export interface RunnerState {
  isRunning: boolean;
  currentStepIndex: number;
  totalSteps: number;
  results: StepResult[];
  startTime?: number;
  endTime?: number;
}

export type RunnerEventType =
  | 'started'
  | 'step_started'
  | 'step_completed'
  | 'completed'
  | 'error'
  | 'paused'
  | 'resumed';

export interface RunnerEvent {
  type: RunnerEventType;
  state: RunnerState;
  stepResult?: StepResult;
  error?: string;
}

export type FailureStrategy = 'skip' | 'retry' | 'heal' | 'stop' | 'ask';

export interface WaitCondition {
  type: 'visible' | 'hidden' | 'enabled' | 'networkIdle' | 'custom';
  timeout?: number;
  customScript?: string;
}

export interface ExecutionContext {
  currentUrl: string;
  snapshot?: DOMSnapshot;
  variables: Record<string, string>;
  healingEnabled: boolean;
}

export interface SemanticStep extends PlaybookStep {
  smartSelector?: SmartSelector;
  waitCondition?: WaitCondition;
  onFailure?: FailureStrategy;
  healingHistory?: HealingRecord[];
}

export interface SemanticStepV3 extends PlaybookStep {
  identity?: ElementIdentity;
  smartSelector?: SmartSelector;
  waitCondition?: WaitCondition;
  onFailure?: FailureStrategy;
  healingHistory?: HealingRecord[];
}

export interface SemanticStepV4 extends SemanticStepV3 {
  enhancedFallbacks?: EnhancedFallbacks;
  structuralPosition?: StructuralPosition;
  textPatterns?: TextPatterns;
}

export interface MatchResult {
  success: boolean;
  strategy: string;
  selector?: string;
  confidence: number;
  elementFound?: boolean;
  error?: string;
}
