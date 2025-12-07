/**
 * Self-Healing Engine - 선택자 실패 시 자동 복구
 *
 * 보탬e 핵심 기능: 웹사이트 변경에도 자동으로 적응
 *
 * v3: ElementIdentity 기반 Accessibility-First 매칭 추가
 */

import { Page, Locator } from 'playwright';
import {
  SmartSelector,
  SelectorWithScore,
  HealingRecord,
  SemanticStep,
  BoundingBox,
  PlaybookStep,
  SelectorInfo,
  ElementIdentity,
  SemanticStepV3,
  MatchingStrategy,
} from '../../shared/types';
import { SnapshotService } from './snapshot.service';
import { SmartSelectorGenerator } from './smart-selector';
import { Highlighter } from './highlighter';
import { AccessibilityService } from './accessibility.service';

export interface HealingResult {
  success: boolean;
  locator?: Locator;
  usedStrategy: 'primary' | 'fallback' | 'coordinates' | 'legacy' | 'accessibility' | 'identity';
  usedSelector?: SelectorWithScore;
  matchingStrategy?: MatchingStrategy;  // v3
  healingRecord?: HealingRecord;
  error?: string;
}

export class SelfHealingEngine {
  private snapshotService: SnapshotService;
  private selectorGenerator: SmartSelectorGenerator;
  private accessibilityService: AccessibilityService;  // v3
  private highlighter: Highlighter;
  private page: Page | null = null;
  private healingHistory: HealingRecord[] = [];

  constructor() {
    this.snapshotService = new SnapshotService();
    this.selectorGenerator = new SmartSelectorGenerator();
    this.accessibilityService = new AccessibilityService();  // v3
    this.highlighter = new Highlighter();
  }

  /**
   * 초기화
   */
  async initialize(page: Page): Promise<void> {
    this.page = page;
    await this.snapshotService.initialize(page);
    await this.accessibilityService.initialize(page);  // v3
    this.highlighter.setPage(page);
  }

  /**
   * 자가 치유 로케이터 찾기
   * v3: ElementIdentity 기반 매칭 최우선
   */
  async findElement(
    step: SemanticStep | PlaybookStep | SemanticStepV3,
    showHighlight: boolean = true
  ): Promise<HealingResult> {
    if (!this.page) {
      return { success: false, usedStrategy: 'primary', error: '페이지가 초기화되지 않음' };
    }

    const stepV3 = step as SemanticStepV3;
    const semanticStep = step as SemanticStep;
    const smartSelector = semanticStep.smartSelector;
    const isInputAction = step.action === 'type' || step.action === 'select';

    // ========================================
    // v3: ElementIdentity 기반 매칭 최우선
    // ========================================
    if (stepV3.identity) {
      const identityResult = await this.findByIdentity(stepV3.identity, isInputAction, showHighlight);
      if (identityResult.success) {
        console.log(`[SelfHealing] v3 Identity match: ${identityResult.matchingStrategy}`);
        return identityResult;
      }
      console.log(`[SelfHealing] v3 Identity match failed, falling back to v2`);
    }

    // INPUT 액션에서 사용하면 안 되는 선택자 전략
    const forbiddenStrategiesForInput = ['label', 'text', 'role'];

    if (!smartSelector) {
      // 스마트 셀렉터가 없으면 기존 방식으로 폴백
      return this.tryLegacySelectors(step);
    }

    // 선택자 필터링: INPUT 액션일 때 label/text/role 제외
    const filterSelector = (sel: SelectorWithScore): boolean => {
      if (isInputAction && forbiddenStrategiesForInput.includes(sel.strategy)) {
        console.log(`[SelfHealing] Skipping ${sel.strategy} selector for ${step.action}: ${sel.value}`);
        return false;
      }
      return true;
    };

    // 1단계: Primary 선택자 시도 (INPUT 액션에서 label/text/role이면 건너뜀)
    if (filterSelector(smartSelector.primary)) {
      const primaryResult = await this.trySelector(
        smartSelector.primary,
        showHighlight ? '기본 선택자' : undefined
      );

      if (primaryResult.success && primaryResult.locator) {
        return {
          success: true,
          locator: primaryResult.locator,
          usedStrategy: 'primary',
          usedSelector: smartSelector.primary,
        };
      }

      console.log(`[SelfHealing] Primary selector failed: ${smartSelector.primary.value}`);
    }

    // 2단계: Fallback 선택자들 순차 시도 (필터링 적용)
    const filteredFallbacks = smartSelector.fallbacks.filter(filterSelector);

    for (const fallback of filteredFallbacks) {
      const fallbackResult = await this.trySelector(
        fallback,
        showHighlight ? `대체 선택자 (${fallback.strategy})` : undefined
      );

      if (fallbackResult.success && fallbackResult.locator) {
        // 치유 기록 생성
        const healingRecord: HealingRecord = {
          timestamp: Date.now(),
          originalSelector: smartSelector.primary.value,
          healedSelector: fallback.value,
          strategy: fallback.strategy,
          success: true,
        };

        this.healingHistory.push(healingRecord);
        console.log(`[SelfHealing] Healed with fallback: ${fallback.strategy} = ${fallback.value}`);

        return {
          success: true,
          locator: fallbackResult.locator,
          usedStrategy: 'fallback',
          usedSelector: fallback,
          healingRecord,
        };
      }
    }

    // 3단계: 좌표 기반 클릭 시도
    if (smartSelector.coordinates && this.isValidBoundingBox(smartSelector.coordinates)) {
      const coordResult = await this.tryCoordinates(
        smartSelector.coordinates,
        showHighlight
      );

      if (coordResult.success) {
        const healingRecord: HealingRecord = {
          timestamp: Date.now(),
          originalSelector: smartSelector.primary.value,
          healedSelector: `coordinates(${smartSelector.coordinates.x}, ${smartSelector.coordinates.y})`,
          strategy: 'css',  // 특수 케이스
          success: true,
        };

        this.healingHistory.push(healingRecord);
        console.log(`[SelfHealing] Healed with coordinates: ${smartSelector.coordinates.x}, ${smartSelector.coordinates.y}`);

        return {
          success: true,
          usedStrategy: 'coordinates',
          healingRecord,
        };
      }
    }

    // 4단계: 유사 요소 탐색 (스냅샷 기반)
    if (smartSelector.snapshot) {
      const similarResult = await this.findSimilarElement(smartSelector);
      if (similarResult.success) {
        return similarResult;
      }
    }

    // 모든 전략 실패
    return {
      success: false,
      usedStrategy: 'primary',
      error: '모든 선택자 전략 실패',
    };
  }

  /**
   * 단일 선택자 시도
   */
  private async trySelector(
    selector: SelectorWithScore,
    highlightLabel?: string
  ): Promise<{ success: boolean; locator?: Locator }> {
    if (!this.page) return { success: false };

    try {
      const locator = this.createLocator(selector);
      const count = await locator.count();

      if (count === 1) {
        // 정확히 하나 - 하이라이트 표시
        if (highlightLabel) {
          const cssSelector = await this.locatorToCssSelector(locator);
          if (cssSelector) {
            await this.highlighter.highlightElement(cssSelector, {
              label: highlightLabel,
              color: '#22c55e',
            });
          }
        }
        return { success: true, locator };
      } else if (count > 1) {
        // 여러 개 - 첫 번째 사용 (경고)
        console.log(`[SelfHealing] Multiple elements (${count}) for: ${selector.value}`);
        return { success: true, locator: locator.first() };
      }
    } catch (error) {
      // 선택자 오류
    }

    return { success: false };
  }

  /**
   * 좌표 기반 시도
   */
  private async tryCoordinates(
    box: BoundingBox,
    showHighlight: boolean
  ): Promise<{ success: boolean }> {
    if (!this.page) return { success: false };

    try {
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;

      // 해당 좌표에 요소가 있는지 확인
      const element = await this.snapshotService.getElementAtPoint(centerX, centerY);

      if (element && element.isVisible) {
        if (showHighlight) {
          await this.highlighter.highlightByCoordinates(box, {
            label: '좌표 기반 클릭',
            color: '#f59e0b',
          });
        }
        return { success: true };
      }
    } catch (error) {
      console.error('[SelfHealing] Coordinates check failed:', error);
    }

    return { success: false };
  }

  /**
   * 유사 요소 탐색
   */
  private async findSimilarElement(
    original: SmartSelector
  ): Promise<HealingResult> {
    if (!this.page || !original.snapshot) {
      return { success: false, usedStrategy: 'primary', error: '스냅샷 없음' };
    }

    try {
      // 현재 페이지 스냅샷 캡처
      const currentSnapshot = await this.snapshotService.captureSnapshot();

      // 유사한 요소 찾기
      let bestMatch: { element: any; similarity: number } | null = null;

      for (const element of currentSnapshot.elements) {
        const newSelector = this.selectorGenerator.generateFromSnapshot(element);
        const similarity = this.selectorGenerator.calculateSimilarity(original, newSelector);

        if (similarity > 60 && (!bestMatch || similarity > bestMatch.similarity)) {
          bestMatch = { element, similarity };
        }
      }

      if (bestMatch) {
        console.log(`[SelfHealing] Found similar element with ${bestMatch.similarity}% similarity`);

        // 새로운 선택자로 로케이터 생성
        const newSelector = this.selectorGenerator.generateFromSnapshot(bestMatch.element);
        const locator = this.createLocator(newSelector.primary);

        return {
          success: true,
          locator,
          usedStrategy: 'fallback',
          usedSelector: newSelector.primary,
          healingRecord: {
            timestamp: Date.now(),
            originalSelector: original.primary.value,
            healedSelector: newSelector.primary.value,
            strategy: newSelector.primary.strategy,
            success: true,
          },
        };
      }
    } catch (error) {
      console.error('[SelfHealing] Similar element search failed:', error);
    }

    return { success: false, usedStrategy: 'primary', error: '유사 요소 없음' };
  }

  /**
   * 레거시 선택자 지원 (이전 버전 호환)
   */
  private async tryLegacySelectors(step: PlaybookStep): Promise<HealingResult> {
    if (!this.page) {
      return { success: false, usedStrategy: 'primary', error: '페이지 없음' };
    }

    // 기존 selectors 배열 사용
    let selectors: SelectorInfo[] = step.selectors ? [...step.selectors] : [];
    if (step.selector) {
      selectors.push({ strategy: 'css', value: step.selector, priority: 999 });
    }

    // type/select 액션일 때 입력 가능한 요소를 찾는 선택자만 사용
    const isInputAction = step.action === 'type' || step.action === 'select';
    if (isInputAction) {
      // label/text 선택자는 INPUT에 사용하면 안됨 - 완전히 제외
      selectors = selectors.filter(s => !['label', 'text', 'role'].includes(s.strategy));

      // CSS와 placeholder 선택자를 먼저 시도 (더 정확함)
      const inputPriorityOrder = ['css', 'placeholder', 'testId', 'xpath'];
      selectors.sort((a, b) => {
        const aIndex = inputPriorityOrder.indexOf(a.strategy);
        const bIndex = inputPriorityOrder.indexOf(b.strategy);
        return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
      });
    }

    console.log(`[SelfHealing] Trying ${selectors.length} selectors for ${step.action}:`,
      selectors.map(s => `${s.strategy}:${s.value.slice(0, 30)}`));

    for (const sel of selectors) {
      const selectorWithScore: SelectorWithScore = {
        strategy: sel.strategy,
        value: sel.value,
        confidence: 100 - sel.priority,
      };

      const result = await this.trySelectorForAction(selectorWithScore, step.action, isInputAction);
      if (result.success) {
        return {
          success: true,
          locator: result.locator,
          usedStrategy: 'legacy',
          usedSelector: selectorWithScore,
        };
      }
    }

    return { success: false, usedStrategy: 'primary', error: '모든 선택자 실패' };
  }

  /**
   * 액션 타입에 맞는 선택자 시도
   */
  private async trySelectorForAction(
    selector: SelectorWithScore,
    _action: string,
    isInputAction: boolean,
    highlightLabel?: string
  ): Promise<{ success: boolean; locator?: Locator }> {
    if (!this.page) return { success: false };

    try {
      const locator = this.createLocator(selector);
      const count = await locator.count();

      if (count === 0) return { success: false };

      // 입력 액션일 경우 실제 입력 가능한 요소인지 확인
      if (isInputAction && count >= 1) {
        // 각 매칭된 요소 중 입력 가능한 것 찾기
        for (let i = 0; i < count; i++) {
          const element = locator.nth(i);
          const isEditable = await element.evaluate((el) => {
            const tagName = el.tagName.toUpperCase();
            return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' ||
                   el.getAttribute('contenteditable') === 'true';
          }).catch(() => false);

          if (isEditable) {
            console.log(`[SelfHealing] Found editable element at index ${i} for: ${selector.value}`);
            if (highlightLabel) {
              const cssSelector = await this.locatorToCssSelector(element);
              if (cssSelector) {
                await this.highlighter.highlightElement(cssSelector, {
                  label: highlightLabel,
                  color: '#22c55e',
                });
              }
            }
            return { success: true, locator: element };
          }
        }
        // 입력 가능한 요소를 찾지 못함
        console.log(`[SelfHealing] No editable element found for: ${selector.value}`);
        return { success: false };
      }

      // 일반 액션 (click 등)
      if (count === 1) {
        if (highlightLabel) {
          const cssSelector = await this.locatorToCssSelector(locator);
          if (cssSelector) {
            await this.highlighter.highlightElement(cssSelector, {
              label: highlightLabel,
              color: '#22c55e',
            });
          }
        }
        return { success: true, locator };
      } else if (count > 1) {
        console.log(`[SelfHealing] Multiple elements (${count}) for: ${selector.value}`);

        // 클릭 액션에서 text 선택자일 때 실제 버튼/링크 요소 우선
        if (selector.strategy === 'text' || selector.strategy === 'label') {
          const buttonElement = await this.findClickableElement(locator, count, selector.value);
          if (buttonElement) {
            return { success: true, locator: buttonElement };
          }
        }

        return { success: true, locator: locator.first() };
      }
    } catch (error) {
      // 선택자 오류
    }

    return { success: false };
  }

  /**
   * 클릭 가능한 요소 찾기 (버튼, 링크 우선)
   */
  private async findClickableElement(
    locator: Locator,
    count: number,
    selectorValue: string
  ): Promise<Locator | null> {
    if (!this.page) return null;

    // 우선순위: BUTTON > A > [role="button"] > 클래스에 btn/button 포함 > 기타
    const priorities = [
      { check: (tag: string, _role: string, _classes: string) => tag === 'BUTTON', score: 100 },
      { check: (tag: string, _role: string, _classes: string) => tag === 'A', score: 90 },
      { check: (_tag: string, role: string, _classes: string) => role === 'button', score: 80 },
      { check: (_tag: string, _role: string, classes: string) =>
        classes.includes('btn') || classes.includes('button'), score: 70 },
      { check: (tag: string, _role: string, _classes: string) => tag === 'INPUT', score: 60 },
    ];

    let bestMatch: { locator: Locator; score: number } | null = null;

    for (let i = 0; i < Math.min(count, 10); i++) {  // 최대 10개만 검사
      const element = locator.nth(i);
      try {
        const info = await element.evaluate((el) => ({
          tagName: el.tagName.toUpperCase(),
          role: el.getAttribute('role') || '',
          classes: typeof el.className === 'string' ? el.className : '',
          isVisible: (el as HTMLElement).offsetWidth > 0 && (el as HTMLElement).offsetHeight > 0,
          text: el.textContent?.trim().slice(0, 50) || '',
        }));

        if (!info.isVisible) continue;

        // 정확한 텍스트 매칭 우선
        const isExactMatch = info.text === selectorValue ||
          info.text.startsWith(selectorValue) && info.text.length < selectorValue.length + 5;

        for (const priority of priorities) {
          if (priority.check(info.tagName, info.role, info.classes)) {
            const score = priority.score + (isExactMatch ? 10 : 0);
            if (!bestMatch || score > bestMatch.score) {
              bestMatch = { locator: element, score };
              console.log(`[SelfHealing] Found clickable element: ${info.tagName} (score: ${score}) at index ${i}`);
            }
            break;
          }
        }
      } catch {
        // 요소 검사 실패
      }
    }

    return bestMatch?.locator || null;
  }

  /**
   * Playwright 로케이터 생성
   */
  private createLocator(selector: SelectorWithScore): Locator {
    if (!this.page) throw new Error('Page not initialized');

    switch (selector.strategy) {
      case 'css':
        return this.page.locator(selector.value);
      case 'xpath':
        return this.page.locator(`xpath=${selector.value}`);
      case 'text':
        // :has-text() 등 Playwright 확장 문법이 포함된 경우 locator 사용
        if (selector.value.includes(':has-text(') || selector.value.includes(':text(')) {
          return this.page.locator(selector.value);
        }
        return this.page.getByText(selector.value);
      case 'role':
        // [role="tab"][aria-label*="..."] 형태의 CSS 선택자 처리
        if (selector.value.startsWith('[role=')) {
          return this.page.locator(selector.value);
        }
        // role[name="..."] 형태
        const roleMatch = selector.value.match(/^(\w+)\[name="(.+)"\]$/);
        if (roleMatch) {
          return this.page.getByRole(roleMatch[1] as any, { name: roleMatch[2] });
        }
        return this.page.getByRole(selector.value as any);
      case 'testId':
        return this.page.getByTestId(selector.value);
      case 'placeholder':
        return this.page.getByPlaceholder(selector.value);
      case 'label':
        // [aria-label="..."] 형태의 CSS 선택자 처리
        if (selector.value.includes('[aria-label')) {
          return this.page.locator(selector.value);
        }
        return this.page.getByLabel(selector.value);
      default:
        return this.page.locator(selector.value);
    }
  }

  /**
   * 로케이터를 CSS 선택자로 변환 (하이라이트용)
   */
  private async locatorToCssSelector(locator: Locator): Promise<string | null> {
    try {
      const element = await locator.elementHandle();
      if (!element) return null;

      return await element.evaluate((el) => {
        if (el.id) return `#${el.id}`;
        if (el.className) {
          const classes = el.className.split(' ').filter((c: string) => c.trim()).slice(0, 2);
          if (classes.length) return `${el.tagName.toLowerCase()}.${classes.join('.')}`;
        }
        return el.tagName.toLowerCase();
      });
    } catch {
      return null;
    }
  }

  /**
   * 유효한 바운딩 박스인지 확인
   */
  private isValidBoundingBox(box: BoundingBox): boolean {
    return box.width > 0 && box.height > 0 && box.x >= 0 && box.y >= 0;
  }

  /**
   * 좌표로 클릭 실행
   */
  async clickByCoordinates(box: BoundingBox): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    await this.page.mouse.click(centerX, centerY);
  }

  /**
   * 치유 히스토리 가져오기
   */
  getHealingHistory(): HealingRecord[] {
    return [...this.healingHistory];
  }

  /**
   * 워크플로우에 치유 결과 적용
   */
  applyHealingToStep(step: SemanticStep, healingRecord: HealingRecord): SemanticStep {
    const updatedStep = { ...step };

    if (!updatedStep.healingHistory) {
      updatedStep.healingHistory = [];
    }
    updatedStep.healingHistory.push(healingRecord);

    // 스마트 셀렉터의 우선순위 업데이트
    if (updatedStep.smartSelector) {
      const healedSelector = updatedStep.smartSelector.fallbacks.find(
        f => f.value === healingRecord.healedSelector
      );

      if (healedSelector) {
        // 치유된 선택자의 신뢰도 상승
        healedSelector.confidence = Math.min(100, healedSelector.confidence + 10);

        // 실패한 primary 선택자의 신뢰도 하락
        updatedStep.smartSelector.primary.confidence = Math.max(
          0,
          updatedStep.smartSelector.primary.confidence - 15
        );

        // 신뢰도 순으로 재정렬
        const allSelectors = [
          updatedStep.smartSelector.primary,
          ...updatedStep.smartSelector.fallbacks,
        ].sort((a, b) => b.confidence - a.confidence);

        updatedStep.smartSelector.primary = allSelectors[0];
        updatedStep.smartSelector.fallbacks = allSelectors.slice(1);
      }
    }

    return updatedStep;
  }

  /**
   * Highlighter 인스턴스 가져오기
   */
  getHighlighter(): Highlighter {
    return this.highlighter;
  }

  // ========================================
  // v3: ElementIdentity 기반 매칭 메서드
  // ========================================

  /**
   * v3: ElementIdentity를 사용한 요소 찾기
   * Accessibility-First 접근: role + name → aria-label → name → ...
   */
  private async findByIdentity(
    identity: ElementIdentity,
    isInputAction: boolean,
    showHighlight: boolean
  ): Promise<HealingResult> {
    if (!this.page) {
      return { success: false, usedStrategy: 'identity', error: '페이지 없음' };
    }

    const strategies: Array<{
      strategy: MatchingStrategy;
      tryMatch: () => Promise<Locator | null>;
      skipForInput?: boolean;
    }> = [
      // 1순위: Playwright getByRole (가장 안정적)
      {
        strategy: 'accessibility',
        tryMatch: async () => {
          if (!identity.axRole || !identity.axName) return null;
          const locator = this.page!.getByRole(identity.axRole as any, { name: identity.axName });
          return await this.validateLocator(locator) ? locator : null;
        },
        skipForInput: isInputAction && ['tab', 'button', 'link'].includes(identity.axRole || ''),
      },
      // 2순위: aria-label 정확 매칭
      {
        strategy: 'ariaLabel',
        tryMatch: async () => {
          if (!identity.ariaLabel) return null;
          const selector = `[aria-label="${this.escapeAttr(identity.ariaLabel)}"]`;
          const locator = this.page!.locator(selector);
          return await this.validateLocator(locator) ? locator : null;
        },
      },
      // 3순위: name 속성 (form elements)
      {
        strategy: 'name',
        tryMatch: async () => {
          if (!identity.name) return null;
          const selector = `${identity.tagName.toLowerCase()}[name="${this.escapeAttr(identity.name)}"]`;
          const locator = this.page!.locator(selector);
          return await this.validateLocator(locator) ? locator : null;
        },
      },
      // 4순위: data-testid
      {
        strategy: 'testId',
        tryMatch: async () => {
          if (!identity.dataTestId) return null;
          const locator = this.page!.getByTestId(identity.dataTestId);
          return await this.validateLocator(locator) ? locator : null;
        },
      },
      // 5순위: placeholder
      {
        strategy: 'placeholder',
        tryMatch: async () => {
          if (!identity.placeholder) return null;
          const locator = this.page!.getByPlaceholder(identity.placeholder);
          return await this.validateLocator(locator) ? locator : null;
        },
      },
      // 6순위: type 속성 (고유한 타입만)
      {
        strategy: 'css',
        tryMatch: async () => {
          if (identity.tagName.toLowerCase() !== 'input' || !identity.type) return null;
          const uniqueTypes = ['password', 'email', 'tel', 'search', 'file'];
          if (!uniqueTypes.includes(identity.type)) return null;
          const locator = this.page!.locator(`input[type="${identity.type}"]`);
          return await this.validateLocator(locator) ? locator : null;
        },
      },
      // 7순위: 안정적인 ID
      {
        strategy: 'css',
        tryMatch: async () => {
          if (!identity.id) return null;
          const locator = this.page!.locator(`#${identity.id}`);
          return await this.validateLocator(locator) ? locator : null;
        },
      },
      // 8순위: 텍스트 매칭 (INPUT 액션에서는 건너뜀)
      {
        strategy: 'text',
        tryMatch: async () => {
          if (!identity.textContent || identity.textContent.length < 2) return null;
          const locator = this.page!.locator(`${identity.tagName.toLowerCase()}:has-text("${this.escapeText(identity.textContent)}")`);
          return await this.validateLocator(locator) ? locator : null;
        },
        skipForInput: isInputAction,
      },
      // 9순위: Visual similarity (좌표 + 크기 기반)
      {
        strategy: 'visual',
        tryMatch: async () => {
          return await this.findByVisualSimilarity(identity);
        },
      },
      // 10순위: 좌표 기반 (최후의 수단)
      {
        strategy: 'coordinates',
        tryMatch: async () => {
          if (!identity.boundingBox || identity.boundingBox.width <= 0) return null;
          // 좌표 기반은 locator 대신 null 반환 (별도 처리 필요)
          return null;
        },
      },
    ];

    // 각 전략 순차 시도
    for (const { strategy, tryMatch, skipForInput } of strategies) {
      if (skipForInput) {
        console.log(`[SelfHealing] Skipping ${strategy} for input action`);
        continue;
      }

      try {
        const locator = await tryMatch();
        if (locator) {
          // 입력 액션일 경우 입력 가능한 요소인지 확인
          if (isInputAction) {
            const isEditable = await this.isEditableElement(locator);
            if (!isEditable) {
              console.log(`[SelfHealing] ${strategy} found non-editable element, skipping`);
              continue;
            }
          }

          // 하이라이트 표시
          if (showHighlight) {
            const cssSelector = await this.locatorToCssSelector(locator);
            if (cssSelector) {
              await this.highlighter.highlightElement(cssSelector, {
                label: `v3: ${strategy}`,
                color: '#10b981',  // 녹색 (v3 성공)
              });
            }
          }

          return {
            success: true,
            locator,
            usedStrategy: 'identity',
            matchingStrategy: strategy,
          };
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : '';
        if (!msg.includes('context was destroyed')) {
          console.log(`[SelfHealing] ${strategy} error:`, msg);
        }
      }
    }

    // 좌표 기반 폴백 (모든 전략 실패 시)
    if (identity.boundingBox && identity.boundingBox.width > 0 && identity.boundingBox.height > 0) {
      console.log(`[SelfHealing] Falling back to coordinates: (${identity.boundingBox.x}, ${identity.boundingBox.y})`);
      // 좌표 기반은 locator를 반환하지 않고 별도 처리 필요
      // 여기서는 실패로 반환하고 호출자가 clickByCoordinates 사용
    }

    return { success: false, usedStrategy: 'identity', error: '모든 v3 매칭 전략 실패' };
  }

  /**
   * v3: Visual similarity 기반 요소 찾기
   */
  private async findByVisualSimilarity(identity: ElementIdentity): Promise<Locator | null> {
    if (!this.page || !identity.visualHash) return null;

    try {
      // 현재 페이지의 인터랙티브 요소 스캔
      const elements = await this.accessibilityService.scanInteractiveElements();

      for (const el of elements) {
        // 태그명이 다르면 스킵
        if (identity.tagName.toLowerCase() !== 'unknown') {
          // 태그명 비교는 DOM 정보 필요 - 여기서는 role로 대략 비교
        }

        // 크기 유사성 체크 (20% 오차 허용)
        const sizeSimilar =
          Math.abs(el.boundingBox.width - identity.boundingBox.width) < identity.boundingBox.width * 0.2 &&
          Math.abs(el.boundingBox.height - identity.boundingBox.height) < identity.boundingBox.height * 0.2;

        // 위치 유사성 체크 (100px 오차 허용)
        const positionSimilar =
          Math.abs(el.boundingBox.x - identity.boundingBox.x) < 100 &&
          Math.abs(el.boundingBox.y - identity.boundingBox.y) < 100;

        // role 유사성 체크
        const roleSimilar = identity.axRole ? el.role === identity.axRole : true;

        if (sizeSimilar && positionSimilar && roleSimilar) {
          console.log(`[SelfHealing] Visual match found: role=${el.role}, name=${el.name}`);
          // 이 요소를 locator로 변환
          if (el.role && el.name) {
            const locator = this.page.getByRole(el.role as any, { name: el.name });
            if (await this.validateLocator(locator)) {
              return locator;
            }
          }
        }
      }
    } catch (error) {
      console.error('[SelfHealing] Visual similarity error:', error);
    }

    return null;
  }

  /**
   * 로케이터 유효성 검증 (정확히 1개 존재)
   */
  private async validateLocator(locator: Locator): Promise<boolean> {
    try {
      const count = await locator.count();
      return count === 1;
    } catch {
      return false;
    }
  }

  /**
   * 요소가 입력 가능한지 확인
   */
  private async isEditableElement(locator: Locator): Promise<boolean> {
    try {
      return await locator.evaluate((el) => {
        const tagName = el.tagName.toUpperCase();
        return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' ||
               el.getAttribute('contenteditable') === 'true';
      });
    } catch {
      return false;
    }
  }

  /**
   * 속성값 이스케이프
   */
  private escapeAttr(value: string): string {
    return value.replace(/"/g, '\\"').replace(/'/g, "\\'");
  }

  /**
   * 텍스트 이스케이프
   */
  private escapeText(text: string): string {
    return text.replace(/"/g, '\\"');
  }

  /**
   * 정리
   */
  async cleanup(): Promise<void> {
    await this.highlighter.cleanup();
    await this.snapshotService.cleanup();
    await this.accessibilityService.cleanup();  // v3
    this.page = null;
  }
}
