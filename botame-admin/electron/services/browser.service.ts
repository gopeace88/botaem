/**
 * Browser Service - Manages the Playwright browser instance for admin app
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';

// Default login URL for LOSIMS system
const DEFAULT_BOTAME_URL = 'https://www.losims.go.kr/lss.do';

export class BrowserService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private targetUrl: string;
  private isInitialized = false;

  constructor(targetUrl?: string) {
    this.targetUrl = targetUrl || process.env.VITE_BOTAME_URL || DEFAULT_BOTAME_URL;
  }

  /**
   * Initialize and launch browser
   */
  async initialize(): Promise<{ success: boolean; error?: string }> {
    if (this.isInitialized && this.browser) {
      return { success: true };
    }

    try {
      console.log('[BrowserService] Launching browser...');

      // 한글 입력을 위한 fcitx IME 환경변수 설정
      const imeEnv = {
        ...process.env,
        GTK_IM_MODULE: 'fcitx',
        QT_IM_MODULE: 'fcitx',
        XMODIFIERS: '@im=fcitx',
        SDL_IM_MODULE: 'fcitx',
      };

      this.browser = await chromium.launch({
        headless: false,
        args: ['--start-maximized'],
        env: imeEnv,
      });

      this.context = await this.browser.newContext({
        viewport: null, // Use full window size
      });

      this.page = await this.context.newPage();

      // Navigate to login page
      console.log(`[BrowserService] Navigating to ${this.targetUrl}...`);
      await this.page.goto(this.targetUrl, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      this.isInitialized = true;
      console.log('[BrowserService] Browser initialized successfully');

      return { success: true };
    } catch (error) {
      console.error('[BrowserService] Initialization failed:', error);
      await this.cleanup();
      return {
        success: false,
        error: error instanceof Error ? error.message : '브라우저 초기화 실패',
      };
    }
  }

  /**
   * Navigate to a URL
   */
  async navigateTo(url: string): Promise<{ success: boolean; error?: string }> {
    if (!this.page) {
      return { success: false, error: '브라우저가 초기화되지 않았습니다.' };
    }

    try {
      await this.page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '페이지 이동 실패',
      };
    }
  }

  /**
   * Navigate to main/login page
   */
  async navigateToMain(): Promise<{ success: boolean; error?: string }> {
    return this.navigateTo(this.targetUrl);
  }

  /**
   * Get current page
   */
  getPage(): Page | null {
    return this.page;
  }

  /**
   * Get browser context
   */
  getContext(): BrowserContext | null {
    return this.context;
  }

  /**
   * Check if browser is running
   */
  isRunning(): boolean {
    return this.isInitialized && this.browser !== null && this.browser.isConnected();
  }

  /**
   * Get browser instance
   */
  getBrowser(): Browser | null {
    return this.browser;
  }

  /**
   * Verify browser connection with detailed diagnostics
   */
  async verifyConnection(): Promise<{ connected: boolean; details: string }> {
    if (!this.browser) {
      return { connected: false, details: 'Browser is null' };
    }
    if (!this.browser.isConnected()) {
      return { connected: false, details: 'Browser is not connected' };
    }
    if (!this.page) {
      return { connected: false, details: 'Page is null' };
    }
    if (this.page.isClosed()) {
      return { connected: false, details: 'Page is closed' };
    }

    try {
      const url = await this.page.url();
      return { connected: true, details: `Connected to ${url}` };
    } catch (error) {
      return { connected: false, details: `Error getting URL: ${error}` };
    }
  }

  /**
   * Get current URL
   */
  getCurrentUrl(): string | null {
    return this.page?.url() || null;
  }

  /**
   * Highlight an element in the browser for step preview
   * Supports CSS selectors and Playwright-style role selectors
   * @param selector CSS selector or role-based selector to highlight
   */
  async highlightElement(selector: string): Promise<{ success: boolean; error?: string }> {
    if (!this.page) {
      return { success: false, error: '브라우저가 초기화되지 않았습니다.' };
    }

    try {
      // Clear existing highlights first
      await this.clearHighlight();

      // Try to find element using Playwright locator first (supports role, text, etc.)
      let boundingBox: { x: number; y: number; width: number; height: number } | null = null;
      let displaySelector = selector;

      // Check if selector looks like a role-based selector
      const roleMatch = selector.match(/\[role="([^"]+)"\]\[aria-label="([^"]+)"\]/);
      if (roleMatch) {
        // Use Playwright's getByRole
        const [, role, name] = roleMatch;
        try {
          const locator = this.page.getByRole(role as any, { name });
          boundingBox = await locator.boundingBox({ timeout: 3000 });
          displaySelector = `role=${role}[name="${name}"]`;
        } catch {
          // Fall through to CSS selector
        }
      }

      // Try text-based selector
      if (!boundingBox && selector.includes('text=')) {
        const textMatch = selector.match(/text=(.+)/);
        if (textMatch) {
          try {
            const locator = this.page.getByText(textMatch[1]);
            boundingBox = await locator.boundingBox({ timeout: 3000 });
          } catch {
            // Fall through
          }
        }
      }

      // Try CSS selector via Playwright locator
      if (!boundingBox) {
        try {
          const locator = this.page.locator(selector);
          boundingBox = await locator.boundingBox({ timeout: 3000 });
        } catch {
          // Fall through to evaluate
        }
      }

      // If Playwright locator worked, inject highlight at coordinates
      if (boundingBox) {
        await this.page.evaluate(({ box, sel }) => {
          // Create highlight box
          const highlight = document.createElement('div');
          highlight.id = 'botame-highlight';
          highlight.style.cssText = `
            position: fixed;
            top: ${box.y - 3}px;
            left: ${box.x - 3}px;
            width: ${box.width + 6}px;
            height: ${box.height + 6}px;
            border: 3px solid #ff6b35;
            border-radius: 4px;
            background: rgba(255, 107, 53, 0.15);
            pointer-events: none;
            z-index: 99999;
            box-shadow: 0 0 10px rgba(255, 107, 53, 0.5);
            animation: botame-pulse 1.5s ease-in-out infinite;
          `;

          // Create label
          const label = document.createElement('div');
          label.id = 'botame-highlight-label';
          label.textContent = sel;
          label.style.cssText = `
            position: fixed;
            top: ${box.y - 30}px;
            left: ${box.x}px;
            background: #ff6b35;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-family: monospace;
            z-index: 100000;
            max-width: 300px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          `;

          // Add animation style
          let style = document.getElementById('botame-highlight-style');
          if (!style) {
            style = document.createElement('style');
            style.id = 'botame-highlight-style';
            style.textContent = '@keyframes botame-pulse { 0%, 100% { box-shadow: 0 0 10px rgba(255, 107, 53, 0.5); } 50% { box-shadow: 0 0 20px rgba(255, 107, 53, 0.8); } }';
            document.body.appendChild(style);
          }

          document.body.appendChild(highlight);
          document.body.appendChild(label);
        }, { box: boundingBox, sel: displaySelector });

        console.log(`[BrowserService] Highlighted element: ${displaySelector}`);
        return { success: true };
      }

      // Fallback: try direct CSS querySelector in browser
      await this.page.evaluate((sel) => {
        // Create highlight overlay
        const element = document.querySelector(sel);
        if (!element) {
          throw new Error(`Element not found: ${sel}`);
        }

        const rect = element.getBoundingClientRect();

        // Create highlight box
        const highlight = document.createElement('div');
        highlight.id = 'botame-highlight';
        highlight.style.cssText = `
          position: fixed;
          top: ${rect.top - 3}px;
          left: ${rect.left - 3}px;
          width: ${rect.width + 6}px;
          height: ${rect.height + 6}px;
          border: 3px solid #ff6b35;
          border-radius: 4px;
          background: rgba(255, 107, 53, 0.15);
          pointer-events: none;
          z-index: 99999;
          box-shadow: 0 0 10px rgba(255, 107, 53, 0.5);
          animation: botame-pulse 1.5s ease-in-out infinite;
        `;

        // Create label
        const label = document.createElement('div');
        label.id = 'botame-highlight-label';
        label.textContent = sel;
        label.style.cssText = `
          position: fixed;
          top: ${rect.top - 30}px;
          left: ${rect.left}px;
          background: #ff6b35;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-family: monospace;
          z-index: 100000;
          max-width: 300px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        `;

        // Add animation style
        const style = document.createElement('style');
        style.id = 'botame-highlight-style';
        style.textContent = `
          @keyframes botame-pulse {
            0%, 100% { box-shadow: 0 0 10px rgba(255, 107, 53, 0.5); }
            50% { box-shadow: 0 0 20px rgba(255, 107, 53, 0.8); }
          }
        `;

        document.body.appendChild(style);
        document.body.appendChild(highlight);
        document.body.appendChild(label);

        // Scroll element into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, selector);

      console.log(`[BrowserService] Highlighted element: ${selector}`);
      return { success: true };
    } catch (error) {
      console.error('[BrowserService] Highlight error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '하이라이트 실패',
      };
    }
  }

  /**
   * Clear all highlights from the browser
   */
  async clearHighlight(): Promise<{ success: boolean; error?: string }> {
    if (!this.page) {
      return { success: false, error: '브라우저가 초기화되지 않았습니다.' };
    }

    try {
      await this.page.evaluate(() => {
        const highlight = document.getElementById('botame-highlight');
        const label = document.getElementById('botame-highlight-label');
        const style = document.getElementById('botame-highlight-style');

        highlight?.remove();
        label?.remove();
        style?.remove();
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '하이라이트 제거 실패',
      };
    }
  }

  /**
   * Cleanup browser resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.page && !this.page.isClosed()) {
        await this.page.close().catch(() => {});
      }
      if (this.context) {
        await this.context.close().catch(() => {});
      }
      if (this.browser) {
        await this.browser.close().catch(() => {});
      }
    } catch (error) {
      console.error('[BrowserService] Cleanup error:', error);
    }

    this.page = null;
    this.context = null;
    this.browser = null;
    this.isInitialized = false;
  }
}
