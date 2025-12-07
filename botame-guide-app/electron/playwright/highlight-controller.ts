import { Page } from 'playwright';
import { HighlightOptions, HighlightStyle, ActionResult } from './types';

const DEFAULT_STYLE: HighlightStyle = {
  color: '#FF6B35',
  backgroundColor: 'rgba(255, 107, 53, 0.1)',
  borderWidth: 3,
  pulse: true,
  arrow: true,
};

const HIGHLIGHT_CSS = `
  .botame-highlight {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 99999;
  }

  .botame-highlight-box {
    position: absolute;
    border-style: solid;
    border-radius: 4px;
    pointer-events: none;
    box-sizing: border-box;
  }

  .botame-highlight-box.pulse {
    animation: botame-pulse 1.5s ease-in-out infinite;
  }

  @keyframes botame-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.7; transform: scale(1.02); }
  }

  .botame-highlight-message {
    position: absolute;
    padding: 8px 16px;
    border-radius: 6px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    font-weight: 500;
    color: white;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    pointer-events: none;
  }

  .botame-highlight-arrow {
    position: absolute;
    width: 0;
    height: 0;
    border-style: solid;
  }
`;

/**
 * HighlightController - Manages UI highlight overlays
 */
export class HighlightController {
  private styleInjected = false;

  constructor(private page: Page) {}

  /**
   * Highlight an element with optional message
   */
  async highlight(options: HighlightOptions): Promise<ActionResult> {
    try {
      await this.ensureStyleInjected();

      const { selector, message, position = 'auto', style = {} } = options;
      const mergedStyle = { ...DEFAULT_STYLE, ...style };

      // Get element position
      const elementInfo = await this.page.evaluate((sel) => {
        const element = document.querySelector(sel);
        if (!element) return null;

        const rect = element.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          windowWidth: window.innerWidth,
          windowHeight: window.innerHeight,
        };
      }, selector);

      if (!elementInfo) {
        return {
          success: false,
          error: new Error(`Element not found: ${selector}`),
        };
      }

      // Create highlight
      await this.page.evaluate(
        ({ info, message, style }) => {
          // Remove existing highlights
          document.querySelectorAll('.botame-highlight').forEach((el) => el.remove());

          // Create container
          const container = document.createElement('div');
          container.className = 'botame-highlight';

          // Create highlight box
          const box = document.createElement('div');
          box.className = `botame-highlight-box ${style.pulse ? 'pulse' : ''}`;
          box.style.cssText = `
            left: ${info.x - 4}px;
            top: ${info.y - 4}px;
            width: ${info.width + 8}px;
            height: ${info.height + 8}px;
            border-color: ${style.color};
            border-width: ${style.borderWidth}px;
            background-color: ${style.backgroundColor};
          `;
          container.appendChild(box);

          // Create message if provided
          if (message) {
            const msgEl = document.createElement('div');
            msgEl.className = 'botame-highlight-message';
            msgEl.textContent = message;
            msgEl.style.backgroundColor = style.color;

            // Position calculation - default below the element
            let msgX = info.x;
            let msgY = info.y + info.height + 12;

            // If message would go below viewport, position above
            if (msgY + 40 > info.windowHeight) {
              msgY = info.y - 44;
            }

            // Keep within horizontal bounds
            if (msgX + 200 > info.windowWidth) {
              msgX = info.windowWidth - 210;
            }

            msgEl.style.left = `${msgX}px`;
            msgEl.style.top = `${msgY}px`;

            container.appendChild(msgEl);
          }

          document.body.appendChild(container);
        },
        { info: elementInfo, message, style: mergedStyle }
      );

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
      };
    }
  }

  /**
   * Highlight element and wait for user to click it
   */
  async highlightAndWait(options: HighlightOptions): Promise<ActionResult> {
    const highlightResult = await this.highlight(options);
    if (!highlightResult.success) {
      return highlightResult;
    }

    try {
      // Wait for user to click the highlighted element
      await this.page.click(options.selector, {
        timeout: options.duration ?? 60000,
      });

      await this.clearHighlight();

      return { success: true };
    } catch (error) {
      await this.clearHighlight();
      return {
        success: false,
        error: error as Error,
      };
    }
  }

  /**
   * Remove all highlights from the page
   */
  async clearHighlight(): Promise<void> {
    await this.page.evaluate(() => {
      document.querySelectorAll('.botame-highlight').forEach((el) => el.remove());
    });
  }

  /**
   * Inject CSS styles into the page
   */
  private async ensureStyleInjected(): Promise<void> {
    if (this.styleInjected) return;

    await this.page.addStyleTag({ content: HIGHLIGHT_CSS });
    this.styleInjected = true;
  }
}
