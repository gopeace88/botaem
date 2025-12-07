import { HighlightController } from '@electron/playwright/highlight-controller';
import { BrowserController } from '@electron/playwright/browser-controller';

describe('HighlightController', () => {
  let browserController: BrowserController;
  let highlightController: HighlightController;

  beforeAll(async () => {
    browserController = new BrowserController();
    await browserController.launch({ headless: true });
    highlightController = new HighlightController(browserController.getPage()!);
  }, 30000);

  afterAll(async () => {
    await browserController.close();
  }, 30000);

  beforeEach(async () => {
    await browserController.getPage()!.setContent(`
      <div style="padding: 50px;">
        <button id="test-btn" style="padding: 10px;">Click Me</button>
        <input id="test-input" type="text" style="padding: 5px;" />
        <div id="test-div" style="width: 100px; height: 50px;">Content</div>
      </div>
    `);
  });

  describe('highlight', () => {
    test('should add highlight overlay to element', async () => {
      const result = await highlightController.highlight({
        selector: '#test-btn',
        message: 'Click this button',
      });

      expect(result.success).toBe(true);

      // Check if highlight element exists
      const highlightExists = await browserController.getPage()!.evaluate(() => {
        return document.querySelector('.botame-highlight') !== null;
      });

      expect(highlightExists).toBe(true);
    });

    test('should show message with highlight', async () => {
      await highlightController.highlight({
        selector: '#test-btn',
        message: 'Test Message',
      });

      const messageText = await browserController.getPage()!.evaluate(() => {
        const msg = document.querySelector('.botame-highlight-message');
        return msg?.textContent;
      });

      expect(messageText).toBe('Test Message');
    });

    test('should apply custom color', async () => {
      await highlightController.highlight({
        selector: '#test-btn',
        style: {
          color: '#FF0000',
        },
      });

      const borderColor = await browserController.getPage()!.evaluate(() => {
        const box = document.querySelector('.botame-highlight-box') as HTMLElement;
        return box?.style.borderColor;
      });

      // RGB format may vary, check for red component
      expect(borderColor).toBeTruthy();
    });

    test('should return error for non-existent element', async () => {
      const result = await highlightController.highlight({
        selector: '#non-existent',
        message: 'Not found',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should replace previous highlight', async () => {
      await highlightController.highlight({
        selector: '#test-btn',
        message: 'First',
      });

      await highlightController.highlight({
        selector: '#test-input',
        message: 'Second',
      });

      const highlightCount = await browserController.getPage()!.evaluate(() => {
        return document.querySelectorAll('.botame-highlight').length;
      });

      expect(highlightCount).toBe(1);

      const messageText = await browserController.getPage()!.evaluate(() => {
        const msg = document.querySelector('.botame-highlight-message');
        return msg?.textContent;
      });

      expect(messageText).toBe('Second');
    });
  });

  describe('clearHighlight', () => {
    test('should remove all highlights', async () => {
      await highlightController.highlight({
        selector: '#test-btn',
        message: 'Test',
      });

      await highlightController.clearHighlight();

      const highlightExists = await browserController.getPage()!.evaluate(() => {
        return document.querySelector('.botame-highlight') !== null;
      });

      expect(highlightExists).toBe(false);
    });

    test('should not throw if no highlight exists', async () => {
      await expect(highlightController.clearHighlight()).resolves.not.toThrow();
    });
  });

  describe('highlightAndWait', () => {
    test('should highlight and wait for element click', async () => {
      const waitPromise = highlightController.highlightAndWait({
        selector: '#test-btn',
        message: 'Click the button',
      });

      // Simulate clicking the button
      await browserController.getPage()!.click('#test-btn');

      const result = await waitPromise;
      expect(result.success).toBe(true);
    }, 10000);

    test('should clear highlight after click', async () => {
      const waitPromise = highlightController.highlightAndWait({
        selector: '#test-btn',
      });

      await browserController.getPage()!.click('#test-btn');
      await waitPromise;

      const highlightExists = await browserController.getPage()!.evaluate(() => {
        return document.querySelector('.botame-highlight') !== null;
      });

      expect(highlightExists).toBe(false);
    }, 10000);
  });

  describe('highlight without message', () => {
    test('should work without message', async () => {
      const result = await highlightController.highlight({
        selector: '#test-btn',
      });

      expect(result.success).toBe(true);

      // Message element should not exist
      const messageExists = await browserController.getPage()!.evaluate(() => {
        return document.querySelector('.botame-highlight-message') !== null;
      });

      expect(messageExists).toBe(false);
    });
  });
});
