/**
 * CoordinatesStrategy - 좌표 기반 요소 탐색 (최후의 수단)
 * 기존 self-healing.ts의 tryCoordinates() 로직
 */

import type { SemanticStepV4 } from '../../types/execution';
import type { HealingResult } from '../../types/healing';
import type { BoundingBox } from '../../types/selector';
import { BaseStrategy } from './base';

export class CoordinatesStrategy extends BaseStrategy {
  readonly name = 'coordinates' as const;
  readonly priority = 5;

  canHandle(step: SemanticStepV4): boolean {
    const coords = step.smartSelector?.coordinates || step.identity?.boundingBox;
    return !!coords && this.isValidBoundingBox(coords);
  }

  async find(step: SemanticStepV4): Promise<HealingResult> {
    const coords = step.smartSelector?.coordinates || step.identity?.boundingBox;

    if (!coords || !this.isValidBoundingBox(coords)) {
      return this.createResult(false, undefined, 'No valid coordinates');
    }

    try {
      const centerX = coords.x + coords.width / 2;
      const centerY = coords.y + coords.height / 2;

      const elementAtPoint = await this.page.evaluate(
        ({ x, y }) => {
          const el = document.elementFromPoint(x, y);
          if (!el) return null;

          const rect = el.getBoundingClientRect();
          return {
            tagName: el.tagName,
            isVisible: rect.width > 0 && rect.height > 0,
            isInteractive:
              el.tagName === 'BUTTON' ||
              el.tagName === 'A' ||
              el.tagName === 'INPUT' ||
              el.tagName === 'SELECT' ||
              el.tagName === 'TEXTAREA' ||
              el.getAttribute('role') === 'button' ||
              el.getAttribute('onclick') !== null ||
              window.getComputedStyle(el).cursor === 'pointer',
          };
        },
        { x: centerX, y: centerY }
      );

      if (elementAtPoint && elementAtPoint.isVisible) {
        const selector = `coordinates(${Math.round(centerX)}, ${Math.round(centerY)})`;
        return this.createResult(true, selector);
      }
    } catch (error) {
      console.error('[CoordinatesStrategy] Check failed:', error);
    }

    return this.createResult(false, undefined, 'No element at coordinates');
  }

  private isValidBoundingBox(box: BoundingBox): boolean {
    return box.width > 0 && box.height > 0 && box.x >= 0 && box.y >= 0;
  }

  async clickAtCoordinates(coords: BoundingBox): Promise<void> {
    const centerX = coords.x + coords.width / 2;
    const centerY = coords.y + coords.height / 2;
    await this.page.mouse.click(centerX, centerY);
  }
}
