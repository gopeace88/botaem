/**
 * SelfHealingAdapter - @botame/core의 SelfHealingEngine을 기존 인터페이스에 맞게 래핑
 *
 * 기존 playbook-runner.service.ts의 인터페이스 유지하면서
 * 새로운 모듈화된 전략 파이프라인 사용 + Local Heuristics
 * v2.1: Phase 1 Algorithmic Rescue Added
 */

import { Page, Locator } from "playwright";
import {
  SelfHealingEngine as CoreEngine,
  type SelfHealingEngineOptions,
  type SemanticStepV4 as CoreSemanticStepV4,
  type HealingRecord,
  type HealStrategy,
  type BoundingBox,
  type SelectorWithScore,
} from "@botame/core";
import { SemanticStepV4 } from "@botame/types";
import { Highlighter } from "./highlighter";

export interface LegacyHealingResult {
  success: boolean;
  locator?: Locator;
  usedStrategy:
    | "primary"
    | "fallback"
    | "coordinates"
    | "legacy"
    | "accessibility"
    | "identity"
    | "enhanced"
    | "fuzzy"
    | "geometric";
  usedSelector?: SelectorWithScore;
  matchingStrategy?: string;
  healMethod?: string;
  healingRecord?: HealingRecord;
  error?: string;
}

export class SelfHealingAdapter {
  private coreEngine: CoreEngine | null = null;
  private highlighter: Highlighter;
  private page: Page | null = null;
  private healingHistory: HealingRecord[] = [];

  constructor() {
    this.highlighter = new Highlighter();
  }

  async initialize(
    page: Page,
    options?: SelfHealingEngineOptions,
  ): Promise<void> {
    this.page = page;
    this.coreEngine = new CoreEngine(page, options);
    this.highlighter.setPage(page);
  }

  async findElement(
    step: SemanticStepV4,
    showHighlight: boolean = true,
  ): Promise<LegacyHealingResult> {
    if (!this.page || !this.coreEngine) {
      return {
        success: false,
        usedStrategy: "primary",
        error: "페이지가 초기화되지 않음",
      };
    }

    // 1. Core Engine 시도
    // Type assertion: @botame/types SemanticStepV4 -> @botame/core SemanticStepV4
    // Both have the same structure, but core has restricted ActionType
    const coreResult = await this.coreEngine.findElement(
      step as unknown as CoreSemanticStepV4,
    );

    if (coreResult.success) {
      const locator = coreResult.selector
        ? this.createLocatorFromSelector(coreResult.selector, step)
        : undefined;

      if (showHighlight && locator) {
        await this.highlightLocator(locator, coreResult.strategy);
      }

      if (coreResult.record) {
        this.healingHistory.push(coreResult.record);
      }

      return {
        success: true,
        locator,
        usedStrategy: this.mapStrategyToLegacy(coreResult.strategy),
        usedSelector: coreResult.selector
          ? { strategy: "css", value: coreResult.selector, confidence: 100 }
          : undefined,
        healingRecord: coreResult.record,
      };
    }

    // 2. Failure Handling: Try Local Heuristics (Phase 1)
    console.log(
      "[SelfHealingAdapter] Core engine failed, trying local heuristics...",
    );
    const localResult = await this.tryLocalHeuristics(step);

    if (localResult.success) {
      console.log(
        `[SelfHealingAdapter] Local heuristic success: ${localResult.usedStrategy}`,
      );
      if (showHighlight && localResult.locator) {
        // 하이라이트 (노란색/주황색 등으로 구분 가능)
        await this.highlightLocator(localResult.locator, "fallback");
      }
      return localResult;
    }

    return {
      success: false,
      usedStrategy: "primary",
      error: coreResult.error || "요소를 찾을 수 없습니다",
    };
  }

  /**
   * 로컬 휴리스틱 복구 전략
   * 1. Geometric Fallback (좌표 근처 동일 태그)
   * 2. Fuzzy Text Matching (유사 텍스트)
   */
  private async tryLocalHeuristics(
    step: SemanticStepV4,
  ): Promise<LegacyHealingResult> {
    if (!this.page) return { success: false, usedStrategy: "primary" };

    // 1. Geometric Fallback
    if (step.smartSelector?.coordinates) {
      const { x, y, width, height } = step.smartSelector.coordinates;
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      const tagName = step.smartSelector.snapshot?.tagName?.toLowerCase();

      try {
        // 좌표에 있는 요소 확인
        // hitTest로 요소를 가져와서 태그명이 일치하는지 확인
        const elHandle = await this.page.evaluateHandle(
          ([cx, cy]) => {
            return document.elementFromPoint(cx, cy);
          },
          [centerX, centerY],
        );

        if (elHandle) {
          const currentTagName = await elHandle.evaluate((el) =>
            el ? el.tagName.toLowerCase() : null,
          );

          // 태그명이 일치하면 (혹은 버튼/입력 예외 처리) 기하학적 매칭 성공 간주
          if (tagName && currentTagName === tagName) {
            // 좌표 클릭이 아닌 Locator 변환을 위해 고유 선택자 생성 시도
            // 여기서는 임시로 xpath 사용
            const xpath = await elHandle.evaluate((el) => {
              if (!el) return null;
              // simple xpath generator
              if (el.id) return `//*[@id="${el.id}"]`;
              return null;
            });

            if (xpath) {
              return {
                success: true,
                locator: this.page.locator(xpath),
                usedStrategy: "geometric",
                usedSelector: {
                  strategy: "xpath",
                  value: xpath,
                  confidence: 50,
                },
              };
            }

            // 선택자가 없으면 그냥 좌표 클릭을 위한 가짜 locator?
            // 아니면 success false하고 좌표 클릭은 나중에 PlaybookRunner가 처리하게 둠.
            // 하지만 여기서는 Locator를 반환해야 하므로...
            // Playwright locator를 element handle로 만들 수 있다.
            // 하지만 page.locator(elementHandle) API는 없다.
            // 좌표 기반은 보통 PlaybookRunner가 처리하지만, 여기서는 '찾았다'는 신호를 줘야 함.
          }
        }
      } catch (e) {
        console.warn("[SelfHealing] Geometric check failed", e);
      }
    }

    // 2. Fuzzy Text Matching
    // step.value(입력값)가 아니라 step.selectors나 snapshot의 텍스트와 화면의 텍스트 비교
    const targetText =
      step.smartSelector?.snapshot?.textContent ||
      step.selectors
        ?.find((s) => s.strategy === "text")
        ?.value?.replace("text=", "");

    if (targetText && targetText.length > 2) {
      try {
        // 페이지의 모든 텍스트 기반 요소(버튼, 링크, 라벨) 스캔하여 유사도 비교
        // 성능을 위해 500ms 제한
        const bestMatch = await this.page.evaluate((target) => {
          // Levenshtein implementation
          function levenshtein(a: string, b: string) {
            if (a.length === 0) return b.length;
            if (b.length === 0) return a.length;
            const matrix: number[][] = [];
            for (let i = 0; i <= b.length; i++) {
              matrix[i] = [i];
            }
            for (let j = 0; j <= a.length; j++) {
              matrix[0][j] = j;
            }
            for (let i = 1; i <= b.length; i++) {
              for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) == a.charAt(j - 1)) {
                  matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                  matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1),
                  );
                }
              }
            }
            return matrix[b.length][a.length];
          }

          const tags = ["BUTTON", "A", "LABEL", "SPAN", "DIV"];
          let bestEl: Element | null = null;
          let minDist = 999;

          // 제한적인 탐색 (body 내의 상위 깊이 위주 혹은 전체)
          // 여기서는 모든 태그를 다 뒤지면 느리니, textContent가 있는 요소만
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_ELEMENT,
            {
              acceptNode: (node) => {
                const el = node as Element;
                if (
                  tags.includes(el.tagName) &&
                  el.textContent &&
                  el.textContent.length < 50
                )
                  return NodeFilter.FILTER_ACCEPT;
                return NodeFilter.FILTER_SKIP;
              },
            },
          );

          while (walker.nextNode()) {
            const node = walker.currentNode as Element;
            const text = node.textContent?.trim();
            if (!text) continue;

            const dist = levenshtein(target, text);
            // 텍스트 길이의 30% 이내 변형만 허용
            if (dist < minDist && dist <= Math.max(2, target.length * 0.3)) {
              minDist = dist;
              bestEl = node;
            }
          }

          if (bestEl) {
            // 선택자 생성
            const el = bestEl as Element;
            if (el.id) return `#${el.id}`;
            if (el.className) return `.${el.className.split(" ")[0]}`; // simple class
            return (
              el.tagName.toLowerCase() +
              `:has-text("${el.textContent?.trim()}")`
            );
          }
          return null;
        }, targetText);

        if (bestMatch) {
          return {
            success: true,
            locator: this.page.locator(bestMatch).first(),
            usedStrategy: "fuzzy",
            usedSelector: { strategy: "css", value: bestMatch, confidence: 60 },
          };
        }
      } catch (e) {
        console.warn("[SelfHealing] Fuzzy text check failed", e);
      }
    }

    return { success: false, usedStrategy: "primary" };
  }

  private createLocatorFromSelector(
    selector: string,
    _step: SemanticStepV4,
  ): Locator | undefined {
    if (!this.page) return undefined;

    try {
      if (selector.startsWith("role=")) {
        const match = selector.match(/^role=(\w+)\[name="(.+)"\]$/);
        if (match) {
          return this.page.getByRole(
            match[1] as Parameters<Page["getByRole"]>[0],
            {
              name: match[2],
            },
          );
        }
      }

      if (selector.startsWith("[data-testid=")) {
        const match = selector.match(/\[data-testid="(.+)"\]/);
        if (match) {
          return this.page.getByTestId(match[1]);
        }
      }

      if (selector.startsWith("[placeholder=")) {
        const match = selector.match(/\[placeholder="(.+)"\]/);
        if (match) {
          return this.page.getByPlaceholder(match[1]);
        }
      }

      if (selector.includes(":has-text(")) {
        return this.page.locator(selector);
      }

      if (selector.startsWith("coordinates(")) {
        return undefined;
      }

      return this.page.locator(selector);
    } catch {
      return this.page.locator(selector);
    }
  }

  private async highlightLocator(
    locator: Locator,
    strategy: HealStrategy | string,
  ): Promise<void> {
    try {
      const cssSelector = await this.locatorToCssSelector(locator);
      if (cssSelector) {
        const colors: Record<string, string> = {
          identity: "#10b981",
          playwright: "#22c55e",
          fallback: "#f59e0b",
          structural: "#3b82f6",
          coordinates: "#ef4444",
          fuzzy: "#8b5cf6", // Purple
          geometric: "#ec4899", // Pink
        };
        await this.highlighter.highlightElement(cssSelector, {
          label: strategy,
          color: colors[strategy] || "#22c55e",
        });
      }
    } catch {}
  }

  private async locatorToCssSelector(locator: Locator): Promise<string | null> {
    try {
      const element = await locator.elementHandle();
      if (!element) return null;

      return await element.evaluate((el) => {
        if (el.id) return `#${el.id}`;
        if (el.className && typeof el.className === "string") {
          const classes = el.className
            .split(" ")
            .filter((c: string) => c.trim())
            .slice(0, 2);
          if (classes.length)
            return `${el.tagName.toLowerCase()}.${classes.join(".")}`;
        }
        return el.tagName.toLowerCase();
      });
    } catch {
      return null;
    }
  }

  private mapStrategyToLegacy(
    strategy: HealStrategy,
  ):
    | "primary"
    | "fallback"
    | "coordinates"
    | "legacy"
    | "accessibility"
    | "identity"
    | "enhanced" {
    switch (strategy) {
      case "identity":
        return "identity";
      case "playwright":
        return "primary";
      case "fallback":
        return "fallback";
      case "structural":
        return "enhanced";
      case "coordinates":
        return "coordinates";
      default:
        return "primary";
    }
  }

  async clickByCoordinates(box: BoundingBox): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    await this.page.mouse.click(centerX, centerY);
  }

  getHealingHistory(): HealingRecord[] {
    return [...this.healingHistory];
  }

  getHighlighter(): Highlighter {
    return this.highlighter;
  }

  getStats() {
    return this.coreEngine?.getStats();
  }
}
