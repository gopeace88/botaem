/**
 * Smart Selector Generator - 다중 선택자 체인 자동 생성
 *
 * 보탬e 특화: 한국 웹사이트에서 흔한 동적 ID, iframe 처리
 */

import {
  SmartSelector,
  SelectorWithScore,
  ElementSnapshot,
} from '../../shared/types';
import * as crypto from 'crypto';

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
   * INPUT/TEXTAREA/SELECT 요소에는 label/text/role 선택자를 생성하지 않음
   */
  private generateAllSelectors(element: ElementSnapshot): SelectorWithScore[] {
    const selectors: SelectorWithScore[] = [];
    const attrs = element.attributes;
    const isInputElement = this.isInputElement(element.tagName);

    // 1. data-testid (가장 안정적)
    if (attrs['data-testid']) {
      selectors.push({
        strategy: 'testId',
        value: attrs['data-testid'],
        confidence: 95,
      });
    }

    // 2. name 속성 (폼 요소) - INPUT에서 가장 중요
    if (attrs['name'] && this.isFormElement(element.tagName)) {
      selectors.push({
        strategy: 'css',
        value: `${element.tagName.toLowerCase()}[name="${attrs['name']}"]`,
        confidence: isInputElement ? 95 : 80,
      });
    }

    // 3. 타입 속성 (input) - password, email 등 고유한 타입
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

    // 3.5. aria-label (INPUT 요소에서 매우 유용) - CSS 선택자로 생성
    if (attrs['aria-label'] && isInputElement) {
      const tagName = element.tagName.toLowerCase();
      selectors.push({
        strategy: 'css',
        value: `${tagName}[aria-label="${attrs['aria-label']}"]`,
        confidence: 88,  // name(95) < aria-label < password type(90)
      });
    }

    // 4. ID (동적 ID 감지하여 신뢰도 조정)
    if (attrs['id']) {
      const confidence = this.isStableId(attrs['id']) ? 85 : 35;
      selectors.push({
        strategy: 'css',
        value: `#${attrs['id']}`,
        confidence,
      });
    }

    // 5. placeholder (입력 필드)
    if (attrs['placeholder'] && isInputElement) {
      selectors.push({
        strategy: 'placeholder',
        value: attrs['placeholder'],
        confidence: 80,
      });
    }

    // === INPUT 요소에는 아래 선택자들을 생성하지 않음 ===
    if (!isInputElement) {
      // 6. ARIA 레이블 (버튼, 링크에만)
      if (attrs['aria-label']) {
        selectors.push({
          strategy: 'label',
          value: attrs['aria-label'],
          confidence: 75,
        });
      }

      // 7. Role + 이름 조합 (버튼, 링크에만)
      if (element.role && element.name) {
        selectors.push({
          strategy: 'role',
          value: `${element.role}[name="${element.name}"]`,
          confidence: 70,
        });
      }

      // 8. 텍스트 내용 (버튼, 링크에만)
      if (element.textContent && this.isTextBasedElement(element.tagName)) {
        const text = element.textContent.trim().slice(0, 50);
        if (text && text.length > 1) {
          selectors.push({
            strategy: 'text',
            value: text,
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

    // 10. XPath (최후의 수단)
    if (element.xpath) {
      selectors.push({
        strategy: 'xpath',
        value: element.xpath,
        confidence: 30,
      });
    }

    // 11. 전체 CSS 경로 (가장 낮은 신뢰도)
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
   * INPUT 요소인지 확인
   */
  private isInputElement(tagName: string): boolean {
    return ['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName.toUpperCase());
  }

  /**
   * 안정적인 ID인지 확인 (동적 ID 감지)
   */
  private isStableId(id: string): boolean {
    // 동적 ID 패턴 감지
    const dynamicPatterns = [
      /^[a-f0-9]{8}-[a-f0-9]{4}/i,  // UUID
      /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}/i,  // UUID anywhere in ID
      /^\d{10,}/,                    // 타임스탬프
      /_\d+$/,                       // 숫자 접미사
      /^react-/i,                    // React 생성 ID
      /^ember/i,                     // Ember 생성 ID
      /^ng-/i,                       // Angular 생성 ID
      /^:r[0-9a-z]+:/i,             // React 18+ ID
      /^pt-/i,                       // 동적 pt- 접두사
      /^uuid-/i,                     // uuid 접두사
      /\//,                          // 슬래시 포함 (CSS 선택자에 문제)
    ];

    return !dynamicPatterns.some(pattern => pattern.test(id));
  }

  /**
   * 안정적인 클래스 추출 (동적 클래스 제외)
   */
  private extractStableClasses(classString: string): string[] {
    const classes = classString.split(/\s+/).filter(c => c.trim());

    // 동적 클래스 패턴
    const dynamicPatterns = [
      /^css-[a-z0-9]+$/i,           // CSS-in-JS
      /^sc-[a-z]+$/i,               // Styled Components
      /^_[a-z0-9]{5,}$/i,           // CSS Modules
      /^emotion-/i,                  // Emotion
      /--[a-z0-9]{6,}$/i,           // Tailwind variants
    ];

    return classes
      .filter(c => !dynamicPatterns.some(p => p.test(c)))
      .slice(0, 2);  // 최대 2개
  }

  /**
   * 폼 요소인지 확인
   */
  private isFormElement(tagName: string): boolean {
    return ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(tagName.toUpperCase());
  }

  /**
   * 텍스트 기반 요소인지 확인
   */
  private isTextBasedElement(tagName: string): boolean {
    return ['BUTTON', 'A', 'SPAN', 'DIV', 'LABEL', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']
      .includes(tagName.toUpperCase());
  }

  /**
   * 요소 해시 생성 (변경 감지용)
   */
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

  /**
   * 두 스마트 셀렉터의 유사도 계산
   */
  calculateSimilarity(a: SmartSelector, b: SmartSelector): number {
    let score = 0;

    // 해시 일치
    if (a.elementHash === b.elementHash) score += 50;

    // 좌표 근접성 (100px 이내)
    const dx = Math.abs(a.coordinates.x - b.coordinates.x);
    const dy = Math.abs(a.coordinates.y - b.coordinates.y);
    if (dx < 100 && dy < 100) {
      score += 30 * (1 - (dx + dy) / 200);
    }

    // 선택자 일치
    if (a.primary.value === b.primary.value) score += 20;

    return Math.min(100, score);
  }
}
