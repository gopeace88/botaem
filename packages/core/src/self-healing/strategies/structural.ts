/**
 * StructuralStrategy - v4 Enhanced Self-Healing
 *
 * 녹화 시 저장된 확장 정보를 활용한 구조적 매칭:
 * - textSelectors: 텍스트 기반 셀렉터
 * - parentChainSelectors: 부모 체인 셀렉터
 * - nearbyLabelSelectors: 근처 라벨 셀렉터
 * - textPatterns: 텍스트 패턴 변형
 * - structuralPosition: 구조적 위치 (nthChild, formElementIndex 등)
 *
 * 기존 self-healing.ts의 tryEnhancedFallbacks() 로직
 */

import type { SemanticStepV4 } from '../../types/execution';
import type {
  HealingResult,
  HealMethodV4,
  TextPatterns,
  StructuralPosition,
} from '../../types/healing';
import { BaseStrategy } from './base';

export class StructuralStrategy extends BaseStrategy {
  readonly name = 'structural' as const;
  readonly priority = 4;

  canHandle(step: SemanticStepV4): boolean {
    return !!(step.enhancedFallbacks || step.structuralPosition || step.textPatterns);
  }

  async find(step: SemanticStepV4): Promise<HealingResult> {
    const isInputAction = step.action === 'type' || step.action === 'select';

    if (!isInputAction && step.enhancedFallbacks?.textSelectors) {
      for (const textSel of step.enhancedFallbacks.textSelectors) {
        const result = await this.trySelector(textSel.selector, 'text');
        if (result.success) return result;
      }
    }

    if (step.enhancedFallbacks?.parentChainSelectors) {
      for (const parentSel of step.enhancedFallbacks.parentChainSelectors) {
        const result = await this.trySelector(parentSel.fullSelector, 'parentChain');
        if (result.success) {
          if (isInputAction) {
            const isEditable = await this.checkEditable(parentSel.fullSelector);
            if (!isEditable) continue;
          }
          return result;
        }
      }
    }

    if (step.enhancedFallbacks?.nearbyLabelSelectors) {
      for (const labelSel of step.enhancedFallbacks.nearbyLabelSelectors) {
        const result = await this.trySelector(labelSel.targetSelector, 'nearbyLabel');
        if (result.success) {
          if (isInputAction) {
            const isEditable = await this.checkEditable(labelSel.targetSelector);
            if (!isEditable) continue;
          }
          return result;
        }
      }
    }

    if (!isInputAction && step.textPatterns) {
      const patternResult = await this.tryTextPatternVariations(
        step.textPatterns,
        step.identity?.tagName || 'button'
      );
      if (patternResult.success) return patternResult;
    }

    if (step.structuralPosition) {
      const structResult = await this.tryStructuralPosition(
        step.structuralPosition,
        step.identity?.tagName || '',
        isInputAction
      );
      if (structResult.success) return structResult;
    }

    return this.createResult(false, undefined, 'All v4 enhanced fallbacks failed');
  }

  private async trySelector(selector: string, _method: HealMethodV4): Promise<HealingResult> {
    try {
      const locator = this.page.locator(selector);
      const count = await locator.count();

      if (count === 1) {
        return {
          success: true,
          strategy: this.name,
          selector,
        };
      } else if (count > 1) {
        console.log(`[StructuralStrategy] Multiple matches (${count}) for: ${selector.slice(0, 50)}`);
        return {
          success: true,
          strategy: this.name,
          selector,
        };
      }
    } catch {}

    return this.createResult(false);
  }

  private async checkEditable(selector: string): Promise<boolean> {
    try {
      const locator = this.page.locator(selector);
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

  private escapeText(text: string): string {
    return text.replace(/"/g, '\\"');
  }

  private async tryTextPatternVariations(
    patterns: TextPatterns,
    tagName: string
  ): Promise<HealingResult> {
    const tag = tagName.toLowerCase() || '*';

    try {
      const normalizedSelector = `${tag}:has-text("${this.escapeText(patterns.normalized)}")`;
      const result = await this.trySelector(normalizedSelector, 'textPattern');
      if (result.success) return result;
    } catch {}

    for (const variation of patterns.variations) {
      try {
        const varSelector = `${tag}:has-text("${this.escapeText(variation.value)}")`;
        const result = await this.trySelector(varSelector, 'textPattern');
        if (result.success) {
          console.log(
            `[StructuralStrategy] Text variation match: ${variation.type} = ${variation.value}`
          );
          return result;
        }
      } catch {}
    }

    for (const keyword of patterns.keywords) {
      if (keyword.length >= 2) {
        try {
          const keywordSelector = `${tag}:has-text("${this.escapeText(keyword)}")`;
          const result = await this.trySelector(keywordSelector, 'textPattern');
          if (result.success) {
            console.log(`[StructuralStrategy] Keyword match: ${keyword}`);
            return result;
          }
        } catch {}
      }
    }

    return this.createResult(false);
  }

  private async tryStructuralPosition(
    position: StructuralPosition,
    tagName: string,
    isInputAction: boolean
  ): Promise<HealingResult> {
    const tag = tagName.toLowerCase() || '*';

    if (isInputAction && position.formElementIndex !== undefined) {
      const idx = position.formElementIndex;
      try {
        const formSelector = `form input:nth-of-type(${idx}), form textarea:nth-of-type(${idx}), form select:nth-of-type(${idx})`;
        const result = await this.trySelector(formSelector, 'structural');
        if (result.success) {
          const isEditable = await this.checkEditable(formSelector);
          if (isEditable) return result;
        }
      } catch {}
    }

    for (const parent of position.parentChain) {
      if (parent.selector && (parent.id || parent.isLandmark || parent.isForm)) {
        try {
          const structSelector = `${parent.selector} >> ${tag}:nth-of-type(${position.nthOfType})`;
          const result = await this.trySelector(structSelector, 'structural');
          if (result.success) {
            if (isInputAction) {
              const isEditable = await this.checkEditable(structSelector);
              if (!isEditable) continue;
            }
            return result;
          }
        } catch {}
      }
    }

    if (position.siblingInfo.prevSiblingText) {
      try {
        const siblingSelector = `*:has-text("${this.escapeText(position.siblingInfo.prevSiblingText)}") + ${tag}`;
        const result = await this.trySelector(siblingSelector, 'structural');
        if (result.success) {
          if (isInputAction) {
            const isEditable = await this.checkEditable(siblingSelector);
            if (!isEditable) {
              const inputAfterSibling = `*:has-text("${this.escapeText(position.siblingInfo.prevSiblingText)}") ~ input, *:has-text("${this.escapeText(position.siblingInfo.prevSiblingText)}") ~ textarea`;
              const inputResult = await this.trySelector(inputAfterSibling, 'structural');
              if (inputResult.success) return inputResult;
            }
          }
          return result;
        }
      } catch {}
    }

    return this.createResult(false);
  }
}
