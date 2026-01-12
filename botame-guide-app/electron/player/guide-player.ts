/**
 * Guide App Player Wrapper
 * wraps @botame/player with Playwright adapter
 */

import { PlaybookEngine } from '@botame/player';
import { PlaywrightAdapter } from './playwright-adapter';
import { Playbook, StepResult } from '@botame/types';
import { Page } from 'playwright';

export class GuidePlayer {
  private engine = new PlaybookEngine();
  private adapter: PlaywrightAdapter;

  constructor(private page: Page) {
    this.adapter = new PlaywrightAdapter(page);
    this.setupStepExecutor();
  }

  /**
   * Setup step executor to handle browser actions
   */
  private setupStepExecutor(): void {
    this.engine.setStepExecutor(async (step, context) => {
      const result: StepResult = {
        stepId: step.id,
        stepIndex: context.currentStepIndex,
        success: true,
      };

      try {
        switch (step.action) {
          case 'navigate':
            const navResult = await this.adapter.navigate(step.value || '');
            result.success = navResult.success;
            result.duration = navResult.duration;
            break;

          case 'click':
            const clickResult = await this.adapter.click(step.selector || '', {
              timeout: step.timeout,
            });
            result.success = clickResult.success;
            result.duration = clickResult.duration;
            break;

          case 'type':
            const typeResult = await this.adapter.type(
              step.selector || '',
              step.value || step.variable ? String(context.variables[step.variable || ''] || '') : ''
            );
            result.success = typeResult.success;
            result.duration = typeResult.duration;
            break;

          case 'select':
            const selectResult = await this.adapter.select(
              step.selector || '',
              step.value || ''
            );
            result.success = selectResult.success;
            result.duration = selectResult.duration;
            break;

          case 'wait':
            const waitResult = await this.adapter.waitFor(
              step.selector || '',
              step.timeout
            );
            result.success = waitResult.success;
            result.duration = waitResult.duration;
            break;

          case 'scroll':
            // Scroll action
            if (step.selector) {
              await this.page.locator(step.selector).scrollIntoViewIfNeeded();
            }
            break;

          case 'hover':
            // Hover action
            if (step.selector) {
              await this.page.hover(step.selector);
            }
            break;

          case 'guide':
          case 'highlight':
            // These are UI actions, not browser actions
            break;

          default:
            console.warn(`Unknown action: ${step.action}`);
            break;
        }

        // Handle wait_after
        if (step.waitAfter) {
          await new Promise((resolve) => setTimeout(resolve, step.waitAfter));
        }

        return result;
      } catch (error) {
        result.success = false;
        result.error = error instanceof Error ? error.message : String(error);
        return result;
      }
    });
  }

  /**
   * Load a playbook
   */
  load(playbook: Playbook): void {
    this.engine.load(playbook);
  }

  /**
   * Start execution
   */
  async start(): Promise<void> {
    // The engine doesn't use the context for execution anymore,
    // it uses the step executor we set up
    await this.engine.start();
  }

  /**
   * Pause execution
   */
  pause(): void {
    this.engine.pause();
  }

  /**
   * Resume execution
   */
  resume(): void {
    this.engine.resume();
  }

  /**
   * Stop execution
   */
  stop(): void {
    this.engine.stop();
  }

  /**
   * Signal user action completed
   */
  async userAction(data?: unknown): Promise<void> {
    await this.engine.userAction(data);
  }

  /**
   * Get current playbook
   */
  getPlaybook(): Playbook | null {
    return this.engine.getPlaybook();
  }

  /**
   * Get execution status
   */
  getStatus() {
    return this.engine.getStatus();
  }

  /**
   * Get current step
   */
  getCurrentStep() {
    return this.engine.getCurrentStep();
  }

  /**
   * Get execution progress
   */
  getProgress() {
    return this.engine.getProgress();
  }

  /**
   * Subscribe to engine events
   */
  on(event: string, callback: (data: any) => void) {
    this.engine.on(event, callback);
  }

  /**
   * Unsubscribe from engine events
   */
  off(event: string, callback: (data: any) => void) {
    this.engine.off(event, callback);
  }
}
