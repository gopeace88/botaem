import { Page } from '@playwright/test';

/**
 * General helper functions for E2E tests
 */
export class TestHelpers {
  constructor(private page: Page) {}

  /**
   * Wait for app to be ready
   */
  async waitForAppReady() {
    await this.page.waitForSelector('[data-testid="app-root"]', { timeout: 10000 });
  }

  /**
   * Take screenshot with timestamp
   */
  async screenshot(name: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await this.page.screenshot({
      path: `test-results/screenshots/${name}-${timestamp}.png`,
      fullPage: true,
    });
  }

  /**
   * Mock browser service for testing
   */
  async mockBrowserService() {
    await this.page.evaluate(() => {
      // Mock browser launch
      window.electron.invoke = async (channel: string, ...args: unknown[]) => {
        if (channel === 'runner:run') {
          return { success: true, status: 'running' };
        }
        if (channel === 'runner:getState') {
          return {
            success: true,
            state: {
              status: 'idle',
              currentStep: 0,
              totalSteps: 0,
            },
          };
        }
        return { success: false, message: 'Not implemented in test' };
      };
    });
  }

  /**
   * Set up test data
   */
  async setupTestData() {
    await this.page.evaluate(async () => {
      // Create test playbooks in IndexedDB
      const testPlaybooks = [
        {
          id: 'test-1',
          name: 'Test Playbook 1',
          description: 'First test playbook',
          startUrl: 'https://example.com',
          category: 'test',
          steps: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'test-2',
          name: 'Test Playbook 2',
          description: 'Second test playbook',
          startUrl: 'https://example.com',
          category: 'test',
          steps: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      // Store in localStorage for test access
      localStorage.setItem('test-playbooks', JSON.stringify(testPlaybooks));
    });
  }

  /**
   * Clean up test data
   */
  async cleanupTestData() {
    await this.page.evaluate(() => {
      localStorage.removeItem('test-playbooks');
      sessionStorage.clear();
    });
  }

  /**
   * Verify element is visible
   */
  async isVisible(selector: string): Promise<boolean> {
    return await this.page.locator(selector).isVisible().catch(() => false);
  }

  /**
   * Wait for notification
   */
  async waitForNotification(message: string, timeout = 5000) {
    await this.page.waitForSelector(`text:has-text("${message}")`, { timeout });
  }
}
