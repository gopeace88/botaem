/**
 * PlaywrightLocatorStrategy - Playwright 내장 로케이터 메서드 사용
 *
 * getByLabel, getByText, getByTestId, getByPlaceholder 등
 * 기존 self-healing.ts의 createLocator() 로직 기반
 */

import type { Locator } from 'playwright';
import type { SemanticStepV4 } from '../../types/execution';
import type { HealingResult } from '../../types/healing';
import type { SelectorWithScore } from '../../types/playbook';
import { BaseStrategy } from './base';

export class PlaywrightLocatorStrategy extends BaseStrategy {
  readonly name = 'playwright' as const;
  readonly priority = 2;

  canHandle(step: SemanticStepV4): boolean {
    return !!step.smartSelector?.primary;
  }

  async find(step: SemanticStepV4): Promise<HealingResult> {
    if (!step.smartSelector) {
      return this.createResult(false, undefined, 'No smartSelector in step');
    }

    const { primary } = step.smartSelector;
    const isInputAction = step.action === 'type' || step.action === 'select';
    const forbiddenStrategiesForInput = ['label', 'text', 'role'];

    if (isInputAction && forbiddenStrategiesForInput.includes(primary.strategy)) {
      console.log(
        `[PlaywrightStrategy] Skipping ${primary.strategy} for ${step.action}: ${primary.value}`
      );
      return this.createResult(false, undefined, 'Strategy not suitable for input action');
    }

    try {
      const locator = this.createLocatorFromSelector(primary);
      const count = await locator.count();

      if (count === 1) {
        return this.createResult(true, primary.value);
      } else if (count > 1) {
        console.log(`[PlaywrightStrategy] Multiple elements (${count}) for: ${primary.value}`);
        return this.createResult(true, primary.value);
      }
    } catch (error) {
      console.log(`[PlaywrightStrategy] Primary selector failed: ${primary.value}`);
    }

    return this.createResult(false, undefined, 'Primary selector not found');
  }

  createLocatorFromSelector(selector: SelectorWithScore): Locator {
    switch (selector.strategy) {
      case 'css':
        return this.page.locator(selector.value);
      case 'xpath':
        return this.page.locator(`xpath=${selector.value}`);
      case 'text':
        if (
          selector.value.includes(':has-text(') ||
          selector.value.includes(':text(')
        ) {
          return this.page.locator(selector.value);
        }
        return this.page.getByText(selector.value);
      case 'role':
        if (selector.value.startsWith('[role=')) {
          return this.page.locator(selector.value);
        }
        const roleMatch = selector.value.match(/^(\w+)\[name="(.+)"\]$/);
        if (roleMatch) {
          return this.page.getByRole(roleMatch[1] as Parameters<typeof this.page.getByRole>[0], {
            name: roleMatch[2],
          });
        }
        return this.page.getByRole(
          selector.value as Parameters<typeof this.page.getByRole>[0]
        );
      case 'testId':
        return this.page.getByTestId(selector.value);
      case 'placeholder':
        return this.page.getByPlaceholder(selector.value);
      case 'label':
        if (selector.value.includes('[aria-label')) {
          return this.page.locator(selector.value);
        }
        return this.page.getByLabel(selector.value);
      default:
        return this.page.locator(selector.value);
    }
  }
}
