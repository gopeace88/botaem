/**
 * StepVerifier - Interactive Watch & Guide
 *
 * Verifies user actions after each step using DOM-based verification only.
 */

import { Page } from "playwright";
import { PlaybookStep, StepVerify, VerifyResult } from "../playbook/types";

const DOM_TIMEOUT = 3000;

export class StepVerifier {
  /**
   * Verify step completion
   * Returns verification result with method used and guidance if failed
   */
  async verify(step: PlaybookStep, page: Page): Promise<VerifyResult> {
    const verify = step.verify;

    // No verification required
    if (!verify) {
      return {
        success: true,
        method: "dom",
        retryCount: 0,
      };
    }

    // DOM verification (only method available)
    const domResult = await this.verifyByDOM(verify, page);
    if (domResult.success) {
      return {
        success: true,
        method: "dom",
        message: "DOM 검증 성공",
        retryCount: 0,
      };
    }

    // DOM verification failed
    return {
      success: false,
      method: "dom",
      message: domResult.reason || "DOM 검증 실패",
      guidance: '화면을 직접 확인 후 "완료" 버튼을 눌러주세요.',
      retryCount: 0,
    };
  }

  /**
   * DOM-based verification (free, fast)
   */
  private async verifyByDOM(
    verify: StepVerify,
    page: Page,
  ): Promise<{ success: boolean; reason?: string }> {
    try {
      // Check selector exists
      if (verify.success_selector) {
        const selectors = verify.success_selector
          .split(",")
          .map((s) => s.trim());
        for (const selector of selectors) {
          try {
            const element = await page.waitForSelector(selector, {
              timeout: DOM_TIMEOUT,
              state: "visible",
            });
            if (element) {
              return { success: true, reason: `Selector found: ${selector}` };
            }
          } catch {
            // Continue to next selector
          }
        }
      }

      // Check URL contains string
      if (verify.success_url_contains) {
        const currentUrl = page.url();
        if (currentUrl.includes(verify.success_url_contains)) {
          return {
            success: true,
            reason: `URL contains: ${verify.success_url_contains}`,
          };
        }
      }

      // Check text exists on page
      if (verify.success_text) {
        try {
          const textLocator = page.getByText(verify.success_text);
          const count = await textLocator.count();
          if (count > 0) {
            return {
              success: true,
              reason: `Text found: ${verify.success_text}`,
            };
          }
        } catch {
          // Text not found
        }
      }

      return { success: false, reason: "DOM verification failed" };
    } catch (error) {
      return {
        success: false,
        reason: error instanceof Error ? error.message : "DOM error",
      };
    }
  }
}
