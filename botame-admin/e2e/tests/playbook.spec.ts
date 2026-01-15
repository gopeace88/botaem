import { test, expect } from '../fixtures/base.fixture';
import { PlaybookHelpers } from '../helpers/playbook.helpers';

test.describe('Playbook Management', () => {
  let helpers: PlaybookHelpers;

  test.beforeEach(async ({ authenticatedPage }) => {
    helpers = new PlaybookHelpers(authenticatedPage);
  });

  test('should display playbook list', async ({ authenticatedPage }) => {
    await helpers.navigateToPlaybooks();

    // Verify playbook list is visible
    await expect(authenticatedPage.locator('[data-testid="playbook-list"]')).toBeVisible();
  });

  test('should create new playbook', async ({ authenticatedPage }) => {
    await helpers.navigateToPlaybooks();

    const playbookName = `Test Playbook ${Date.now()}`;
    await helpers.createPlaybook(playbookName, 'E2E test playbook');

    // Verify playbook appears in list
    await expect(authenticatedPage.locator(`text:has-text("${playbookName}")`)).toBeVisible();
  });

  test('should edit existing playbook', async ({ authenticatedPage }) => {
    await helpers.navigateToPlaybooks();

    // Click edit button on first playbook
    await authenticatedPage.click('[data-testid="playbook-item"]:first-child [data-testid="edit-playbook-btn"]');

    // Modify description
    const newDescription = `Updated description ${Date.now()}`;
    await authenticatedPage.fill('[data-testid="playbook-description-input"]', newDescription);
    await authenticatedPage.click('[data-testid="save-playbook-btn"]');

    // Verify success message
    await expect(authenticatedPage.locator('text:has-text("저장 완료")')).toBeVisible();
  });

  test('should delete playbook', async ({ authenticatedPage }) => {
    await helpers.navigateToPlaybooks();

    // Create a test playbook first
    const playbookName = `Delete Test ${Date.now()}`;
    await helpers.createPlaybook(playbookName, 'Will be deleted');

    // Delete it
    await authenticatedPage.click(`[data-testid="delete-playbook-${playbookName}"]`);

    // Confirm deletion
    await authenticatedPage.click('[data-testid="confirm-delete-btn"]');

    // Verify it's gone
    await expect(authenticatedPage.locator(`text:has-text("${playbookName}")`)).not.toBeVisible();
  });

  test('should export playbook to file', async ({ authenticatedPage }) => {
    await helpers.navigateToPlaybooks();

    // Start download
    const downloadPromise = authenticatedPage.waitForEvent('download');
    await authenticatedPage.click('[data-testid="playbook-item"]:first-child [data-testid="export-playbook-btn"]');
    const download = await downloadPromise;

    // Verify file was downloaded
    expect(download.suggestedFilename()).toMatch(/\.json$/);
  });

  test('should import playbook from file', async ({ authenticatedPage }) => {
    await helpers.navigateToPlaybooks();

    // Create a test file input
    const fileInput = authenticatedPage.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-playbook.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({
        id: 'test-import',
        name: 'Imported Playbook',
        description: 'Test import',
        startUrl: 'https://example.com',
        category: 'test',
        steps: [],
      }, null, 2)),
    });

    // Verify import success
    await expect(authenticatedPage.locator('text:has-text("Imported Playbook")')).toBeVisible();
  });
});
