/**
 * Admin App Browser Adapter
 * implements BrowserAdapter interface for admin's BrowserService
 */

import { BrowserAdapter, ActionResult, ClickOptions } from "@botame/types";
import { Page } from "playwright";
import { BrowserService } from "./browser.service";

export class AdminBrowserAdapter implements BrowserAdapter {
  private page: Page | null = null;

  constructor(private browserService: BrowserService) {
    this.page = browserService.getPage();
  }

  private getPage(): Page {
    // Refresh page reference in case browser was restarted
    this.page = this.browserService.getPage();
    if (!this.page) {
      throw new Error(
        "Browser page not available. Browser may not be initialized.",
      );
    }
    return this.page;
  }

  async click(selector: string, options?: ClickOptions): Promise<ActionResult> {
    const start = Date.now();
    try {
      const page = this.getPage();
      await page.click(selector, {
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
      const page = this.getPage();
      const element = page.locator(selector);

      // Click element first to focus it
      await element.click();

      // JavaScript를 통해 직접 값 설정 (한글 입력 지원)
      await element.evaluate((el, val) => {
        const input = el as HTMLInputElement;
        input.value = val;
        // 이벤트 발생시켜 프레임워크가 감지하도록
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }, text);

      // fill() 방식도 시도 (일부 사이트에서 필요)
      try {
        await element.fill(text, { timeout: 1000 });
      } catch {
        // JavaScript 방식이 성공했으면 무시
      }

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
      const page = this.getPage();
      await page.selectOption(selector, value, { timeout: 30000 });
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
      const result = await this.browserService.navigateTo(url);
      if (result.success) {
        return { success: true, duration: Date.now() - start };
      }
      return {
        success: false,
        error: new Error(result.error || "Navigation failed"),
        duration: Date.now() - start,
      };
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
      const page = this.getPage();
      await page.waitForSelector(selector, { timeout });
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
    return this.browserService.getCurrentUrl() || "";
  }

  async getTitle(): Promise<string> {
    try {
      const page = this.getPage();
      return await page.title();
    } catch {
      return "";
    }
  }

  async getTextContent(selector: string): Promise<string> {
    try {
      const page = this.getPage();
      const element = await page.$(selector);
      if (!element) return "";
      return (await element.textContent()) || "";
    } catch {
      return "";
    }
  }

  async getAriaLabel(selector: string): Promise<string> {
    try {
      const page = this.getPage();
      const element = await page.$(selector);
      if (!element) return "";
      return (await element.getAttribute("aria-label")) || "";
    } catch {
      return "";
    }
  }

  async isVisible(selector: string): Promise<boolean> {
    try {
      const page = this.getPage();
      const element = await page.$(selector);
      if (!element) return false;
      return await element.isVisible();
    } catch {
      return false;
    }
  }
}
