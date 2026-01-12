/**
 * FallbackStrategy - v2 SmartSelector fallbacks 순차 시도
 * 기존 self-healing.ts의 2단계: Fallback 선택자들 순차 시도 로직
 */

import type { Locator } from 'playwright';
import type { SemanticStepV4 } from '../../types/execution';
import type { HealingResult, HealingRecord } from '../../types/healing';
import type { SelectorWithScore } from '../../types/playbook';
import { BaseStrategy } from './base';

export class FallbackStrategy extends BaseStrategy {
  readonly name = 'fallback' as const;
  readonly priority = 3;

  canHandle(step: SemanticStepV4): boolean {
    return !!(step.smartSelector?.fallbacks && step.smartSelector.fallbacks.length > 0);
  }

  async find(step: SemanticStepV4): Promise<HealingResult> {
    if (!step.smartSelector?.fallbacks?.length) {
      return this.createResult(false, undefined, 'No fallbacks in step');
    }

    const { primary, fallbacks } = step.smartSelector;
    const isInputAction = step.action === 'type' || step.action === 'select';
    const forbiddenStrategiesForInput = ['label', 'text', 'role'];

    const filteredFallbacks = fallbacks.filter((fb) => {
      if (isInputAction && forbiddenStrategiesForInput.includes(fb.strategy)) {
        console.log(`[FallbackStrategy] Skipping ${fb.strategy} for ${step.action}: ${fb.value}`);
        return false;
      }
      return true;
    });

    for (const fallback of filteredFallbacks) {
      try {
        const locator = this.createLocatorFromSelector(fallback);
        const count = await locator.count();

        if (count === 1) {
          const healingRecord: HealingRecord = {
            timestamp: Date.now(),
            originalSelector: primary.value,
            healedSelector: fallback.value,
            strategy: fallback.strategy,
            success: true,
          };

          console.log(
            `[FallbackStrategy] Healed with fallback: ${fallback.strategy} = ${fallback.value}`
          );

          return {
            success: true,
            strategy: this.name,
            selector: fallback.value,
            record: healingRecord,
          };
        } else if (count > 1) {
          console.log(
            `[FallbackStrategy] Multiple elements (${count}) for: ${fallback.value}, using first`
          );
          return {
            success: true,
            strategy: this.name,
            selector: fallback.value,
            record: {
              timestamp: Date.now(),
              originalSelector: primary.value,
              healedSelector: fallback.value,
              strategy: fallback.strategy,
              success: true,
            },
          };
        }
      } catch (error) {
        console.log(`[FallbackStrategy] Selector failed: ${fallback.value}`);
      }
    }

    return this.createResult(false, undefined, 'All fallback selectors failed');
  }

  private createLocatorFromSelector(selector: SelectorWithScore): Locator {
    switch (selector.strategy) {
      case 'css':
        return this.page.locator(selector.value);
      case 'xpath':
        return this.page.locator(`xpath=${selector.value}`);
      case 'text':
        if (selector.value.includes(':has-text(') || selector.value.includes(':text(')) {
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
        return this.page.getByRole(selector.value as Parameters<typeof this.page.getByRole>[0]);
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
