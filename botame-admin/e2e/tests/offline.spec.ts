import { test, expect } from '../fixtures/base.fixture';

test.describe('Offline Mode', () => {
  test('should work offline when data is cached', async ({ authenticatedPage, context }) => {
    // Simulate offline mode
    await context.setOffline(true);

    // Navigate to playbook list (should use cached data)
    await authenticatedPage.click('[data-testid="nav-playbooks"]');

    // Verify offline indicator appears
    await expect(authenticatedPage.locator('[data-testid="offline-indicator"]')).toBeVisible();

    // Verify cached data is displayed
    await expect(authenticatedPage.locator('[data-testid="playbook-list"]')).toBeVisible();
  });

  test('should queue operations when offline', async ({ authenticatedPage, context }) => {
    // Go offline
    await context.setOffline(true);

    // Try to upload playbook (should queue)
    await authenticatedPage.click('[data-testid="nav-playbooks"]');

    const uploadButton = authenticatedPage.locator('[data-testid="playbook-item"]:first-child [data-testid="upload-playbook-btn"]');
    const hasUploadButton = await uploadButton.isVisible().catch(() => false);

    if (hasUploadButton) {
      await uploadButton.click();

      // Verify queued indicator
      await expect(authenticatedPage.locator('text:has-text("오프라인 대기 중")')).toBeVisible();
    }

    // Go back online
    await context.setOffline(false);

    // Verify sync starts
    await expect(authenticatedPage.locator('text:has-text("동기화 중")')).toBeVisible({ timeout: 5000 });
  });

  test('should sync queued operations when back online', async ({ authenticatedPage, context }) => {
    // Start offline
    await context.setOffline(true);

    // Create a playbook (will be queued)
    await authenticatedPage.click('[data-testid="nav-playbooks"]');
    await authenticatedPage.click('[data-testid="create-playbook-btn"]');

    const playbookName = `Offline Test ${Date.now()}`;
    await authenticatedPage.fill('[data-testid="playbook-name-input"]', playbookName);
    await authenticatedPage.fill('[data-testid="playbook-description-input"]', 'Created offline');
    await authenticatedPage.click('[data-testid="save-playbook-btn"]');

    // Verify saved locally
    await expect(authenticatedPage.locator(`text:has-text("${playbookName}")`)).toBeVisible();

    // Go online
    await context.setOffline(false);

    // Verify sync indicator
    await expect(authenticatedPage.locator('[data-testid="sync-indicator"]')).toBeVisible({ timeout: 5000 });
    await expect(authenticatedPage.locator('text:has-text("동기화 완료")')).toBeVisible({ timeout: 10000 });
  });

  test('should display pending sync count', async ({ authenticatedPage, context }) => {
    // Offline
    await context.setOffline(true);

    // Create multiple items to sync
    for (let i = 0; i < 3; i++) {
      await authenticatedPage.click('[data-testid="create-playbook-btn"]');
      await authenticatedPage.fill('[data-testid="playbook-name-input"]', `Sync Test ${i}`);
      await authenticatedPage.click('[data-testid="save-playbook-btn"]');
      await authenticatedPage.waitForTimeout(500);
    }

    // Verify sync count badge
    await expect(authenticatedPage.locator('[data-testid="sync-count-badge"]')).toHaveText('3');

    // Go online and verify sync
    await context.setOffline(false);
    await expect(authenticatedPage.locator('[data-testid="sync-count-badge"]')).not.toBeVisible({ timeout: 10000 });
  });
});
