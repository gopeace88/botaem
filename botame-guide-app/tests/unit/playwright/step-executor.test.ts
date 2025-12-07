import { StepExecutor } from '@electron/playwright/step-executor';
import { BrowserController } from '@electron/playwright/browser-controller';
import { PlaybookStep, ExecutionContext } from '@electron/playbook/types';

describe('StepExecutor', () => {
  let browserController: BrowserController;
  let executor: StepExecutor;

  const createMockContext = (): ExecutionContext => ({
    variables: {},
    currentStepIndex: 0,
    status: 'executing',
    errors: [],
  });

  beforeAll(async () => {
    browserController = new BrowserController();
    await browserController.launch({ headless: true });
    executor = new StepExecutor(browserController);
  }, 30000);

  afterAll(async () => {
    await browserController.close();
  }, 30000);

  describe('execute - navigate', () => {
    test('should navigate to URL', async () => {
      const step: PlaybookStep = {
        id: 'nav-step',
        action: 'navigate',
        value: 'https://example.com',
      };

      const result = await executor.execute(step, createMockContext());

      expect(result.success).toBe(true);
      expect(browserController.getPage()!.url()).toContain('example.com');
    }, 30000);

    test('should throw error without value', async () => {
      const step: PlaybookStep = {
        id: 'nav-step',
        action: 'navigate',
      };

      const result = await executor.execute(step, createMockContext());

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('execute - click', () => {
    beforeEach(async () => {
      await browserController.getPage()!.setContent(`
        <button id="btn">Click Me</button>
      `);
    });

    test('should click element', async () => {
      const step: PlaybookStep = {
        id: 'click-step',
        action: 'click',
        selector: '#btn',
      };

      const result = await executor.execute(step, createMockContext());
      expect(result.success).toBe(true);
    });

    test('should throw error without selector', async () => {
      const step: PlaybookStep = {
        id: 'click-step',
        action: 'click',
      };

      const result = await executor.execute(step, createMockContext());
      expect(result.success).toBe(false);
    });
  });

  describe('execute - type', () => {
    beforeEach(async () => {
      await browserController.getPage()!.setContent(`
        <input id="input" type="text" />
      `);
    });

    test('should type text into input', async () => {
      const step: PlaybookStep = {
        id: 'type-step',
        action: 'type',
        selector: '#input',
        value: 'Hello World',
      };

      const result = await executor.execute(step, createMockContext());
      expect(result.success).toBe(true);

      const value = await browserController.getPage()!.inputValue('#input');
      expect(value).toBe('Hello World');
    });

    test('should throw error without value', async () => {
      const step: PlaybookStep = {
        id: 'type-step',
        action: 'type',
        selector: '#input',
      };

      const result = await executor.execute(step, createMockContext());
      expect(result.success).toBe(false);
    });
  });

  describe('execute - select', () => {
    beforeEach(async () => {
      await browserController.getPage()!.setContent(`
        <select id="select">
          <option value="a">A</option>
          <option value="b">B</option>
        </select>
      `);
    });

    test('should select option', async () => {
      const step: PlaybookStep = {
        id: 'select-step',
        action: 'select',
        selector: '#select',
        value: 'b',
      };

      const result = await executor.execute(step, createMockContext());
      expect(result.success).toBe(true);
    });
  });

  describe('execute - highlight', () => {
    beforeEach(async () => {
      await browserController.getPage()!.setContent(`
        <button id="btn">Click Me</button>
      `);
    });

    test('should highlight element without waiting', async () => {
      const step: PlaybookStep = {
        id: 'highlight-step',
        action: 'highlight',
        selector: '#btn',
        message: 'Click here',
      };

      const result = await executor.execute(step, createMockContext());
      expect(result.success).toBe(true);
      expect(result.waitForUser).toBeFalsy();
    });

    test('should return waitForUser when wait_for is user', async () => {
      const step: PlaybookStep = {
        id: 'highlight-step',
        action: 'highlight',
        selector: '#btn',
        message: 'Click here',
        wait_for: 'user',
      };

      const result = await executor.execute(step, createMockContext());
      expect(result.success).toBe(true);
      expect(result.waitForUser).toBe(true);
    });
  });

  describe('execute - guide', () => {
    test('should return success for guide action', async () => {
      const step: PlaybookStep = {
        id: 'guide-step',
        action: 'guide',
        message: 'This is a guide message',
      };

      const result = await executor.execute(step, createMockContext());
      expect(result.success).toBe(true);
    });

    test('should call guide callback', async () => {
      const callback = jest.fn();
      executor.setGuideCallback(callback);

      const step: PlaybookStep = {
        id: 'guide-step',
        action: 'guide',
        message: 'Guide message',
      };

      await executor.execute(step, createMockContext());
      expect(callback).toHaveBeenCalledWith('Guide message');
    });

    test('should return waitForUser when wait_for is user', async () => {
      const step: PlaybookStep = {
        id: 'guide-step',
        action: 'guide',
        message: 'Please do something',
        wait_for: 'user',
      };

      const result = await executor.execute(step, createMockContext());
      expect(result.waitForUser).toBe(true);
    });
  });

  describe('execute - assert', () => {
    beforeEach(async () => {
      await browserController.getPage()!.setContent(`
        <div id="status">Success</div>
      `);
    });

    test('should pass when text matches', async () => {
      const step: PlaybookStep = {
        id: 'assert-step',
        action: 'assert',
        selector: '#status',
        value: 'Success',
      };

      const result = await executor.execute(step, createMockContext());
      expect(result.success).toBe(true);
    });

    test('should fail when text does not match', async () => {
      const step: PlaybookStep = {
        id: 'assert-step',
        action: 'assert',
        selector: '#status',
        value: 'Error',
      };

      const result = await executor.execute(step, createMockContext());
      expect(result.success).toBe(false);
    });
  });

  describe('execute - wait', () => {
    test('should wait for element', async () => {
      await browserController.getPage()!.setContent(`<div id="target">Loaded</div>`);

      const step: PlaybookStep = {
        id: 'wait-step',
        action: 'wait',
        wait_for: 'element',
        selector: '#target',
      };

      const result = await executor.execute(step, createMockContext());
      expect(result.success).toBe(true);
    });

    test('should return waitForUser for user wait_for', async () => {
      const step: PlaybookStep = {
        id: 'wait-step',
        action: 'wait',
        wait_for: 'user',
      };

      const result = await executor.execute(step, createMockContext());
      expect(result.success).toBe(true);
      expect(result.waitForUser).toBe(true);
    });

    test('should wait for navigation', async () => {
      await browserController.getPage()!.goto('https://example.com');

      const step: PlaybookStep = {
        id: 'wait-step',
        action: 'wait',
        wait_for: 'navigation',
      };

      const result = await executor.execute(step, createMockContext());
      expect(result.success).toBe(true);
    }, 30000);
  });

  describe('execute - unknown action', () => {
    test('should return error for unknown action', async () => {
      const step: PlaybookStep = {
        id: 'unknown-step',
        action: 'unknown' as any,
      };

      const result = await executor.execute(step, createMockContext());
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Unknown action');
    });
  });

  describe('result includes duration', () => {
    test('should include duration in result', async () => {
      await browserController.getPage()!.setContent(`<button id="btn">Click</button>`);

      const step: PlaybookStep = {
        id: 'click-step',
        action: 'click',
        selector: '#btn',
      };

      const result = await executor.execute(step, createMockContext());
      expect(result.duration).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });
});
