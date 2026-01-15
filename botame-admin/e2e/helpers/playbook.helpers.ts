import { Page } from '@playwright/test';

/**
 * Helper functions for playbook operations in E2E tests
 */
export class PlaybookHelpers {
  constructor(private page: Page) {}

  /**
   * Navigate to playbook list
   */
  async navigateToPlaybooks() {
    await this.page.click('[data-testid="nav-playbooks"]');
    await this.page.waitForSelector('[data-testid="playbook-list"]', { timeout: 5000 });
  }

  /**
   * Create a new playbook
   */
  async createPlaybook(name: string, description: string) {
    await this.page.click('[data-testid="create-playbook-btn"]');
    await this.page.fill('[data-testid="playbook-name-input"]', name);
    await this.page.fill('[data-testid="playbook-description-input"]', description);
    await this.page.click('[data-testid="save-playbook-btn"]');

    // Wait for success
    await this.page.waitForSelector(`text:has-text("${name}")`, { timeout: 5000 });
  }

  /**
   * Start recording
   */
  async startRecording(url?: string) {
    await this.page.click('[data-testid="start-recording-btn"]');

    if (url) {
      await this.page.fill('[data-testid="target-url-input"]', url);
      await this.page.click('[data-testid="confirm-start-recording"]');
    }

    // Wait for recording to start
    await this.page.waitForSelector('[data-testid="recording-indicator"]', { timeout: 10000 });
  }

  /**
   * Stop recording
   */
  async stopRecording() {
    await this.page.click('[data-testid="stop-recording-btn"]');
    await this.page.waitForSelector('text:has-text("녹화 완료")', { timeout: 5000 });
  }

  /**
   * Generate playbook from recording
   */
  async generatePlaybook(metadata: { name: string; description: string; category: string }) {
    await this.page.click('[data-testid="generate-playbook-btn"]');

    await this.page.fill('[data-testid="metadata-name"]', metadata.name);
    await this.page.fill('[data-testid="metadata-description"]', metadata.description);
    await this.page.fill('[data-testid="metadata-category"]', metadata.category);

    await this.page.click('[data-testid="save-generated-playbook"]');
    await this.page.waitForSelector('text:has-text("저장 완료")', { timeout: 5000 });
  }

  /**
   * Run playbook
   */
  async runPlaybook(playbookId: string) {
    await this.page.click(`[data-testid="run-playbook-${playbookId}"]`);
    await this.page.waitForSelector('[data-testid="runner-panel"]', { timeout: 5000 });
    await this.page.click('[data-testid="start-run-btn"]');
  }

  /**
   * Wait for run completion
   */
  async waitForRunComplete(timeout = 60000) {
    await this.page.waitForSelector(
      '[data-testid="run-status-completed"], [data-testid="run-status-failed"]',
      { timeout }
    );
  }

  /**
   * Get run results
   */
  async getRunResults() {
    const status = await this.page.getAttribute('[data-testid="run-status"]', 'data-status');
    const steps = await this.page.$$eval('[data-testid="run-step"]', elements =>
      elements.map(el => ({
        id: el.getAttribute('data-step-id'),
        status: el.getAttribute('data-step-status'),
        message: el.textContent,
      }))
    );

    return { status, steps };
  }
}
