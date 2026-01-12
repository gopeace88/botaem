import type { Page, Locator } from 'playwright';
import type { SemanticStepV4 } from '../../types/execution';
import type { HealingResult, HealStrategy } from '../../types/healing';

export interface HealingStrategy {
  readonly name: HealStrategy;
  readonly priority: number;
  find(step: SemanticStepV4): Promise<HealingResult>;
  canHandle(step: SemanticStepV4): boolean;
}

export abstract class BaseStrategy implements HealingStrategy {
  abstract readonly name: HealStrategy;
  abstract readonly priority: number;

  constructor(protected page: Page) {}

  abstract find(step: SemanticStepV4): Promise<HealingResult>;

  canHandle(_step: SemanticStepV4): boolean {
    return true;
  }

  protected async tryLocator(locator: Locator, timeout = 3000): Promise<boolean> {
    try {
      await locator.waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      return false;
    }
  }

  protected createResult(
    success: boolean,
    selector?: string,
    error?: string
  ): HealingResult {
    return {
      success,
      strategy: this.name,
      selector,
      error,
    };
  }
}
