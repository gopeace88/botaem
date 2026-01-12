/**
 * IdentityStrategy - v3 ElementIdentity 기반 매칭
 *
 * Accessibility-First 접근: role + name → aria-label → name → ...
 * 기존 self-healing.ts의 findByIdentity() 로직 모듈화
 */

import type { Page, Locator } from 'playwright';
import type { SemanticStepV4 } from '../../types/execution';
import type { HealingResult } from '../../types/healing';
import type { ElementIdentity, MatchingStrategy } from '../../types/selector';
import { BaseStrategy } from './base';

interface IdentityMatchAttempt {
  strategy: MatchingStrategy;
  tryMatch: () => Promise<Locator | null>;
  skipForInput?: boolean;
}

export class IdentityStrategy extends BaseStrategy {
  readonly name = 'identity' as const;
  readonly priority = 1; // 최우선

  canHandle(step: SemanticStepV4): boolean {
    return !!step.identity;
  }

  async find(step: SemanticStepV4): Promise<HealingResult> {
    if (!step.identity) {
      return this.createResult(false, undefined, 'No identity in step');
    }

    const identity = step.identity;
    const isInputAction = step.action === 'type' || step.action === 'select';

    const attempts = this.buildMatchAttempts(identity, isInputAction);

    for (const { strategy, tryMatch, skipForInput } of attempts) {
      if (skipForInput) {
        console.log(`[IdentityStrategy] Skipping ${strategy} for input action`);
        continue;
      }

      try {
        const locator = await tryMatch();
        if (locator) {
          if (isInputAction) {
            const isEditable = await this.isEditableElement(locator);
            if (!isEditable) {
              console.log(`[IdentityStrategy] ${strategy} found non-editable element, skipping`);
              continue;
            }
          }

          const selector = await this.extractSelector(locator, strategy, identity);
          return this.createResult(true, selector);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : '';
        if (!msg.includes('context was destroyed')) {
          console.log(`[IdentityStrategy] ${strategy} error:`, msg);
        }
      }
    }

    return this.createResult(false, undefined, 'All identity strategies failed');
  }

  private buildMatchAttempts(
    identity: ElementIdentity,
    isInputAction: boolean
  ): IdentityMatchAttempt[] {
    return [
      // 1순위: Playwright getByRole (가장 안정적)
      {
        strategy: 'accessibility',
        tryMatch: async () => {
          if (!identity.axRole || !identity.axName) return null;
          const locator = this.page.getByRole(identity.axRole as Parameters<Page['getByRole']>[0], {
            name: identity.axName,
          });
          return (await this.validateLocator(locator)) ? locator : null;
        },
        skipForInput: isInputAction && ['tab', 'button', 'link'].includes(identity.axRole || ''),
      },
      // 2순위: aria-label 정확 매칭
      {
        strategy: 'ariaLabel',
        tryMatch: async () => {
          if (!identity.ariaLabel) return null;
          const selector = `[aria-label="${this.escapeAttr(identity.ariaLabel)}"]`;
          const locator = this.page.locator(selector);
          return (await this.validateLocator(locator)) ? locator : null;
        },
      },
      // 3순위: name 속성 (form elements)
      {
        strategy: 'name',
        tryMatch: async () => {
          if (!identity.name) return null;
          const selector = `${identity.tagName.toLowerCase()}[name="${this.escapeAttr(identity.name)}"]`;
          const locator = this.page.locator(selector);
          return (await this.validateLocator(locator)) ? locator : null;
        },
      },
      // 4순위: data-testid
      {
        strategy: 'testId',
        tryMatch: async () => {
          if (!identity.dataTestId) return null;
          const locator = this.page.getByTestId(identity.dataTestId);
          return (await this.validateLocator(locator)) ? locator : null;
        },
      },
      // 5순위: placeholder
      {
        strategy: 'placeholder',
        tryMatch: async () => {
          if (!identity.placeholder) return null;
          const locator = this.page.getByPlaceholder(identity.placeholder);
          return (await this.validateLocator(locator)) ? locator : null;
        },
      },
      // 6순위: type 속성 (고유한 타입만)
      {
        strategy: 'css',
        tryMatch: async () => {
          if (identity.tagName.toLowerCase() !== 'input' || !identity.type) return null;
          const uniqueTypes = ['password', 'email', 'tel', 'search', 'file'];
          if (!uniqueTypes.includes(identity.type)) return null;
          const locator = this.page.locator(`input[type="${identity.type}"]`);
          return (await this.validateLocator(locator)) ? locator : null;
        },
      },
      // 7순위: 안정적인 ID
      {
        strategy: 'css',
        tryMatch: async () => {
          if (!identity.id) return null;
          const locator = this.page.locator(`#${identity.id}`);
          return (await this.validateLocator(locator)) ? locator : null;
        },
      },
      // 8순위: 텍스트 매칭 (INPUT 액션에서는 건너뜀)
      {
        strategy: 'text',
        tryMatch: async () => {
          if (!identity.textContent || identity.textContent.length < 2) return null;
          const locator = this.page.locator(
            `${identity.tagName.toLowerCase()}:has-text("${this.escapeText(identity.textContent)}")`
          );
          return (await this.validateLocator(locator)) ? locator : null;
        },
        skipForInput: isInputAction,
      },
    ];
  }

  private async validateLocator(locator: Locator): Promise<boolean> {
    try {
      const count = await locator.count();
      return count === 1;
    } catch {
      return false;
    }
  }

  private async isEditableElement(locator: Locator): Promise<boolean> {
    try {
      return await locator.evaluate((el) => {
        const tagName = el.tagName.toUpperCase();
        return (
          tagName === 'INPUT' ||
          tagName === 'TEXTAREA' ||
          tagName === 'SELECT' ||
          el.getAttribute('contenteditable') === 'true'
        );
      });
    } catch {
      return false;
    }
  }

  private escapeAttr(value: string): string {
    return value.replace(/"/g, '\\"').replace(/'/g, "\\'");
  }

  private escapeText(text: string): string {
    return text.replace(/"/g, '\\"');
  }

  private async extractSelector(
    locator: Locator,
    strategy: MatchingStrategy,
    identity: ElementIdentity
  ): Promise<string> {
    switch (strategy) {
      case 'accessibility':
        return `role=${identity.axRole}[name="${identity.axName}"]`;
      case 'ariaLabel':
        return `[aria-label="${identity.ariaLabel}"]`;
      case 'name':
        return `${identity.tagName.toLowerCase()}[name="${identity.name}"]`;
      case 'testId':
        return `[data-testid="${identity.dataTestId}"]`;
      case 'placeholder':
        return `[placeholder="${identity.placeholder}"]`;
      case 'text':
        return `${identity.tagName.toLowerCase()}:has-text("${identity.textContent}")`;
      case 'css':
        if (identity.id) return `#${identity.id}`;
        if (identity.type) return `input[type="${identity.type}"]`;
        return await this.locatorToCssSelector(locator);
      default:
        return await this.locatorToCssSelector(locator);
    }
  }

  private async locatorToCssSelector(locator: Locator): Promise<string> {
    try {
      const element = await locator.elementHandle();
      if (!element) return '';

      return await element.evaluate((el) => {
        if (el.id) return `#${el.id}`;
        if (el.className && typeof el.className === 'string') {
          const classes = el.className
            .split(' ')
            .filter((c: string) => c.trim())
            .slice(0, 2);
          if (classes.length) return `${el.tagName.toLowerCase()}.${classes.join('.')}`;
        }
        return el.tagName.toLowerCase();
      });
    } catch {
      return '';
    }
  }
}
