import { Page } from 'playwright';
import {
  ClickResult,
  TypeResult,
  SelectResult,
  WaitResult,
  AssertResult,
  ElementInfo,
} from './types';

export interface ActionOptions {
  timeout?: number;
}

export interface TypeOptions extends ActionOptions {
  delay?: number;
  clear?: boolean;
}

export interface AssertOptions extends ActionOptions {
  partial?: boolean;
}

/**
 * PageController - Handles page interactions
 */
export class PageController {
  constructor(private page: Page) {}

  /**
   * Click an element
   * Supports multiple selectors separated by commas - tries each one until success
   */
  async click(selector: string, options: ActionOptions = {}): Promise<ClickResult> {
    const startTime = Date.now();
    const timeout = options.timeout ?? 30000;

    // Split by comma and try each selector
    const selectors = selector.split(',').map((s) => s.trim()).filter(Boolean);

    // Try each selector one by one
    let lastError: Error | undefined;
    for (const sel of selectors) {
      try {
        // First check if element exists and is visible
        const locator = this.page.locator(sel);
        const isVisible = await locator.first().isVisible({ timeout: Math.min(2000, timeout) }).catch(() => false);

        if (isVisible) {
          await locator.first().click({ timeout: timeout });
          console.log(`[PageController] Clicked element with selector: ${sel}`);
          return {
            success: true,
            clicked: true,
            duration: Date.now() - startTime,
          };
        }
      } catch (error) {
        lastError = error as Error;
        console.log(`[PageController] Selector failed: ${sel} - ${(error as Error).message}`);
      }
    }

    // If no selector worked, return error
    return {
      success: false,
      clicked: false,
      error: lastError ?? new Error(`No matching element found for selectors: ${selector}`),
      duration: Date.now() - startTime,
    };
  }

  /**
   * Type text into an input
   */
  async type(
    selector: string,
    text: string,
    options: TypeOptions = {}
  ): Promise<TypeResult> {
    const startTime = Date.now();

    try {
      const locator = this.page.locator(selector);

      // Clear existing content by default
      if (options.clear !== false) {
        await locator.clear({ timeout: options.timeout ?? 30000 });
      }

      await locator.fill(text, {
        timeout: options.timeout ?? 30000,
      });

      return {
        success: true,
        typed: text,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Select option from dropdown
   */
  async select(
    selector: string,
    value: string | string[],
    options: ActionOptions = {}
  ): Promise<SelectResult> {
    const startTime = Date.now();

    try {
      const values = Array.isArray(value) ? value : [value];
      const selected = await this.page.selectOption(selector, values, {
        timeout: options.timeout ?? 30000,
      });

      return {
        success: true,
        selected,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Wait for element to appear
   */
  async waitForElement(
    selector: string,
    options: ActionOptions = {}
  ): Promise<WaitResult> {
    const startTime = Date.now();

    try {
      await this.page.waitForSelector(selector, {
        timeout: options.timeout ?? 30000,
        state: 'visible',
      });

      return {
        success: true,
        waited: Date.now() - startTime,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Wait for navigation to complete
   */
  async waitForNavigation(options: ActionOptions = {}): Promise<WaitResult> {
    const startTime = Date.now();

    try {
      await this.page.waitForLoadState('networkidle', {
        timeout: options.timeout ?? 30000,
      });

      return {
        success: true,
        waited: Date.now() - startTime,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Wait for network idle
   */
  async waitForNetworkIdle(options: ActionOptions = {}): Promise<WaitResult> {
    return this.waitForNavigation(options);
  }

  /**
   * Assert text content
   */
  async assertText(
    selector: string,
    expectedText: string,
    options: AssertOptions = {}
  ): Promise<AssertResult> {
    const startTime = Date.now();

    try {
      const locator = this.page.locator(selector);
      const actualText = await locator.textContent({
        timeout: options.timeout ?? 30000,
      });

      let matches: boolean;
      if (options.partial) {
        matches = actualText?.includes(expectedText) ?? false;
      } else {
        matches = actualText?.trim() === expectedText.trim();
      }

      return {
        success: matches,
        expected: expectedText,
        actual: actualText?.trim() ?? '',
        duration: Date.now() - startTime,
        error: matches ? undefined : new Error(`Text mismatch: expected "${expectedText}", got "${actualText}"`),
      };
    } catch (error) {
      return {
        success: false,
        expected: expectedText,
        error: error as Error,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Get element information
   */
  async getElementInfo(selector: string): Promise<ElementInfo> {
    try {
      const locator = this.page.locator(selector);
      const count = await locator.count();

      if (count === 0) {
        return {
          selector,
          exists: false,
        };
      }

      const first = locator.first();
      const boundingBox = await first.boundingBox();
      const isVisible = await first.isVisible();
      const isEnabled = await first.isEnabled();
      const textContent = await first.textContent();

      return {
        selector,
        exists: true,
        visible: isVisible,
        enabled: isEnabled,
        text: textContent?.trim(),
        boundingBox: boundingBox ?? undefined,
      };
    } catch {
      return {
        selector,
        exists: false,
      };
    }
  }

  /**
   * Execute JavaScript in page context
   */
  async evaluate<T>(script: string | ((arg: unknown) => T), arg?: unknown): Promise<T> {
    return this.page.evaluate(script, arg);
  }

  /**
   * Get current URL
   */
  getUrl(): string {
    return this.page.url();
  }

  /**
   * Get the underlying Page object
   */
  getPage(): Page {
    return this.page;
  }
}
