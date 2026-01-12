/**
 * Playbook Execution Engine
 * @module @botame/player/engine
 */

import { EventEmitter } from 'events';
import {
  Playbook,
  PlaybookStep,
  ExecutionContext,
  ExecutionStatus,
  ExecutionError,
  StepResult,
} from '@botame/types';
import { VariableInterpolator } from './interpolator';
import { PlaybookValidator } from './validator';

export type EngineEvent =
  | { type: 'loaded'; playbook: Playbook }
  | { type: 'started' }
  | { type: 'step_started'; stepIndex: number; step: PlaybookStep }
  | { type: 'step_completed'; stepIndex: number; result: StepResult }
  | { type: 'waiting_user'; stepIndex: number; message?: string }
  | { type: 'paused' }
  | { type: 'resumed' }
  | { type: 'completed' }
  | { type: 'error'; error: ExecutionError }
  | { type: 'stopped' };

type EventCallback = (event: EngineEvent) => void;

// Type for step executor function
export type StepExecutor = (
  step: PlaybookStep,
  context: ExecutionContext
) => Promise<StepResult>;

/**
 * PlaybookEngine - State machine for playbook execution
 * Framework-agnostic execution engine that uses BrowserAdapter for browser control
 */
export class PlaybookEngine extends EventEmitter {
  private playbook: Playbook | null = null;
  private context: ExecutionContext;
  private validator: PlaybookValidator;
  private interpolator: VariableInterpolator;
  private stepExecutor: StepExecutor | null = null;
  private isPaused = false;
  private isStopped = false;
  private isExecuting = false; // Guard flag to prevent concurrent execution

  constructor() {
    super();
    this.validator = new PlaybookValidator();
    this.interpolator = new VariableInterpolator();
    this.context = this.createInitialContext();
  }

  /**
   * Create initial execution context
   */
  private createInitialContext(): ExecutionContext {
    return {
      variables: {},
      currentStepIndex: 0,
      status: 'idle',
      errors: [],
    };
  }

  /**
   * Load a playbook for execution
   */
  load(playbook: Playbook): void {
    // Validate playbook
    const validation = this.validator.validate(playbook);
    if (!validation.valid) {
      throw new Error(`Invalid playbook: ${validation.errors.map((e) => e.message).join(', ')}`);
    }

    this.playbook = playbook;
    this.context = this.createInitialContext();
    this.isPaused = false;
    this.isStopped = false;

    this.emit('loaded', { type: 'loaded', playbook });
  }

  /**
   * Set step executor for actual step execution
   * This allows the engine to be framework-agnostic
   */
  setStepExecutor(executor: StepExecutor): void {
    this.stepExecutor = executor;
  }

  /**
   * Set variables for execution
   */
  setVariables(variables: Record<string, unknown>): void {
    this.context.variables = {
      ...this.context.variables,
      ...variables,
    };
  }

  /**
   * Start playbook execution
   */
  async start(): Promise<void> {
    if (!this.playbook) {
      throw new Error('No playbook loaded');
    }

    // Guard against concurrent execution
    if (this.isExecuting) {
      throw new Error('Execution already in progress');
    }

    // Apply default variable values
    if (this.playbook.variables) {
      for (const [name, definition] of Object.entries(this.playbook.variables)) {
        if (this.context.variables[name] === undefined && definition.default !== undefined) {
          this.context.variables[name] = definition.default;
        }
      }
    }

    // Validate required variables
    const varValidation = this.validator.validateVariables(
      this.playbook,
      this.context.variables
    );
    if (!varValidation.valid) {
      throw new Error(
        `Missing required variables: ${varValidation.errors.map((e) => e.path).join(', ')}`
      );
    }

    this.isStopped = false;
    this.isPaused = false;
    this.isExecuting = true;
    this.context.status = 'executing';
    this.context.startedAt = new Date();

    this.emit('started', { type: 'started' });

    try {
      // Start execution loop
      await this.executeSteps();
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Pause execution
   */
  pause(): void {
    if (this.context.status === 'executing') {
      this.isPaused = true;
      this.context.status = 'paused';
      this.emit('paused', { type: 'paused' });
    }
  }

  /**
   * Resume execution
   */
  resume(): void {
    if (this.context.status === 'paused') {
      this.isPaused = false;
      this.context.status = 'executing';
      this.emit('resumed', { type: 'resumed' });

      // Continue execution - guard prevents multiple concurrent executions
      if (!this.isExecuting) {
        this.isExecuting = true;
        this.executeSteps()
          .catch((error) => {
            this.handleError(error);
          })
          .finally(() => {
            this.isExecuting = false;
          });
      }
    }
  }

  /**
   * Stop execution
   */
  stop(): void {
    this.isStopped = true;
    this.isPaused = false;
    this.isExecuting = false;
    this.context.status = 'idle';
    this.context.currentStepIndex = 0;
    this.emit('stopped', { type: 'stopped' });
  }

  /**
   * Clean up resources and prevent memory leaks
   * Call this when the engine is no longer needed
   */
  dispose(): void {
    this.stop();
    this.removeAllListeners();
    this.playbook = null;
    this.stepExecutor = null;
  }

  /**
   * Signal that user completed required action
   * Triggers verification before proceeding to next step
   */
  async userAction(_data?: unknown): Promise<void> {
    if (this.context.status !== 'waiting_user') {
      return;
    }

    // Proceed to next step
    this.context.status = 'executing';
    this.context.currentStepIndex++;
    this.executeSteps().catch((error) => {
      this.handleError(error);
    });
  }

  /**
   * Get current playbook
   */
  getPlaybook(): Playbook | null {
    return this.playbook;
  }

  /**
   * Get current execution status
   */
  getStatus(): ExecutionStatus {
    return this.context.status;
  }

  /**
   * Get execution context
   */
  getContext(): ExecutionContext {
    return { ...this.context };
  }

  /**
   * Get current step
   */
  getCurrentStep(): PlaybookStep | null {
    if (!this.playbook) return null;
    return this.playbook.steps[this.context.currentStepIndex] || null;
  }

  /**
   * Get execution progress
   */
  getProgress(): { current: number; total: number; percentage: number } {
    const total = this.playbook?.steps.length || 0;
    const current = this.context.currentStepIndex;
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

    return { current, total, percentage };
  }

  /**
   * Execute steps in sequence
   */
  private async executeSteps(): Promise<void> {
    if (!this.playbook) return;

    while (
      this.context.currentStepIndex < this.playbook.steps.length &&
      !this.isStopped &&
      !this.isPaused
    ) {
      const step = this.playbook.steps[this.context.currentStepIndex];

      // Emit step started event
      this.emit('step_started', {
        type: 'step_started',
        stepIndex: this.context.currentStepIndex,
        step,
      });

      try {
        // Execute the step
        const result = await this.executeStep(step);

        // Emit step completed event
        this.emit('step_completed', {
          type: 'step_completed',
          stepIndex: this.context.currentStepIndex,
          result,
        });

        // Check if we need to wait for user
        if (result.waitForUser) {
          this.context.status = 'waiting_user';
          this.emit('waiting_user', {
            type: 'waiting_user',
            stepIndex: this.context.currentStepIndex,
            message: step.message,
          });
          return; // Exit loop, userAction() will resume
        }

        // Move to next step
        this.context.currentStepIndex++;
      } catch (error) {
        // Handle step error
        const execError: ExecutionError = {
          stepId: step.id,
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
        };
        this.context.errors.push(execError);

        // Handle based on step's on_error setting
        if (step.on_error === 'skip') {
          this.context.currentStepIndex++;
          continue;
        } else if (step.on_error === 'retry') {
          // Simple retry once
          try {
            await this.executeStep(step);
            this.context.currentStepIndex++;
            continue;
          } catch {
            // Retry failed, handle error
          }
        }

        // Default: abort on error
        this.handleError(error);
        return;
      }
    }

    // Check if completed
    if (
      !this.isStopped &&
      !this.isPaused &&
      this.context.currentStepIndex >= this.playbook.steps.length
    ) {
      this.context.status = 'completed';
      this.context.completedAt = new Date();
      this.emit('completed', { type: 'completed' });
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(step: PlaybookStep): Promise<StepResult> {
    // Interpolate variables in step
    const interpolatedStep = this.interpolator.interpolateStep(step, this.context.variables);

    // Handle condition steps
    if (step.action === 'condition') {
      return this.executeConditionStep(interpolatedStep);
    }

    // Handle loop steps
    if (step.action === 'loop') {
      return this.executeLoopStep(interpolatedStep);
    }

    // Use external step executor if available
    if (this.stepExecutor) {
      return this.stepExecutor(interpolatedStep, this.context);
    }

    // Default behavior when no executor is set
    // This is useful for testing and when running without a browser
    if (step.wait_for === 'user') {
      return { success: true, waitForUser: true };
    }

    // Simulate step execution
    return { success: true };
  }

  /**
   * Execute condition step
   */
  private async executeConditionStep(step: PlaybookStep): Promise<StepResult> {
    if (!step.condition) {
      return { success: false, error: 'Condition step missing condition expression' };
    }

    const conditionResult = this.interpolator.evaluateCondition(
      step.condition,
      this.context.variables
    );

    const stepsToExecute = conditionResult ? step.then : step.else;

    // Validate stepsToExecute is an array before iterating
    if (stepsToExecute && Array.isArray(stepsToExecute) && stepsToExecute.length > 0) {
      for (const nestedStep of stepsToExecute) {
        const result = await this.executeStep(nestedStep);
        if (!result.success) {
          return result;
        }
        if (result.waitForUser) {
          return result;
        }
      }
    }

    return { success: true };
  }

  /**
   * Execute loop step
   */
  private async executeLoopStep(step: PlaybookStep): Promise<StepResult> {
    if (!step.steps || !step.variable) {
      return { success: false, error: 'Loop step missing steps or variable' };
    }

    const items = this.context.variables[step.variable];
    if (!Array.isArray(items)) {
      return { success: false, error: `Variable ${step.variable} is not an array` };
    }

    // Validate step.steps is an array before iterating
    if (!Array.isArray(step.steps)) {
      return { success: false, error: 'Loop steps is not an array' };
    }

    for (const [index, item] of items.entries()) {
      // Set loop variables
      this.context.variables['_item'] = item;
      this.context.variables['_index'] = index;

      for (const nestedStep of step.steps) {
        const result = await this.executeStep(nestedStep);
        if (!result.success) {
          return result;
        }
        if (result.waitForUser) {
          return result;
        }
      }
    }

    // Clean up loop variables
    delete this.context.variables['_item'];
    delete this.context.variables['_index'];

    return { success: true };
  }

  /**
   * Handle execution error
   */
  private handleError(error: unknown): void {
    const execError: ExecutionError = {
      stepId: this.getCurrentStep()?.id || 'unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date(),
    };

    this.context.errors.push(execError);
    this.context.status = 'error';

    this.emit('error', { type: 'error', error: execError });
  }

  // Override EventEmitter methods for proper typing
  on(event: string, listener: EventCallback): this {
    return super.on(event, listener);
  }

  off(event: string, listener: EventCallback): this {
    return super.off(event, listener);
  }

  emit(event: string, data: EngineEvent): boolean {
    return super.emit(event, data);
  }
}
