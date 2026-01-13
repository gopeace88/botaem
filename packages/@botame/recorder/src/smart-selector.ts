/**
 * Smart Selector Generator
 * Extracted from RecordingService and Refactored for Monorepo
 * @module @botame/recorder/smart-selector
 */

import {
  SelectorInfo,
  ElementSnapshot,
  SmartSelector,
  SelectorWithScore
} from "@botame/types";

declare var require: any;

// Node.js environment check
const crypto = typeof require !== 'undefined' ? require('crypto') : {
  createHash: () => ({ update: () => ({ digest: () => 'mock-hash' }) })
};

export interface ElementData {
  tagName: string;
  id?: string;
  className?: string;
  text?: string;
  placeholder?: string;
  type?: string;
  role?: string;
  ariaLabel?: string;
  name?: string;
  dataTestId?: string;
}

/**
 * Legacy compatibility function
 * Wraps SmartSelectorGenerator to provide SelectorInfo[]
 */
export function generateSelectors(element: ElementData): SelectorInfo[] {
  const generator = new SmartSelectorGenerator();
  const mockSnapshot: ElementSnapshot = {
    nodeId: 0,
    backendNodeId: 0,
    tagName: element.tagName,
    attributes: {
      id: element.id || '',
      class: element.className || '',
      name: element.name || '',
      type: element.type || '',
      placeholder: element.placeholder || '',
      'aria-label': element.ariaLabel || '',
      'data-testid': element.dataTestId || '',
    },
    textContent: element.text,
    boundingBox: { x: 0, y: 0, width: 0, height: 0 },
    isVisible: true,
    isInViewport: true,
    xpath: '',
    cssPath: ''
  };

  const result = generator.generateFromSnapshot(mockSnapshot);

  const selectors: SelectorInfo[] = [];

  if (result.primary) {
    selectors.push({
      strategy: result.primary.strategy,
      value: result.primary.value,
      priority: 0
    });
  }

  result.fallbacks.forEach((f, index) => {
    selectors.push({
      strategy: f.strategy,
      value: f.value,
      priority: index + 1
    });
  });

  return selectors;
}

export class SmartSelectorGenerator {

  /**
   * 요소 스냅샷에서 스마트 셀렉터 생성
   */
  generateFromSnapshot(element: ElementSnapshot): SmartSelector {
    const selectors = this.generateAllSelectors(element);

    // 신뢰도 순으로 정렬
    selectors.sort((a, b) => b.confidence - a.confidence);

    const [primary, ...fallbacks] = selectors;

    return {
      primary: primary || { strategy: 'css', value: element.tagName.toLowerCase(), confidence: 10 },
      fallbacks,
      coordinates: element.boundingBox,
      elementHash: this.generateElementHash(element),
      snapshot: element,
    };
  }

  /**
   * 모든 가능한 선택자 생성
   */
  private generateAllSelectors(element: ElementSnapshot): SelectorWithScore[] {
    const selectors: SelectorWithScore[] = [];
    const attrs = element.attributes || {};
    const isInputElement = this.isInputElement(element.tagName);

    // 1. data-testid (가장 안정적)
    if (attrs['data-testid']) {
      selectors.push({
        strategy: 'testId',
        value: attrs['data-testid'],
        confidence: 95,
      });
    }

    // 2. name 속성 (폼 요소)
    if (attrs['name'] && this.isFormElement(element.tagName)) {
      selectors.push({
        strategy: 'css',
        value: `${element.tagName.toLowerCase()}[name="${attrs['name']}"]`,
        confidence: isInputElement ? 95 : 80,
      });
    }

    // 3. 타입 속성 (input)
    if (element.tagName.toUpperCase() === 'INPUT' && attrs['type']) {
      const type = attrs['type'];
      const uniqueTypes = ['password', 'email', 'tel', 'search', 'url', 'number', 'date', 'file'];
      const confidence = uniqueTypes.includes(type) ? 90 : 50;
      selectors.push({
        strategy: 'css',
        value: `input[type="${type}"]`,
        confidence,
      });
    }

    // 3.5. aria-label
    if (attrs['aria-label'] && isInputElement) {
      const tagName = element.tagName.toLowerCase();
      selectors.push({
        strategy: 'css',
        value: `${tagName}[aria-label="${attrs['aria-label']}"]`,
        confidence: 88,
      });
    }

    // 4. ID (동적 ID 감지)
    if (attrs['id']) {
      const isStable = this.isStableId(attrs['id']);
      if (isStable) {
        selectors.push({
          strategy: 'css',
          value: `#${attrs['id']}`,
          confidence: 85,
        });
      }
    }

    // 5. placeholder
    if (attrs['placeholder'] && isInputElement) {
      selectors.push({
        strategy: 'placeholder',
        value: attrs['placeholder'],
        confidence: 80,
      });
    }

    // === INPUT 외 요소 ===
    if (!isInputElement) {
      // 6. ARIA 레이블
      if (attrs['aria-label']) {
        selectors.push({
          strategy: 'label',
          value: attrs['aria-label'],
          confidence: 75,
        });
      }

      // 7. Role + 이름
      if (element.role && element.name) {
        selectors.push({
          strategy: 'role',
          value: `${element.role}[name="${element.name}"]`,
          confidence: 70,
        });
      }

      // 8. 텍스트 내용
      if (element.textContent && this.isTextBasedElement(element.tagName)) {
        const text = element.textContent.trim().slice(0, 50);
        if (text && text.length > 1) {
          selectors.push({
            strategy: 'text',
            value: `text=${text}`,
            confidence: 65,
          });
        }
      }
    }

    // 9. CSS 클래스 조합
    if (attrs['class']) {
      const stableClasses = this.extractStableClasses(attrs['class']);
      if (stableClasses.length > 0) {
        const cssSelector = `${element.tagName.toLowerCase()}.${stableClasses.join('.')}`;
        selectors.push({
          strategy: 'css',
          value: cssSelector,
          confidence: 45,
        });
      }
    }

    // 10. Parent Chain (CSS Path 분석)
    const parentSelectors = this.generateParentChainSelectors(element);
    selectors.push(...parentSelectors);

    // 11. XPath
    if (element.xpath) {
      selectors.push({
        strategy: 'xpath',
        value: element.xpath,
        confidence: 30,
      });
    }

    // 12. 전체 CSS 경로
    if (element.cssPath) {
      selectors.push({
        strategy: 'css',
        value: element.cssPath,
        confidence: 20,
      });
    }

    return selectors;
  }

  /**
   * 부모 체인 선택자 생성
   */
  private generateParentChainSelectors(element: ElementSnapshot): SelectorWithScore[] {
    const selectors: SelectorWithScore[] = [];

    if (!element.cssPath) return selectors;

    const parts = element.cssPath.split(' > ');
    if (parts.length < 2) return selectors;

    // 현재 요소 자신을 제외
    const mySelector = parts.pop()!;

    // 부모들 중에서 ID가 있는 가장 가까운 부모 찾기
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      if (part.includes('#')) {
        const idMatch = part.match(/#([^.]+)/);
        if (idMatch && this.isStableId(idMatch[1])) {
          const parentId = idMatch[1];

          // 1. Direct descendant
          selectors.push({
            strategy: 'css',
            value: `#${parentId} ${mySelector}`,
            confidence: 60,
          });

          // 2. Class combination
          if (element.attributes && element.attributes['class']) {
            const stableClasses = this.extractStableClasses(element.attributes['class']);
            if (stableClasses.length > 0) {
              selectors.push({
                strategy: 'css',
                value: `#${parentId} .${stableClasses.join('.')}`,
                confidence: 62,
              });
            }
          }
          break;
        }
      }
    }

    return selectors;
  }

  private isInputElement(tagName: string): boolean {
    return ['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName.toUpperCase());
  }

  private isStableId(id: string): boolean {
    if (!id) return false;
    const dynamicPatterns = [
      /^[a-f0-9]{8}-[a-f0-9]{4}/i,
      /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}/i,
      /^\d+$/,
      /^\d{10,}/,
      /_\d+$/,
      /-\d+$/,
      /^react-/i,
      /^ember/i,
      /^ng-/i,
      /^:r[0-9a-z]+:/i,
      /^pt-/i,
      /^uuid-/i,
      /^ext-gen/i,
      /^yui-gen/i,
      /^closure-lm/i,
      /\//,
      /\./,
    ];
    return !dynamicPatterns.some(pattern => pattern.test(id));
  }

  private extractStableClasses(classString: string): string[] {
    const classes = classString.split(/\s+/).filter(c => c.trim());
    const ignoredPatterns = [
      /^css-[a-z0-9]+$/i,
      /^sc-[a-z]+$/i,
      /^_[a-z0-9]{5,}$/i,
      /^emotion-/i,
      /--[a-z0-9]{6,}$/i,
      /^(p|m)(t|b|l|r|x|y)?-\d+/,
      /^w-\d+|w-full|w-screen/,
      /^h-\d+|h-full|h-screen/,
      /^flex/, /^grid/,
      /^items-/, /^justify-/,
      /^text-(xs|sm|base|lg|xl)/,
      /^text-(left|center|right)/,
      /^bg-(red|blue|green|gray|white|black)/,
      /^absolute|relative|fixed/,
      /^hidden|block|inline/,
      /^border/, /^rounded/,
      /^hover:/, /^focus:/,
      /^d-/,
      /^col-/, /^row-/,
    ];

    return classes
      .filter(c => !ignoredPatterns.some(p => p.test(c)))
      .filter(c => c.length > 2 && c.length < 40)
      .slice(0, 2);
  }

  private isFormElement(tagName: string): boolean {
    return ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(tagName.toUpperCase());
  }

  private isTextBasedElement(tagName: string): boolean {
    return ['BUTTON', 'A', 'SPAN', 'DIV', 'LABEL', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']
      .includes(tagName.toUpperCase());
  }

  private generateElementHash(element: ElementSnapshot): string {
    const hashSource = [
      element.tagName,
      element.attributes['id'] || '',
      element.attributes['class'] || '',
      element.attributes['name'] || '',
      element.textContent?.slice(0, 20) || '',
      element.role || '',
    ].join('|');

    return crypto.createHash('md5').update(hashSource).digest('hex').slice(0, 8);
  }

  calculateSimilarity(a: SmartSelector, b: SmartSelector): number {
    let score = 0;
    if (a.elementHash === b.elementHash) score += 50;
    const dx = Math.abs(a.coordinates.x - b.coordinates.x);
    const dy = Math.abs(a.coordinates.y - b.coordinates.y);
    if (dx < 100 && dy < 100) {
      score += 30 * (1 - (dx + dy) / 200);
    }
    if (a.primary.value === b.primary.value) score += 20;
    return Math.min(100, score);
  }
}
