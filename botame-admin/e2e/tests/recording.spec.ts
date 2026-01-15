import { test, expect } from '../fixtures/base.fixture';
import { PlaybookHelpers } from '../helpers/playbook.helpers';

test.describe('Recording Flow', () => {
  let helpers: PlaybookHelpers;

  test.beforeEach(async ({ authenticatedPage }) => {
    helpers = new PlaybookHelpers(authenticatedPage);
  });

  test('should start recording session', async ({ authenticatedPage }) => {
    await helpers.startRecording('https://www.losims.go.kr/lss.do');

    // Verify recording indicator is visible
    await expect(authenticatedPage.locator('[data-testid="recording-indicator"]')).toBeVisible();
    await expect(authenticatedPage.locator('text:has-text("녹화 중")')).toBeVisible();
  });

  test('should pause and resume recording', async ({ authenticatedPage }) => {
    await helpers.startRecording();

    // Pause
    await authenticatedPage.click('[data-testid="pause-recording-btn"]');
    await expect(authenticatedPage.locator('text:has-text("일시정지")')).toBeVisible();

    // Resume
    await authenticatedPage.click('[data-testid="resume-recording-btn"]');
    await expect(authenticatedPage.locator('text:has-text("녹화 중")')).toBeVisible();
  });

  test('should clear recording', async ({ authenticatedPage }) => {
    await helpers.startRecording();
    await authenticatedPage.click('[data-testid="clear-recording-btn"]');

    // Confirm clear
    await authenticatedPage.click('[data-testid="confirm-clear-btn"]');

    // Verify steps are cleared
    const stepCount = await authenticatedPage.locator('[data-testid="recorded-step"]').count();
    expect(stepCount).toBe(0);
  });

  test('should delete recorded step', async ({ authenticatedPage }) => {
    await helpers.startRecording();

    // Wait for at least one step to be recorded (simulated)
    await authenticatedPage.waitForTimeout(2000);

    const stepCountBefore = await authenticatedPage.locator('[data-testid="recorded-step"]').count();

    if (stepCountBefore > 0) {
      // Delete first step
      await authenticatedPage.click('[data-testid="recorded-step"]:first-child [data-testid="delete-step-btn"]');

      const stepCountAfter = await authenticatedPage.locator('[data-testid="recorded-step"]').count();
      expect(stepCountAfter).toBe(stepCountBefore - 1);
    }
  });

  test('should generate playbook from recording', async ({ authenticatedPage }) => {
    await helpers.startRecording();
    await helpers.stopRecording();

    const metadata = {
      name: `Recording Test ${Date.now()}`,
      description: 'Generated from E2E test',
      category: 'test',
    };

    await helpers.generatePlaybook(metadata);

    // Verify playbook was created
    await expect(authenticatedPage.locator(`text:has-text("${metadata.name}")`)).toBeVisible();
  });
});
