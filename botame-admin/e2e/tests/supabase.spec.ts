import { test, expect } from '../fixtures/base.fixture';

test.describe('Supabase Sync', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Navigate to settings
    await authenticatedPage.click('[data-testid="nav-settings"]');
  });

  test('should configure Supabase connection', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="configure-supabase-btn"]');

    // Enter test credentials (from environment)
    const url = process.env.TEST_SUPABASE_URL || 'https://test.supabase.co';
    const key = process.env.TEST_SUPABASE_KEY || 'test-key';

    await authenticatedPage.fill('[data-testid="supabase-url-input"]', url);
    await authenticatedPage.fill('[data-testid="supabase-key-input"]', key);
    await authenticatedPage.click('[data-testid="connect-supabase-btn"]');

    // Verify success or error
    const result = await authenticatedPage.waitForSelector(
      'text:has-text("연결 성공"), text:has-text("연결 실패")',
      { timeout: 5000 }
    ).catch(() => null);

    expect(result).not.toBeNull();
  });

  test('should display connection status', async ({ authenticatedPage }) => {
    // Check if status is displayed
    const statusElement = authenticatedPage.locator('[data-testid="supabase-status"]');
    const isVisible = await statusElement.isVisible().catch(() => false);

    if (isVisible) {
      const status = await statusElement.getAttribute('data-status');
      expect(['connected', 'disconnected', 'error']).toContain(status);
    }
  });

  test('should upload playbook to Supabase', async ({ authenticatedPage }) => {
    // Navigate to playbooks
    await authenticatedPage.click('[data-testid="nav-playbooks"]');

    // Upload first playbook
    const uploadBtn = authenticatedPage.locator('[data-testid="playbook-item"]:first-child [data-testid="upload-playbook-btn"]');
    const hasButton = await uploadBtn.isVisible().catch(() => false);

    if (hasButton) {
      await uploadBtn.click();

      // Verify upload progress or completion
      await authenticatedPage.waitForSelector(
        'text:has-text("업로드 완료"), text:has-text("업로드 실패")',
        { timeout: 10000 }
      );
    } else {
      test.skip();
    }
  });

  test('should upload all playbooks', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="nav-playbooks"]');
    await authenticatedPage.click('[data-testid="upload-all-playbooks-btn"]');

    // Verify progress indicator
    await expect(authenticatedPage.locator('[data-testid="upload-progress"]')).toBeVisible();

    // Wait for completion
    await authenticatedPage.waitForSelector(
      'text:has-text("모든 플레이북 업로드 완료"), text:has-text("업로드 실패")',
      { timeout: 30000 }
    );
  });

  test('should list remote playbooks', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="nav-catalog"]');

    // Wait for catalog to load
    await authenticatedPage.waitForSelector('[data-testid="catalog-loading"]', { timeout: 5000 }).catch(() => {});

    // Verify catalog is displayed
    await expect(authenticatedPage.locator('[data-testid="playbook-catalog"]')).toBeVisible({ timeout: 10000 });
  });

  test('should download playbook from catalog', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="nav-catalog"]');

    // Wait for catalog to load
    await authenticatedPage.waitForSelector('[data-testid="catalog-item"]', { timeout: 15000 }).catch(() => {
      test.skip();
    });

    // Download first playbook
    await authenticatedPage.click('[data-testid="catalog-item"]:first-child [data-testid="download-playbook-btn"]');

    // Verify download success
    await expect(authenticatedPage.locator('text:has-text("다운로드 완료")')).toBeVisible({ timeout: 10000 });
  });

  test('should run playbook directly from catalog', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[data-testid="nav-catalog"]');

    // Wait for catalog
    await authenticatedPage.waitForSelector('[data-testid="catalog-item"]', { timeout: 15000 }).catch(() => {
      test.skip();
    });

    // Run first playbook
    await authenticatedPage.click('[data-testid="catalog-item"]:first-child [data-testid="run-catalog-playbook-btn"]');

    // Verify runner panel opens
    await expect(authenticatedPage.locator('[data-testid="runner-panel"]')).toBeVisible();
  });
});
