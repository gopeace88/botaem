/**
 * Playwright Browser Adapter
 * implements BrowserAdapter for Playwright
 */

import {
  BrowserAdapter,
  ActionResult,
  ClickOptions,
} from '@botame/types';
import { Page } from 'playwright';

export class PlaywrightAdapter implements BrowserAdapter {
  constructor(private page: Page) {}

  async click(selector: string, options?: ClickOptions): Promise<ActionResult> {
    const start = Date.now();
    try {
      await this.page.click(selector, {
        timeout: options?.timeout || 30000,
        force: options?.force,
      });
      return { success: true, duration: Date.now() - start };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        duration: Date.now() - start,
      };
    }
  }

  async type(selector: string, text: string): Promise<ActionResult> {
    const start = Date.now();
    try {
      await this.page.fill(selector, text);
      return { success: true, duration: Date.now() - start };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        duration: Date.now() - start,
      };
    }
  }

  async select(selector: string, value: string): Promise<ActionResult> {
    const start = Date.now();
    try {
      await this.page.selectOption(selector, value);
      return { success: true, duration: Date.now() - start };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        duration: Date.now() - start,
      };
    }
  }

  async navigate(url: string): Promise<ActionResult> {
    const start = Date.now();
    try {
      await this.page.goto(url);
      return { success: true, duration: Date.now() - start };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        duration: Date.now() - start,
      };
    }
  }

  async waitFor(selector: string, timeout = 30000): Promise<ActionResult> {
    const start = Date.now();
    try {
      await this.page.waitForSelector(selector, { timeout });
      return { success: true, duration: Date.now() - start };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        duration: Date.now() - start,
      };
    }
  }

  getUrl(): string {
    return this.page.url();
  }

  async getTitle(): Promise<string> {
    return this.page.title();
  }

  async getTextContent(selector: string): Promise<string> {
    const element = await this.page.$(selector);
    if (!element) return '';
    const text = await element.textContent();
    return text || '';
  }

  async getAriaLabel(selector: string): Promise<string> {
    const element = await this.page.$(selector);
    if (!element) return '';
    const label = await element.evaluate((el) => el.getAttribute('aria-label') || '');
    return label || '';
  }

  async isVisible(selector: string): Promise<boolean> {
    const element = await this.page.$(selector);
    if (!element) return false;
    return element.isVisible();
  }
}
