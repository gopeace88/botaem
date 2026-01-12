import type { Page, Locator } from "playwright";
import { vi } from "vitest";

export function createMockLocator(
  options: {
    count?: number;
    isVisible?: boolean;
    isEditable?: boolean;
    elementHandle?: object | null;
  } = {},
): Locator {
  const { count = 1, isEditable = false, elementHandle = {} } = options;

  const mockLocator = {
    count: vi.fn().mockResolvedValue(count),
    waitFor: vi.fn().mockResolvedValue(undefined),
    click: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockImplementation((fn: (el: Element) => unknown) => {
      if (fn.toString().includes("tagName")) {
        return Promise.resolve(isEditable);
      }
      return Promise.resolve(null);
    }),
    elementHandle: vi.fn().mockResolvedValue(elementHandle),
    first: vi.fn().mockReturnThis(),
    nth: vi.fn().mockReturnThis(),
  } as unknown as Locator;

  return mockLocator;
}

export function createMockPage(
  options: {
    locatorResult?: Locator;
    getByRoleResult?: Locator;
    getByTestIdResult?: Locator;
    getByPlaceholderResult?: Locator;
    getByLabelResult?: Locator;
    getByTextResult?: Locator;
  } = {},
): Page {
  const defaultLocator = createMockLocator();

  const mockPage = {
    locator: vi.fn().mockReturnValue(options.locatorResult ?? defaultLocator),
    getByRole: vi
      .fn()
      .mockReturnValue(options.getByRoleResult ?? defaultLocator),
    getByTestId: vi
      .fn()
      .mockReturnValue(options.getByTestIdResult ?? defaultLocator),
    getByPlaceholder: vi
      .fn()
      .mockReturnValue(options.getByPlaceholderResult ?? defaultLocator),
    getByLabel: vi
      .fn()
      .mockReturnValue(options.getByLabelResult ?? defaultLocator),
    getByText: vi
      .fn()
      .mockReturnValue(options.getByTextResult ?? defaultLocator),
    mouse: {
      click: vi.fn().mockResolvedValue(undefined),
    },
    evaluate: vi.fn().mockResolvedValue(null),
  } as unknown as Page;

  return mockPage;
}

export function createMockStep(overrides: Record<string, unknown> = {}) {
  return {
    id: "step-1",
    action: "click" as const,
    selector: "#test-button",
    message: "Test step",
    smartSelector: {
      primary: {
        strategy: "css" as const,
        value: "#test-button",
        confidence: 100,
      },
      fallbacks: [],
      coordinates: { x: 100, y: 100, width: 50, height: 30 },
      elementHash: "hash123",
    },
    identity: {
      tagName: "BUTTON",
      axRole: "button",
      axName: "Submit",
      boundingBox: { x: 100, y: 100, width: 50, height: 30 },
      backendNodeId: 1,
      capturedAt: Date.now(),
    },
    ...overrides,
  };
}
