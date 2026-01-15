import { test as base, Page } from '@playwright/test';

/**
 * Extended test fixture with botame-admin specific setup
 */
export const test = base.extend<{
  authenticatedPage: Page;
}>({
  authenticatedPage: async ({ page }, use) => {
    // Navigate to app
    await page.goto('/');

    // Wait for app to load
    await page.waitForSelector('[data-testid="app-root"]', { timeout: 10000 });

    // Check if API key setup is needed
    const hasApiKeySetup = await page.getByText('API Key 설정').isVisible().catch(() => false);

    if (hasApiKeySetup) {
      // Use test API keys from environment
      const anthropicKey = process.env.TEST_ANTHROPIC_API_KEY || 'test-key';
      const supabaseKey = process.env.TEST_SUPABASE_KEY || 'test-key';

      await page.fill('#anthropic-key', anthropicKey);
      await page.fill('#supabase-key', supabaseKey);
      await page.click('button:has-text("저장")');

      // Wait for success message
      await page.waitForSelector('text:has-text("저장완료")', { timeout: 5000 });
    }

    await use(page);
  },
});

export { expect } from '@playwright/test';
