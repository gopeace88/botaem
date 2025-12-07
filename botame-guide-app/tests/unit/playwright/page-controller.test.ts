import { PageController } from '@electron/playwright/page-controller';
import { BrowserController } from '@electron/playwright/browser-controller';

describe('PageController', () => {
  let browserController: BrowserController;
  let pageController: PageController;

  beforeAll(async () => {
    browserController = new BrowserController();
    await browserController.launch({ headless: true });
    pageController = new PageController(browserController.getPage()!);
  }, 30000);

  afterAll(async () => {
    await browserController.close();
  }, 30000);

  describe('click', () => {
    beforeEach(async () => {
      await browserController.getPage()!.setContent(`
        <button id="test-btn">Click Me</button>
        <div id="non-clickable">Static Text</div>
      `);
    });

    test('should click element by selector', async () => {
      const result = await pageController.click('#test-btn');
      expect(result.success).toBe(true);
      expect(result.clicked).toBe(true);
    });

    test('should return error for non-existent element', async () => {
      const result = await pageController.click('#non-existent', { timeout: 1000 });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should measure click duration', async () => {
      const result = await pageController.click('#test-btn');
      expect(result.duration).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('type', () => {
    beforeEach(async () => {
      await browserController.getPage()!.setContent(`
        <input id="test-input" type="text" />
        <input id="prefilled-input" type="text" value="existing" />
      `);
    });

    test('should type text into input', async () => {
      const result = await pageController.type('#test-input', 'Hello World');
      expect(result.success).toBe(true);
      expect(result.typed).toBe('Hello World');

      const value = await browserController.getPage()!.inputValue('#test-input');
      expect(value).toBe('Hello World');
    });

    test('should clear existing text by default', async () => {
      const result = await pageController.type('#prefilled-input', 'New Value');
      expect(result.success).toBe(true);

      const value = await browserController.getPage()!.inputValue('#prefilled-input');
      expect(value).toBe('New Value');
    });

    test('should return error for non-existent element', async () => {
      const result = await pageController.type('#non-existent', 'text', { timeout: 1000 });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('select', () => {
    beforeEach(async () => {
      await browserController.getPage()!.setContent(`
        <select id="test-select">
          <option value="a">Option A</option>
          <option value="b">Option B</option>
          <option value="c">Option C</option>
        </select>
      `);
    });

    test('should select option by value', async () => {
      const result = await pageController.select('#test-select', 'b');
      expect(result.success).toBe(true);
      expect(result.selected).toContain('b');
    });

    test('should select multiple options', async () => {
      await browserController.getPage()!.setContent(`
        <select id="multi-select" multiple>
          <option value="a">A</option>
          <option value="b">B</option>
          <option value="c">C</option>
        </select>
      `);

      const result = await pageController.select('#multi-select', ['a', 'c']);
      expect(result.success).toBe(true);
      expect(result.selected).toEqual(expect.arrayContaining(['a', 'c']));
    });
  });

  describe('waitForElement', () => {
    test('should wait for element to appear', async () => {
      await browserController.getPage()!.setContent(`<div id="existing">Hello</div>`);

      const result = await pageController.waitForElement('#existing');
      expect(result.success).toBe(true);
      expect(result.waited).toBeDefined();
    });

    test('should timeout for non-existent element', async () => {
      await browserController.getPage()!.setContent(`<div>No target</div>`);

      const result = await pageController.waitForElement('#non-existent', { timeout: 500 });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('waitForNavigation', () => {
    test('should wait for navigation to complete', async () => {
      const navigationPromise = pageController.waitForNavigation();
      await browserController.getPage()!.goto('https://example.com');
      const result = await navigationPromise;

      expect(result.success).toBe(true);
    }, 30000);
  });

  describe('assertText', () => {
    beforeEach(async () => {
      await browserController.getPage()!.setContent(`
        <div id="msg">Success</div>
        <div id="long-msg">Operation completed successfully</div>
      `);
    });

    test('should pass when text matches exactly', async () => {
      const result = await pageController.assertText('#msg', 'Success');
      expect(result.success).toBe(true);
      expect(result.actual).toBe('Success');
    });

    test('should fail when text does not match', async () => {
      const result = await pageController.assertText('#msg', 'Error');
      expect(result.success).toBe(false);
      expect(result.expected).toBe('Error');
      expect(result.actual).toBe('Success');
    });

    test('should support partial match', async () => {
      const result = await pageController.assertText('#long-msg', 'completed', { partial: true });
      expect(result.success).toBe(true);
    });

    test('should fail partial match when substring not found', async () => {
      const result = await pageController.assertText('#long-msg', 'failed', { partial: true });
      expect(result.success).toBe(false);
    });
  });

  describe('getElementInfo', () => {
    beforeEach(async () => {
      await browserController.getPage()!.setContent(`
        <button id="enabled-btn">Enabled</button>
        <button id="disabled-btn" disabled>Disabled</button>
        <div id="hidden-div" style="display: none;">Hidden</div>
      `);
    });

    test('should return element information for existing element', async () => {
      const info = await pageController.getElementInfo('#enabled-btn');

      expect(info.exists).toBe(true);
      expect(info.visible).toBe(true);
      expect(info.enabled).toBe(true);
      expect(info.text).toBe('Enabled');
      expect(info.boundingBox).toBeDefined();
    });

    test('should show disabled state', async () => {
      const info = await pageController.getElementInfo('#disabled-btn');

      expect(info.exists).toBe(true);
      expect(info.enabled).toBe(false);
      expect(info.text).toBe('Disabled');
    });

    test('should show hidden state', async () => {
      const info = await pageController.getElementInfo('#hidden-div');

      expect(info.exists).toBe(true);
      expect(info.visible).toBe(false);
    });

    test('should return exists=false for non-existent element', async () => {
      const info = await pageController.getElementInfo('#non-existent');

      expect(info.exists).toBe(false);
    });
  });

  describe('getUrl', () => {
    test('should return current URL', async () => {
      await browserController.getPage()!.goto('https://example.com');
      const url = pageController.getUrl();

      expect(url).toContain('example.com');
    }, 30000);
  });
});
