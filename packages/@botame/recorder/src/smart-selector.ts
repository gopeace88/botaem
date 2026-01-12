/**
 * Smart Selector Generator
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
 * Generate multiple selector strategies for an element
 * @param element - Element data to generate selectors for
 * @returns Array of selector info with priorities
 */
export function generateSelectors(element: ElementData): SelectorInfo[] {
  const selectors: SelectorInfo[] = [];
  let priority = 0;

  // 1. Test ID (highest priority)
  if (element.dataTestId) {
    selectors.push({
      strategy: "testId",
      value: `[data-testid="${element.dataTestId}"]`,
      priority: priority++,
    });
  }

  // 2. ID
  if (element.id && !isDynamicId(element.id)) {
    selectors.push({
      strategy: "css",
      value: `#${element.id}`,
      priority: priority++,
    });
  }

  // 3. ARIA label
  if (element.ariaLabel) {
    selectors.push({
      strategy: "label",
      value: element.ariaLabel,
      priority: priority++,
    });
  }

  // 4. Role + name
  if (element.role) {
    selectors.push({
      strategy: "role",
      value: `${element.role}${element.text ? `[name="${element.text}"]` : ""}`,
      priority: priority++,
    });
  }

  // 5. Placeholder
  if (element.placeholder) {
    selectors.push({
      strategy: "placeholder",
      value: element.placeholder,
      priority: priority++,
    });
  }

  // 6. Name (form elements)
  if (element.name) {
    selectors.push({
      strategy: "css",
      value: `[name="${element.name}"]`,
      priority: priority++,
    });
  }

  // 7. Text content (last resort)
  if (element.text && element.text.length < 50) {
    selectors.push({
      strategy: "text",
      value: element.text,
      priority: priority++,
    });
  }

  return selectors;
}

/**
 * Check if ID appears to be dynamically generated
 * @param id - Element ID to check
 * @returns true if ID appears dynamic
 */
function isDynamicId(id: string): boolean {
  // Check for patterns that suggest dynamically generated IDs
  return /^\w{32,}$/.test(id) || /^\w+-\w+$/.test(id);
}
