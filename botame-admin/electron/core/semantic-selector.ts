/**
 * Semantic Selector Generator
 *
 * 핵심 원칙: aria-label, role, name 등 시맨틱 속성을 최우선으로
 * CSS 클래스는 최후의 수단으로만 사용
 *
 * browser-use 스타일의 정확한 요소 식별을 목표로 함
 */

import { Page } from 'playwright';
import { ElementSnapshot, SelectorStrategy } from '../../shared/types';
import * as crypto from 'crypto';

export interface SelectorCandidate {
  selector: string;
  strategy: SelectorStrategy;
  confidence: number;
  isUnique: boolean;
}

export interface FallbackSelector {
  selector: string;
  strategy: SelectorStrategy;
  confidence: number;
}

export interface SemanticSelectorResult {
  selector: string;
  strategy: SelectorStrategy;
  confidence: number;
  isUnique: boolean;
  fallbacks: FallbackSelector[];
  elementHash: string;
}

export class SemanticSelectorGenerator {
  /**
   * 동적 상태 텍스트 패턴 (aria-label에서 제거할 패턴들)
   * 예: "아이디 로그인, 선택됨" -> "아이디 로그인"
   */
  private static readonly DYNAMIC_STATE_PATTERNS = [
    /, 선택됨$/,
    /, 선택되지 않음$/,
    /, 선택$/,
    /, 확장됨$/,
    /, 축소됨$/,
    /, expanded$/i,
    /, collapsed$/i,
    /, selected$/i,
    /, not selected$/i,
    /, pressed$/i,
    /, checked$/i,
    /, unchecked$/i,
    /, disabled$/i,
    /, enabled$/i,
    /, active$/i,
    /, inactive$/i,
  ];

  /**
   * aria-label에서 동적 상태 텍스트 제거
   */
  private stripDynamicState(label: string): string {
    let result = label;
    for (const pattern of SemanticSelectorGenerator.DYNAMIC_STATE_PATTERNS) {
      result = result.replace(pattern, '');
    }
    return result;
  }

  /**
   * 요소에서 가장 좋은 시맨틱 선택자 생성
   * 페이지에서 고유성을 검증하여 가장 정확한 선택자 반환
   */
  async generateBestSelector(
    element: ElementSnapshot,
    page: Page
  ): Promise<SemanticSelectorResult> {
    const candidates = this.generateAllCandidates(element);
    const elementHash = this.generateElementHash(element);

    // 각 후보의 고유성 검증 (신뢰도 높은 순서대로)
    for (const candidate of candidates) {
      try {
        const count = await this.countMatches(page, candidate.selector);
        if (count === 1) {
          candidate.isUnique = true;

          // 나머지를 fallback으로 반환
          const fallbacks = candidates
            .filter((c) => c !== candidate)
            .map((c) => ({
              selector: c.selector,
              strategy: c.strategy,
              confidence: c.confidence,
            }));

          console.log(
            `[SemanticSelector] Found unique selector: ${candidate.selector} (${candidate.strategy})`
          );

          return {
            selector: candidate.selector,
            strategy: candidate.strategy,
            confidence: candidate.confidence,
            isUnique: true,
            fallbacks,
            elementHash,
          };
        }
      } catch (error) {
        // 선택자 오류 - 다음 후보로
        console.log(
          `[SemanticSelector] Selector error: ${candidate.selector}`,
          error
        );
      }
    }

    // 고유한 선택자가 없으면 조합 시도
    const combinedResult = await this.generateCombinedSelector(
      element,
      candidates,
      page
    );
    if (combinedResult.isUnique) {
      return { ...combinedResult, elementHash };
    }

    // 최선의 단일 후보 반환 (고유하지 않더라도)
    console.log(
      `[SemanticSelector] No unique selector found, using best candidate: ${candidates[0]?.selector}`
    );

    return {
      selector: candidates[0]?.selector || this.buildTagSelector(element),
      strategy: candidates[0]?.strategy || 'css',
      confidence: candidates[0]?.confidence || 10,
      isUnique: false,
      fallbacks: candidates.slice(1).map((c) => ({
        selector: c.selector,
        strategy: c.strategy,
        confidence: c.confidence,
      })),
      elementHash,
    };
  }

  /**
   * 모든 선택자 후보 생성 (신뢰도 내림차순)
   */
  private generateAllCandidates(element: ElementSnapshot): SelectorCandidate[] {
    const candidates: SelectorCandidate[] = [];
    const attrs = element.attributes;
    const tagName = element.tagName.toLowerCase();

    // 1. aria-label (최고 우선순위 - 98)
    // 동적 상태 텍스트 제거 (예: "아이디 로그인, 선택됨" -> "아이디 로그인")
    if (attrs['aria-label']) {
      const cleanLabel = this.stripDynamicState(attrs['aria-label']);
      const hasDynamicState = cleanLabel !== attrs['aria-label'];

      if (hasDynamicState) {
        console.log(`[SemanticSelector] Stripped dynamic state: "${attrs['aria-label']}" -> "${cleanLabel}"`);
      }

      // 동적 aria-label을 가진 탭/버튼은 텍스트 기반 셀렉터를 최우선으로 사용
      // (aria-label은 선택된 탭에만 존재하는 경우가 있음)
      if (hasDynamicState && attrs['role'] === 'tab') {
        // 탭: 텍스트 기반 셀렉터를 최우선으로 (99)
        candidates.push({
          selector: `[role="tab"]:has-text("${this.escapeText(cleanLabel)}")`,
          strategy: 'text',
          confidence: 99,
          isUnique: false,
        });
      }

      // 일반 aria-label 셀렉터 추가
      candidates.push({
        selector: `${tagName}[aria-label="${this.escapeAttr(cleanLabel)}"]`,
        strategy: 'label',
        confidence: 98,
        isUnique: false,
      });
    }

    // 2. role + accessible name (95)
    if (element.role && element.name) {
      const cleanName = this.stripDynamicState(element.name);
      const roleSelector = this.buildPlaywrightRoleSelector(
        element.role,
        cleanName
      );
      candidates.push({
        selector: roleSelector,
        strategy: 'role',
        confidence: 95,
        isUnique: false,
      });
    }

    // 3. name attribute - forms (93)
    if (attrs['name'] && this.isFormElement(tagName)) {
      candidates.push({
        selector: `${tagName}[name="${this.escapeAttr(attrs['name'])}"]`,
        strategy: 'css',
        confidence: 93,
        isUnique: false,
      });
    }

    // 4. type (unique types get higher confidence) (90/50)
    if (tagName === 'input' && attrs['type']) {
      const uniqueTypes = ['password', 'email', 'tel', 'search', 'file', 'date', 'number'];
      const conf = uniqueTypes.includes(attrs['type']) ? 90 : 50;
      candidates.push({
        selector: `input[type="${attrs['type']}"]`,
        strategy: 'css',
        confidence: conf,
        isUnique: false,
      });
    }

    // 5. data-testid (88)
    if (attrs['data-testid']) {
      candidates.push({
        selector: `[data-testid="${this.escapeAttr(attrs['data-testid'])}"]`,
        strategy: 'testId',
        confidence: 88,
        isUnique: false,
      });
    }

    // 6. placeholder (85)
    if (attrs['placeholder']) {
      candidates.push({
        selector: `${tagName}[placeholder="${this.escapeAttr(attrs['placeholder'])}"]`,
        strategy: 'placeholder',
        confidence: 85,
        isUnique: false,
      });
    }

    // 7. Stable ID only (80)
    if (attrs['id'] && this.isStableId(attrs['id'])) {
      candidates.push({
        selector: `#${this.escapeCssId(attrs['id'])}`,
        strategy: 'css',
        confidence: 80,
        isUnique: false,
      });
    }

    // 8. Text content for buttons/links (75)
    if (element.textContent && this.isTextElement(tagName)) {
      const text = element.textContent.trim();
      if (text.length > 0 && text.length < 50) {
        // Playwright 스타일 텍스트 선택자
        candidates.push({
          selector: `${tagName}:has-text("${this.escapeText(text)}")`,
          strategy: 'text',
          confidence: 75,
          isUnique: false,
        });
      }
    }

    // 9. aria-labelledby (70)
    if (attrs['aria-labelledby']) {
      candidates.push({
        selector: `${tagName}[aria-labelledby="${this.escapeAttr(attrs['aria-labelledby'])}"]`,
        strategy: 'label',
        confidence: 70,
        isUnique: false,
      });
    }

    // 10. 특수 케이스: role이 있는 버튼/탭
    if (attrs['role']) {
      if (attrs['aria-label']) {
        const cleanLabelForRole = this.stripDynamicState(attrs['aria-label']);
        candidates.push({
          selector: `[role="${attrs['role']}"][aria-label*="${this.escapeAttr(cleanLabelForRole)}"]`,
          strategy: 'role',
          confidence: 92,
          isUnique: false,
        });
      }
    }

    // 신뢰도 내림차순 정렬
    return candidates.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 조합 선택자 생성 (단일로 고유하지 않을 때)
   */
  private async generateCombinedSelector(
    element: ElementSnapshot,
    candidates: SelectorCandidate[],
    page: Page
  ): Promise<SemanticSelectorResult> {
    const attrs = element.attributes;
    const tagName = element.tagName.toLowerCase();

    // 조합 1: aria-label + type
    if (attrs['aria-label'] && attrs['type']) {
      const cleanLabel = this.stripDynamicState(attrs['aria-label']);
      const combined = `${tagName}[aria-label="${this.escapeAttr(cleanLabel)}"][type="${attrs['type']}"]`;
      try {
        const count = await this.countMatches(page, combined);
        if (count === 1) {
          return {
            selector: combined,
            strategy: 'css',
            confidence: 95,
            isUnique: true,
            fallbacks: candidates.map((c) => ({
              selector: c.selector,
              strategy: c.strategy,
              confidence: c.confidence,
            })),
            elementHash: '',
          };
        }
      } catch {
        // 무시
      }
    }

    // 조합 2: role + aria-label (정확한 매칭)
    if (attrs['role'] && attrs['aria-label']) {
      const cleanLabel = this.stripDynamicState(attrs['aria-label']);
      const combined = `[role="${attrs['role']}"][aria-label="${this.escapeAttr(cleanLabel)}"]`;
      try {
        const count = await this.countMatches(page, combined);
        if (count === 1) {
          return {
            selector: combined,
            strategy: 'role',
            confidence: 93,
            isUnique: true,
            fallbacks: candidates.map((c) => ({
              selector: c.selector,
              strategy: c.strategy,
              confidence: c.confidence,
            })),
            elementHash: '',
          };
        }
      } catch {
        // 무시
      }
    }

    // 조합 3: 부정 선택자 (다른 요소 제외)
    // 예: a[aria-label='로그인 버튼']:not([aria-label*='인증서'])
    if (attrs['aria-label'] && element.textContent) {
      const negative = `:not([aria-label*='인증서']):not([aria-label*='공동'])`;
      const combined = `${tagName}[aria-label*="${this.escapeAttr(attrs['aria-label'])}"]${negative}`;
      try {
        const count = await this.countMatches(page, combined);
        if (count === 1) {
          return {
            selector: combined,
            strategy: 'css',
            confidence: 85,
            isUnique: true,
            fallbacks: candidates.map((c) => ({
              selector: c.selector,
              strategy: c.strategy,
              confidence: c.confidence,
            })),
            elementHash: '',
          };
        }
      } catch {
        // 무시
      }
    }

    // 고유하지 않음
    return {
      selector: candidates[0]?.selector || tagName,
      strategy: candidates[0]?.strategy || 'css',
      confidence: candidates[0]?.confidence || 10,
      isUnique: false,
      fallbacks: candidates.slice(1).map((c) => ({
        selector: c.selector,
        strategy: c.strategy,
        confidence: c.confidence,
      })),
      elementHash: '',
    };
  }

  /**
   * Playwright getByRole 스타일 선택자 생성
   */
  private buildPlaywrightRoleSelector(role: string, name: string): string {
    // Playwright의 getByRole에서 사용하는 형식
    return `[role="${role}"][name="${this.escapeAttr(name)}"]`;
  }

  /**
   * 기본 태그 선택자 생성
   */
  private buildTagSelector(element: ElementSnapshot): string {
    return element.tagName.toLowerCase();
  }

  /**
   * 선택자 매칭 개수 확인
   */
  private async countMatches(page: Page, selector: string): Promise<number> {
    try {
      // :has-text 같은 Playwright 전용 선택자 처리
      if (selector.includes(':has-text(')) {
        return await page.locator(selector).count();
      }
      // 일반 CSS 선택자
      return await page.locator(selector).count();
    } catch (error) {
      console.error(`[SemanticSelector] Count error for "${selector}":`, error);
      throw error;
    }
  }

  /**
   * 요소 해시 생성 (변경 감지용)
   */
  private generateElementHash(element: ElementSnapshot): string {
    const hashSource = [
      element.tagName,
      element.attributes['aria-label'] || '',
      element.attributes['role'] || '',
      element.attributes['name'] || '',
      element.attributes['type'] || '',
      element.textContent?.slice(0, 30) || '',
    ].join('|');

    return crypto.createHash('md5').update(hashSource).digest('hex').slice(0, 8);
  }

  /**
   * 안정적인 ID인지 확인
   */
  private isStableId(id: string): boolean {
    const dynamicPatterns = [
      /^[a-f0-9]{8}-[a-f0-9]{4}/i, // UUID
      /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}/i, // UUID anywhere
      /^\d{10,}/, // Timestamp
      /_\d+$/, // Numeric suffix
      /^react-/i,
      /^ember/i,
      /^ng-/i,
      /^:r[0-9a-z]+:/i, // React 18+ ID
      /^pt-/i,
      /^uuid-/i,
      /\//, // Contains slash
    ];

    return !dynamicPatterns.some((pattern) => pattern.test(id));
  }

  /**
   * 폼 요소인지 확인
   */
  private isFormElement(tagName: string): boolean {
    return ['input', 'select', 'textarea', 'button'].includes(
      tagName.toLowerCase()
    );
  }

  /**
   * 텍스트 기반 요소인지 확인
   */
  private isTextElement(tagName: string): boolean {
    return ['button', 'a', 'span', 'div', 'label', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(
      tagName.toLowerCase()
    );
  }

  /**
   * CSS 속성값 이스케이프
   */
  private escapeAttr(value: string): string {
    return value.replace(/"/g, '\\"').replace(/'/g, "\\'");
  }

  /**
   * CSS ID 이스케이프
   */
  private escapeCssId(id: string): string {
    // CSS.escape가 없는 Node.js 환경용
    return id.replace(/([^\w-])/g, '\\$1');
  }

  /**
   * 텍스트 이스케이프 (Playwright :has-text용)
   */
  private escapeText(text: string): string {
    return text.replace(/"/g, '\\"');
  }

  /**
   * ElementSnapshot에서 직접 최선의 CSS 선택자 생성 (비동기 검증 없이)
   * RecordingService의 injected script에서 사용
   */
  generateSelectorSync(element: ElementSnapshot): string {
    const attrs = element.attributes;
    const tagName = element.tagName.toLowerCase();

    // 우선순위대로 확인
    // 1. aria-label (동적 상태 제거)
    if (attrs['aria-label']) {
      const cleanLabel = this.stripDynamicState(attrs['aria-label']);
      return `${tagName}[aria-label="${this.escapeAttr(cleanLabel)}"]`;
    }

    // 2. name (form elements)
    if (attrs['name'] && this.isFormElement(tagName)) {
      return `${tagName}[name="${this.escapeAttr(attrs['name'])}"]`;
    }

    // 3. type (unique types)
    if (tagName === 'input' && attrs['type']) {
      const uniqueTypes = ['password', 'email', 'tel', 'search', 'file'];
      if (uniqueTypes.includes(attrs['type'])) {
        return `input[type="${attrs['type']}"]`;
      }
    }

    // 4. data-testid
    if (attrs['data-testid']) {
      return `[data-testid="${this.escapeAttr(attrs['data-testid'])}"]`;
    }

    // 5. placeholder
    if (attrs['placeholder']) {
      return `${tagName}[placeholder="${this.escapeAttr(attrs['placeholder'])}"]`;
    }

    // 6. Stable ID
    if (attrs['id'] && this.isStableId(attrs['id'])) {
      return `#${this.escapeCssId(attrs['id'])}`;
    }

    // 7. role + aria-label (동적 상태 제거)
    if (attrs['role'] && attrs['aria-label']) {
      const cleanLabel = this.stripDynamicState(attrs['aria-label']);
      return `[role="${attrs['role']}"][aria-label="${this.escapeAttr(cleanLabel)}"]`;
    }

    // Fallback: tag with class
    if (attrs['class']) {
      const classes = attrs['class'].split(/\s+/).filter((c) => c && !this.isDynamicClass(c));
      if (classes.length > 0) {
        return `${tagName}.${classes.slice(0, 2).join('.')}`;
      }
    }

    return tagName;
  }

  /**
   * 동적 클래스인지 확인
   */
  private isDynamicClass(className: string): boolean {
    const dynamicPatterns = [
      /^css-[a-z0-9]+$/i,
      /^sc-[a-z]+$/i,
      /^_[a-z0-9]{5,}$/i,
      /^emotion-/i,
      /--[a-z0-9]{6,}$/i,
    ];
    return dynamicPatterns.some((p) => p.test(className));
  }
}
