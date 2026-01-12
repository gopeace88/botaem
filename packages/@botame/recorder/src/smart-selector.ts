/**
 * Smart Selector Generator
 * Extracted from RecordingService.generateMultipleSelectors()
 * @module @botame/recorder/smart-selector
 */

import { SelectorInfo } from "@botame/types";

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
 * Generate multiple fallback selectors from element info
 * Extracted from RecordingService.generateMultipleSelectors()
 * 개선: INPUT 요소는 CSS 선택자 우선, text/label은 후순위
 */
export function generateSelectors(element: ElementData): SelectorInfo[] {
  const selectors: SelectorInfo[] = [];
  let priority = 0;

  const isInputElement = ["INPUT", "TEXTAREA", "SELECT"].includes(
    element.tagName,
  );
  const isButtonElement =
    element.tagName === "BUTTON" ||
    (element.tagName === "A" && element.role === "button");

  // === INPUT/TEXTAREA/SELECT 요소: CSS 속성 기반 선택자 최우선 ===
  if (isInputElement) {
    // 1. name 속성 (가장 안정적)
    if (element.name) {
      selectors.push({
        strategy: "css",
        value: `${element.tagName.toLowerCase()}[name="${element.name}"]`,
        priority: priority++,
      });
    }

    // 2. aria-label 속성 (로그인 ID, 비밀번호 등 구분에 유용)
    if (element.ariaLabel) {
      selectors.push({
        strategy: "css",
        value: `${element.tagName.toLowerCase()}[aria-label="${element.ariaLabel}"]`,
        priority: priority++,
      });
    }

    // 3. type 속성 (password, email 등)
    if (
      element.type &&
      [
        "password",
        "email",
        "tel",
        "search",
        "url",
        "number",
        "date",
        "file",
      ].includes(element.type)
    ) {
      selectors.push({
        strategy: "css",
        value: `${element.tagName.toLowerCase()}[type="${element.type}"]`,
        priority: priority++,
      });
    }

    // 4. placeholder 속성
    if (element.placeholder) {
      selectors.push({
        strategy: "placeholder",
        value: element.placeholder,
        priority: priority++,
      });
    }
  }

  // === BUTTON 요소: type, class 기반 선택자 우선 ===
  if (isButtonElement) {
    // 1. type="submit" 버튼
    if (element.type === "submit") {
      selectors.push({
        strategy: "css",
        value: 'button[type="submit"]',
        priority: priority++,
      });
    }

    // 2. 로그인/제출 관련 클래스
    if (element.className) {
      const loginClasses = element.className
        .split(" ")
        .filter((c: string) =>
          /login|submit|btn-primary|btn-main|signin/i.test(c),
        );
      if (loginClasses.length) {
        selectors.push({
          strategy: "css",
          value: `button.${loginClasses[0]}`,
          priority: priority++,
        });
      }
    }
  }

  // === 공통: 안정적인 속성들 ===

  // data-testid (가장 안정적)
  if (element.dataTestId) {
    selectors.push({
      strategy: "testId",
      value: element.dataTestId,
      priority: priority++,
    });
  }

  // 안정적인 ID (동적 ID 제외)
  if (element.id && !isDynamicId(element.id)) {
    selectors.push({
      strategy: "css",
      value: `#${element.id}`,
      priority: priority++,
    });
  }

  // === 후순위: text/label 기반 선택자 (INPUT에는 사용 안함) ===
  if (!isInputElement) {
    // ARIA label (버튼/링크에만)
    if (element.ariaLabel && isButtonElement) {
      selectors.push({
        strategy: "label",
        value: element.ariaLabel,
        priority: priority++,
      });
    }

    // Role + name 조합
    if (element.role && element.name) {
      selectors.push({
        strategy: "role",
        value: `${element.role}[name="${element.name}"]`,
        priority: priority++,
      });
    }

    // Text content (가장 후순위 - 버튼에만)
    if (element.text && isButtonElement) {
      const trimmedText = element.text.trim().slice(0, 30);
      if (trimmedText && trimmedText.length >= 2) {
        selectors.push({
          strategy: "text",
          value: trimmedText,
          priority: priority++,
        });
      }
    }
  }

  return selectors;
}

/**
 * 동적 ID인지 확인
 * Extracted from RecordingService.isDynamicId()
 */
function isDynamicId(id: string): boolean {
  const dynamicPatterns = [
    /^[a-f0-9]{8}-[a-f0-9]{4}/i, // UUID
    /^\d{10,}/, // 타임스탬프
    /_\d+$/, // 숫자 접미사
    /^react-/i, // React 생성 ID
    /^ember/i, // Ember 생성 ID
    /^ng-/i, // Angular 생성 ID
    /^:r[0-9a-z]+:/i, // React 18+ ID
  ];
  return dynamicPatterns.some((p) => p.test(id));
}
