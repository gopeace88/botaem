import { BrowserController } from '@electron/playwright/browser-controller';

describe('BrowserController', () => {
  let controller: BrowserController;

  beforeEach(() => {
    controller = new BrowserController();
  });

  afterEach(async () => {
    await controller.close();
  });

  describe('initial state', () => {
    test('should start in idle state', () => {
      expect(controller.getState()).toBe('idle');
    });

    test('should not be ready initially', () => {
      expect(controller.isReady()).toBe(false);
    });

    test('should have no page initially', () => {
      expect(controller.getPage()).toBeNull();
    });
  });

  describe('launch', () => {
    test('should launch browser and set ready state', async () => {
      await controller.launch({ headless: true });

      expect(controller.getState()).toBe('ready');
      expect(controller.isReady()).toBe(true);
    }, 30000);

    test('should create new page after launch', async () => {
      await controller.launch({ headless: true });

      const page = controller.getPage();
      expect(page).toBeDefined();
      expect(page).not.toBeNull();
    }, 30000);

    test('should emit stateChange events', async () => {
      const stateChanges: string[] = [];
      controller.on('stateChange', ({ to }) => stateChanges.push(to));

      await controller.launch({ headless: true });

      expect(stateChanges).toContain('launching');
      expect(stateChanges).toContain('ready');
    }, 30000);

    test('should throw error if already launched', async () => {
      await controller.launch({ headless: true });

      await expect(controller.launch({ headless: true })).rejects.toThrow();
    }, 30000);
  });

  describe('close', () => {
    test('should close browser and set closed state', async () => {
      await controller.launch({ headless: true });
      await controller.close();

      expect(controller.getState()).toBe('closed');
    }, 30000);

    test('should handle close when not launched', async () => {
      await expect(controller.close()).resolves.not.toThrow();
      expect(controller.getState()).toBe('closed');
    });

    test('should clear page reference on close', async () => {
      await controller.launch({ headless: true });
      await controller.close();

      expect(controller.getPage()).toBeNull();
    }, 30000);
  });

  describe('navigate', () => {
    test('should navigate to URL', async () => {
      await controller.launch({ headless: true });
      await controller.navigate('https://example.com');

      const page = controller.getPage()!;
      expect(page.url()).toContain('example.com');
    }, 30000);

    test('should throw error when not ready', async () => {
      await expect(controller.navigate('https://example.com')).rejects.toThrow(
        'Browser is not ready'
      );
    });

    test('should emit navigation event', async () => {
      await controller.launch({ headless: true });

      const navigationEvents: string[] = [];
      controller.on('navigation', ({ url }) => navigationEvents.push(url));

      await controller.navigate('https://example.com');

      expect(navigationEvents.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('getPageInfo', () => {
    test('should return current page info', async () => {
      await controller.launch({ headless: true });
      await controller.navigate('https://example.com');

      const info = await controller.getPageInfo();

      expect(info.url).toContain('example.com');
      expect(info.title).toBeDefined();
      expect(info.viewport).toBeDefined();
    }, 30000);

    test('should throw error when not ready', async () => {
      await expect(controller.getPageInfo()).rejects.toThrow('Browser is not ready');
    });
  });

  describe('screenshot', () => {
    test('should capture screenshot as base64', async () => {
      await controller.launch({ headless: true });
      await controller.navigate('https://example.com');

      const screenshot = await controller.screenshot();

      expect(typeof screenshot).toBe('string');
      expect(screenshot.length).toBeGreaterThan(0);
    }, 30000);
  });
});
