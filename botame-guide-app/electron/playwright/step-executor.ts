import { BrowserController } from './browser-controller';
import { PageController } from './page-controller';
import { HighlightController } from './highlight-controller';
import {
  PlaybookStep,
  ExecutionContext,
  StepResult,
} from '../playbook/types';

/**
 * StepExecutor - Executes playbook steps using Playwright
 */
export class StepExecutor {
  private pageController: PageController | null = null;
  private highlightController: HighlightController | null = null;
  private guideCallback?: (message: string) => void;

  constructor(private browserController: BrowserController) {}

  /**
   * Set callback for guide messages
   */
  setGuideCallback(callback: (message: string) => void): void {
    this.guideCallback = callback;
  }

  /**
   * Execute a playbook step
   */
  async execute(step: PlaybookStep, context: ExecutionContext): Promise<StepResult> {
    this.ensureControllers();

    const startTime = Date.now();

    try {
      const result = await this.executeAction(step, context);
      return {
        ...result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  private async executeAction(
    step: PlaybookStep,
    context: ExecutionContext
  ): Promise<Omit<StepResult, 'duration'>> {
    switch (step.action) {
      case 'navigate':
        return this.executeNavigate(step);

      case 'click':
        return this.executeClick(step);

      case 'type':
        return this.executeType(step);

      case 'select':
        return this.executeSelect(step);

      case 'wait':
        return this.executeWait(step);

      case 'assert':
        return this.executeAssert(step);

      case 'highlight':
        return this.executeHighlight(step);

      case 'guide':
        return this.executeGuide(step);

      case 'condition':
        return this.executeCondition(step, context);

      case 'loop':
        return this.executeLoop(step, context);

      default:
        throw new Error(`Unknown action: ${step.action}`);
    }
  }

  private async executeNavigate(step: PlaybookStep): Promise<Omit<StepResult, 'duration'>> {
    if (!step.value) {
      throw new Error('Navigate action requires a value (URL)');
    }

    await this.browserController.navigate(step.value);
    return { success: true };
  }

  private async executeClick(step: PlaybookStep): Promise<Omit<StepResult, 'duration'>> {
    if (!step.selector) {
      throw new Error('Click action requires a selector');
    }

    const result = await this.pageController!.click(step.selector, {
      timeout: step.timeout,
    });

    return {
      success: result.success,
      error: result.error?.message,
    };
  }

  private async executeType(step: PlaybookStep): Promise<Omit<StepResult, 'duration'>> {
    if (!step.selector) {
      throw new Error('Type action requires a selector');
    }
    if (step.value === undefined) {
      throw new Error('Type action requires a value');
    }

    const result = await this.pageController!.type(step.selector, step.value, {
      timeout: step.timeout,
    });

    return {
      success: result.success,
      error: result.error?.message,
    };
  }

  private async executeSelect(step: PlaybookStep): Promise<Omit<StepResult, 'duration'>> {
    if (!step.selector) {
      throw new Error('Select action requires a selector');
    }
    if (!step.value) {
      throw new Error('Select action requires a value');
    }

    const result = await this.pageController!.select(step.selector, step.value, {
      timeout: step.timeout,
    });

    return {
      success: result.success,
      error: result.error?.message,
    };
  }

  private async executeWait(step: PlaybookStep): Promise<Omit<StepResult, 'duration'>> {
    switch (step.wait_for) {
      case 'element':
        if (!step.selector) {
          throw new Error('Wait for element requires a selector');
        }
        const elementResult = await this.pageController!.waitForElement(step.selector, {
          timeout: step.timeout,
        });
        return { success: elementResult.success, error: elementResult.error?.message };

      case 'navigation':
        const navResult = await this.pageController!.waitForNavigation({
          timeout: step.timeout,
        });
        return { success: navResult.success, error: navResult.error?.message };

      case 'network':
        const networkResult = await this.pageController!.waitForNetworkIdle({
          timeout: step.timeout,
        });
        return { success: networkResult.success, error: networkResult.error?.message };

      case 'user':
        // Wait for user action
        return { success: true, waitForUser: true };

      default:
        // Default: wait for specified time
        await new Promise((resolve) => setTimeout(resolve, step.timeout ?? 1000));
        return { success: true };
    }
  }

  private async executeAssert(step: PlaybookStep): Promise<Omit<StepResult, 'duration'>> {
    if (!step.selector) {
      throw new Error('Assert action requires a selector');
    }
    if (!step.value) {
      throw new Error('Assert action requires a value');
    }

    const result = await this.pageController!.assertText(step.selector, step.value, {
      timeout: step.timeout,
      partial: true, // Default to partial match
    });

    return {
      success: result.success,
      error: result.error?.message,
    };
  }

  private async executeHighlight(step: PlaybookStep): Promise<Omit<StepResult, 'duration'>> {
    if (!step.selector) {
      throw new Error('Highlight action requires a selector');
    }

    const result = await this.highlightController!.highlight({
      selector: step.selector,
      message: step.message,
    });

    if (!result.success) {
      return { success: false, error: result.error?.message };
    }

    // If wait_for is 'user', return waitForUser flag
    if (step.wait_for === 'user') {
      return { success: true, waitForUser: true };
    }

    return { success: true };
  }

  private async executeGuide(step: PlaybookStep): Promise<Omit<StepResult, 'duration'>> {
    // Send guide message to UI via callback
    if (step.message && this.guideCallback) {
      this.guideCallback(step.message);
    }

    // If wait_for is 'user', return waitForUser flag
    if (step.wait_for === 'user') {
      return { success: true, waitForUser: true };
    }

    return { success: true };
  }

  private async executeCondition(
    _step: PlaybookStep,
    _context: ExecutionContext
  ): Promise<Omit<StepResult, 'duration'>> {
    // Condition handling is done by PlaybookEngine
    // This is a placeholder for direct condition execution
    return { success: true };
  }

  private async executeLoop(
    _step: PlaybookStep,
    _context: ExecutionContext
  ): Promise<Omit<StepResult, 'duration'>> {
    // Loop handling is done by PlaybookEngine
    // This is a placeholder for direct loop execution
    return { success: true };
  }

  private ensureControllers(): void {
    const page = this.browserController.getPage();
    if (!page) {
      throw new Error('Browser page is not available');
    }

    if (!this.pageController) {
      this.pageController = new PageController(page);
    }

    if (!this.highlightController) {
      this.highlightController = new HighlightController(page);
    }
  }

  /**
   * Clear any active highlights
   */
  async clearHighlight(): Promise<void> {
    if (this.highlightController) {
      await this.highlightController.clearHighlight();
    }
  }
}
