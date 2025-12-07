/**
 * StepVerifier - Interactive Watch & Guide
 *
 * Verifies user actions after each step:
 * 1. DOM verification first (free)
 * 2. Vision API fallback if DOM fails
 * 3. Stop Vision after 3 consecutive failures (cost control)
 */

import { Page } from 'playwright';
import { PlaybookStep, StepVerify, VerifyResult } from '../playbook/types';
import { ClaudeVisionService } from './claude-vision.service';
import { VisionConfig } from './api.types';

const MAX_VISION_RETRIES = 3;
const DOM_TIMEOUT = 3000;

export class StepVerifier {
  private visionService: ClaudeVisionService | null = null;
  private visionFailCount = 0;
  private visionEnabled = true;

  constructor(visionConfig?: VisionConfig) {
    if (visionConfig) {
      this.visionService = new ClaudeVisionService(visionConfig);
    }
  }

  /**
   * Configure Vision service (can be set later)
   */
  setVisionConfig(config: VisionConfig): void {
    this.visionService = new ClaudeVisionService(config);
    this.visionEnabled = true;
    this.visionFailCount = 0;
  }

  /**
   * Reset Vision failure count (call when step succeeds)
   */
  resetVisionFailCount(): void {
    this.visionFailCount = 0;
  }

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
        method: 'dom',
        retryCount: 0,
      };
    }

    // Step 1: DOM verification (free)
    const domResult = await this.verifyByDOM(verify, page);
    if (domResult.success) {
      this.resetVisionFailCount();
      return {
        success: true,
        method: 'dom',
        message: 'DOM 검증 성공',
        retryCount: 0,
      };
    }

    // Step 2: Vision verification (if enabled and within limit)
    if (this.canUseVision(verify)) {
      const visionResult = await this.verifyByVision(step, verify, page);
      return visionResult;
    }

    // Step 3: Vision limit exceeded - manual mode
    return {
      success: false,
      method: 'dom',
      message: '자동 검증 한도 초과',
      guidance: '화면을 직접 확인 후 "완료" 버튼을 눌러주세요.',
      retryCount: this.visionFailCount,
    };
  }

  /**
   * DOM-based verification (free, fast)
   */
  private async verifyByDOM(
    verify: StepVerify,
    page: Page
  ): Promise<{ success: boolean; reason?: string }> {
    try {
      // Check selector exists
      if (verify.success_selector) {
        const selectors = verify.success_selector.split(',').map((s) => s.trim());
        for (const selector of selectors) {
          try {
            const element = await page.waitForSelector(selector, {
              timeout: DOM_TIMEOUT,
              state: 'visible',
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
            return { success: true, reason: `Text found: ${verify.success_text}` };
          }
        } catch {
          // Text not found
        }
      }

      return { success: false, reason: 'DOM verification failed' };
    } catch (error) {
      return {
        success: false,
        reason: error instanceof Error ? error.message : 'DOM error',
      };
    }
  }

  /**
   * Vision-based verification (Claude API, costs ~$0.01)
   */
  private async verifyByVision(
    step: PlaybookStep,
    verify: StepVerify,
    page: Page
  ): Promise<VerifyResult> {
    if (!this.visionService) {
      return {
        success: false,
        method: 'dom',
        message: 'Vision 서비스가 설정되지 않았습니다',
        retryCount: this.visionFailCount,
      };
    }

    try {
      // Capture screenshot as Buffer
      const screenshotBuffer = await page.screenshot({ type: 'png' });

      // Call Vision API
      const result = await this.visionService.verifyScreenshot({
        screenshot: screenshotBuffer,
        stepMessage: step.message || `Action: ${step.action}`,
        verifyCondition: verify.condition,
      });

      if (!result.success) {
        this.visionFailCount++;
        return {
          success: false,
          method: 'vision',
          message: result.error?.message || 'Vision API 오류',
          retryCount: this.visionFailCount,
        };
      }

      const visionResponse = result.data;

      if (visionResponse.success) {
        this.resetVisionFailCount();
        return {
          success: true,
          method: 'vision',
          message: visionResponse.reason,
          retryCount: 0,
        };
      }

      // Vision verification failed - get guidance
      this.visionFailCount++;
      const guidance = await this.getGuidance(step, visionResponse.reason, page);

      return {
        success: false,
        method: 'vision',
        message: visionResponse.reason,
        guidance,
        retryCount: this.visionFailCount,
      };
    } catch (error) {
      this.visionFailCount++;
      return {
        success: false,
        method: 'vision',
        message: error instanceof Error ? error.message : 'Vision error',
        retryCount: this.visionFailCount,
      };
    }
  }

  /**
   * Get guidance message when verification fails
   */
  private async getGuidance(
    step: PlaybookStep,
    failReason: string,
    page: Page
  ): Promise<string> {
    if (!this.visionService) {
      return '작업을 다시 확인해주세요.';
    }

    try {
      const screenshotBuffer = await page.screenshot({ type: 'png' });

      const result = await this.visionService.generateGuidance({
        screenshot: screenshotBuffer,
        stepMessage: step.message || `Action: ${step.action}`,
        failReason,
      });

      if (result.success) {
        return result.data.guidance;
      }

      return '작업을 다시 확인해주세요.';
    } catch {
      return '작업을 다시 확인해주세요.';
    }
  }

  /**
   * Check if Vision API can be used
   */
  private canUseVision(verify: StepVerify): boolean {
    // Vision explicitly disabled
    if (verify.fallback_vision === false) {
      return false;
    }

    // No Vision service configured
    if (!this.visionService) {
      return false;
    }

    // Vision disabled due to limit
    if (!this.visionEnabled) {
      return false;
    }

    // Exceeded max retries
    if (this.visionFailCount >= MAX_VISION_RETRIES) {
      this.visionEnabled = false;
      return false;
    }

    return true;
  }

  /**
   * Get current Vision status
   */
  getVisionStatus(): {
    enabled: boolean;
    failCount: number;
    maxRetries: number;
  } {
    return {
      enabled: this.visionEnabled && this.visionService !== null,
      failCount: this.visionFailCount,
      maxRetries: MAX_VISION_RETRIES,
    };
  }

  /**
   * Re-enable Vision after it was disabled
   */
  enableVision(): void {
    this.visionEnabled = true;
    this.visionFailCount = 0;
  }
}
