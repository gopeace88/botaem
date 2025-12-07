import { EventEmitter } from 'events';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import {
  BrowserLaunchOptions,
  ControllerState,
  PageInfo,
} from './types';

/**
 * BrowserController - Manages browser lifecycle and state
 */
export class BrowserController extends EventEmitter {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private state: ControllerState = 'idle';

  /**
   * Launch browser
   */
  async launch(options: BrowserLaunchOptions = {}): Promise<void> {
    if (this.state !== 'idle' && this.state !== 'closed') {
      throw new Error(`Cannot launch: current state is ${this.state}`);
    }

    this.setState('launching');

    try {
      this.browser = await chromium.launch({
        headless: options.headless ?? false,
        slowMo: options.slowMo,
        devtools: options.devtools,
        args: [
          ...(options.args ?? ['--start-maximized']),
          '--remote-debugging-port=9222',  // CDP port for external connection
        ],
      });

      this.context = await this.browser.newContext({
        viewport: null, // Full screen
      });

      this.page = await this.context.newPage();

      // Set up event listeners
      this.setupPageListeners();

      this.setState('ready');
    } catch (error) {
      this.setState('error');
      throw error;
    }
  }

  /**
   * Close browser
   */
  async close(): Promise<void> {
    if (!this.browser) {
      this.setState('closed');
      return;
    }

    try {
      await this.browser.close();
    } finally {
      this.browser = null;
      this.context = null;
      this.page = null;
      this.setState('closed');
    }
  }

  /**
   * Navigate to URL
   */
  async navigate(url: string): Promise<void> {
    this.ensureReady();

    this.setState('busy');
    try {
      await this.page!.goto(url, { waitUntil: 'networkidle' });
      this.emit('navigation', { url });
    } finally {
      this.setState('ready');
    }
  }

  /**
   * Get current page info
   */
  async getPageInfo(): Promise<PageInfo> {
    this.ensureReady();

    return {
      url: this.page!.url(),
      title: await this.page!.title(),
      viewport: this.page!.viewportSize() || { width: 0, height: 0 },
    };
  }

  /**
   * Capture screenshot
   */
  async screenshot(): Promise<string> {
    this.ensureReady();

    const buffer = await this.page!.screenshot({ type: 'png' });
    return buffer.toString('base64');
  }

  // === Getters ===

  getState(): ControllerState {
    return this.state;
  }

  isReady(): boolean {
    return this.state === 'ready';
  }

  getPage(): Page | null {
    return this.page;
  }

  getBrowser(): Browser | null {
    return this.browser;
  }

  getContext(): BrowserContext | null {
    return this.context;
  }

  // === Private Methods ===

  private setState(state: ControllerState): void {
    const from = this.state;
    this.state = state;
    this.emit('stateChange', { from, to: state });
  }

  private ensureReady(): void {
    if (!this.page || this.state !== 'ready') {
      throw new Error('Browser is not ready');
    }
  }

  private setupPageListeners(): void {
    if (!this.page) return;

    this.page.on('load', () => {
      this.emit('pageLoad', {
        url: this.page!.url(),
        title: '', // Need to get async
      });
    });

    this.page.on('pageerror', (error) => {
      this.emit('pageError', { error });
    });

    this.page.on('console', (msg) => {
      this.emit('console', { type: msg.type(), text: msg.text() });
    });

    this.page.on('dialog', async (dialog) => {
      this.emit('dialog', { type: dialog.type(), message: dialog.message() });
      // Accept dialog by default
      await dialog.accept();
    });
  }
}
