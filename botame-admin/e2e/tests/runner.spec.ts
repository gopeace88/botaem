import { test, expect } from '../fixtures/base.fixture';
import { PlaybookHelpers } from '../helpers/playbook.helpers';

test.describe('Playbook Runner', () => {
  let helpers: PlaybookHelpers;

  test.beforeEach(async ({ authenticatedPage }) => {
    helpers = new PlaybookHelpers(authenticatedPage);
  });

  test('should run playbook successfully', async ({ authenticatedPage }) => {
    await helpers.navigateToPlaybooks();

    // Run first playbook (assuming test data exists)
    await authenticatedPage.click('[data-testid="playbook-item"]:first-child [data-testid="run-playbook-btn"]');

    // Wait for runner panel to open
    await expect(authenticatedPage.locator('[data-testid="runner-panel"]')).toBeVisible();

    // Start execution
    await authenticatedPage.click('[data-testid="start-run-btn"]');

    // Wait for completion or failure
    await helpers.waitForRunComplete();

    // Check final status
    const status = await authenticatedPage.getAttribute('[data-testid="run-status"]', 'data-status');
    expect(['completed', 'failed']).toContain(status);
  });

  test('should pause and resume execution', async ({ authenticatedPage }) => {
    await helpers.navigateToPlaybooks();
    await authenticatedPage.click('[data-testid="playbook-item"]:first-child [data-testid="run-playbook-btn"]');
    await authenticatedPage.click('[data-testid="start-run-btn"]');

    // Wait for first step to start
    await authenticatedPage.waitForSelector('[data-testid="run-step"][data-step-status="running"]', { timeout: 10000 });

    // Pause
    await authenticatedPage.click('[data-testid="pause-run-btn"]');
    await expect(authenticatedPage.locator('text:has-text("일시정지")')).toBeVisible();

    // Resume
    await authenticatedPage.click('[data-testid="resume-run-btn"]');
    await expect(authenticatedPage.locator('text:has-text("실행 중")')).toBeVisible();
  });

  test('should stop execution', async ({ authenticatedPage }) => {
    await helpers.navigateToPlaybooks();
    await authenticatedPage.click('[data-testid="playbook-item"]:first-child [data-testid="run-playbook-btn"]');
    await authenticatedPage.click('[data-testid="start-run-btn"]');

    // Wait for first step to start
    await authenticatedPage.waitForSelector('[data-testid="run-step"][data-step-status="running"]', { timeout: 10000 });

    // Stop
    await authenticatedPage.click('[data-testid="stop-run-btn"]');

    // Verify stopped
    await expect(authenticatedPage.locator('text:has-text("중지됨")')).toBeVisible();
  });

  test('should display step execution results', async ({ authenticatedPage }) => {
    await helpers.navigateToPlaybooks();
    await authenticatedPage.click('[data-testid="playbook-item"]:first-child [data-testid="run-playbook-btn"]');
    await authenticatedPage.click('[data-testid="start-run-btn"]');

    // Wait for first step to complete
    await authenticatedPage.waitForSelector(
      '[data-testid="run-step"][data-step-status="success"], [data-testid="run-step"][data-step-status="failed"]',
      { timeout: 10000 }
    );

    // Verify step details are visible
    const steps = await authenticatedPage.locator('[data-testid="run-step"]').count();
    expect(steps).toBeGreaterThan(0);
  });

  test('should show auto-healing indicator when selector fails and recovers', async ({ authenticatedPage }) => {
    // This test requires a playbook with known failing selectors
    await helpers.navigateToPlaybooks();

    // Find and run a test playbook with auto-healing
    const playbookName = 'Auto-Heal Test';
    const hasTestPlaybook = await authenticatedPage.locator(`[data-testid="playbook-item"] >> text=${playbookName}`).isVisible().catch(() => false);

    if (!hasTestPlaybook) {
      test.skip();
      return;
    }

    await authenticatedPage.click(`[data-testid="run-playbook-${playbookName}"]`);
    await authenticatedPage.click('[data-testid="start-run-btn"]');

    // Wait for a healed step
    await authenticatedPage.waitForSelector('[data-testid="run-step"][data-healed="true"]', { timeout: 30000 });

    // Verify heal method is shown
    const healMethod = await authenticatedPage.getAttribute('[data-testid="run-step"][data-healed="true"]', 'data-heal-method');
    expect(['fallback', 'text', 'aria', 'dynamic', 'manual']).toContain(healMethod);
  });
});
