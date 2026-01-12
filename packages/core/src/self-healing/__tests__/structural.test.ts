import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StructuralStrategy } from '../strategies/structural';
import { createMockPage, createMockLocator, createMockStep } from './mocks';
import type { Page } from 'playwright';

describe('StructuralStrategy', () => {
  let mockPage: Page;
  let strategy: StructuralStrategy;

  beforeEach(() => {
    mockPage = createMockPage();
    strategy = new StructuralStrategy(mockPage);
  });

  describe('canHandle', () => {
    it('returns true when step has enhancedFallbacks', () => {
      const step = createMockStep({
        enhancedFallbacks: {
          textSelectors: [{ type: 'exact', value: 'Submit', pattern: '', selector: 'button:has-text("Submit")', confidence: 90 }],
          parentChainSelectors: [],
          nearbyLabelSelectors: [],
        },
      });
      expect(strategy.canHandle(step)).toBe(true);
    });

    it('returns true when step has structuralPosition', () => {
      const step = createMockStep({
        structuralPosition: {
          parentChain: [],
          siblingInfo: { totalSiblings: 3, position: 1 },
          nthChild: 2,
          nthOfType: 1,
        },
      });
      expect(strategy.canHandle(step)).toBe(true);
    });

    it('returns true when step has textPatterns', () => {
      const step = createMockStep({
        textPatterns: {
          original: '제출',
          normalized: '제출',
          variations: [],
          regexPattern: '제출',
          keywords: ['제출'],
        },
      });
      expect(strategy.canHandle(step)).toBe(true);
    });

    it('returns false when step has none of the v4 properties', () => {
      const step = createMockStep({
        enhancedFallbacks: undefined,
        structuralPosition: undefined,
        textPatterns: undefined,
      });
      expect(strategy.canHandle(step)).toBe(false);
    });
  });

  describe('find', () => {
    it('finds element by text selector', async () => {
      const successLocator = createMockLocator({ count: 1 });
      mockPage = createMockPage({ locatorResult: successLocator });
      strategy = new StructuralStrategy(mockPage);

      const step = createMockStep({
        action: 'click',
        enhancedFallbacks: {
          textSelectors: [
            { type: 'exact', value: 'Submit', pattern: '', selector: 'button:has-text("Submit")', confidence: 90 },
          ],
          parentChainSelectors: [],
          nearbyLabelSelectors: [],
        },
      });

      const result = await strategy.find(step);

      expect(result.success).toBe(true);
      expect(mockPage.locator).toHaveBeenCalledWith('button:has-text("Submit")');
    });

    it('skips text selectors for input actions', async () => {
      const failLocator = createMockLocator({ count: 0 });
      mockPage = createMockPage({ locatorResult: failLocator });
      strategy = new StructuralStrategy(mockPage);

      const step = createMockStep({
        action: 'type',
        enhancedFallbacks: {
          textSelectors: [
            { type: 'exact', value: 'Submit', pattern: '', selector: 'button:has-text("Submit")', confidence: 90 },
          ],
          parentChainSelectors: [],
          nearbyLabelSelectors: [],
        },
      });

      const result = await strategy.find(step);

      expect(result.success).toBe(false);
    });

    it('finds element by parent chain selector', async () => {
      const successLocator = createMockLocator({ count: 1 });
      mockPage = createMockPage({ locatorResult: successLocator });
      strategy = new StructuralStrategy(mockPage);

      const step = createMockStep({
        enhancedFallbacks: {
          textSelectors: [],
          parentChainSelectors: [
            { parentSelector: '#form-container', childSelector: 'button', fullSelector: '#form-container button', depth: 2, confidence: 85 },
          ],
          nearbyLabelSelectors: [],
        },
      });

      const result = await strategy.find(step);

      expect(result.success).toBe(true);
      expect(mockPage.locator).toHaveBeenCalledWith('#form-container button');
    });

    it('finds element by nearby label selector', async () => {
      const successLocator = createMockLocator({ count: 1 });
      mockPage = createMockPage({ locatorResult: successLocator });
      strategy = new StructuralStrategy(mockPage);

      const step = createMockStep({
        enhancedFallbacks: {
          textSelectors: [],
          parentChainSelectors: [],
          nearbyLabelSelectors: [
            { labelText: 'Email', relationship: 'for', targetSelector: 'input#email', confidence: 88 },
          ],
        },
      });

      const result = await strategy.find(step);

      expect(result.success).toBe(true);
      expect(mockPage.locator).toHaveBeenCalledWith('input#email');
    });

    it('finds element by text pattern variations', async () => {
      let callIndex = 0;
      const failLocator = createMockLocator({ count: 0 });
      const successLocator = createMockLocator({ count: 1 });

      mockPage.locator = vi.fn().mockImplementation(() => {
        callIndex++;
        return callIndex === 2 ? successLocator : failLocator;
      });
      strategy = new StructuralStrategy(mockPage);

      const step = createMockStep({
        action: 'click',
        textPatterns: {
          original: '제출하기',
          normalized: '제출',
          variations: [
            { type: 'korean', value: '제출', pattern: '제출' },
          ],
          regexPattern: '제출.*',
          keywords: ['제출'],
        },
        identity: { tagName: 'button', boundingBox: { x: 0, y: 0, width: 10, height: 10 }, backendNodeId: 1, capturedAt: Date.now() },
      });

      const result = await strategy.find(step);

      expect(result.success).toBe(true);
    });

    it('finds element by structural position with form element index', async () => {
      const successLocator = createMockLocator({ count: 1, isEditable: true });
      successLocator.evaluate = vi.fn().mockResolvedValue(true);
      mockPage = createMockPage({ locatorResult: successLocator });
      strategy = new StructuralStrategy(mockPage);

      const step = createMockStep({
        action: 'type',
        structuralPosition: {
          parentChain: [],
          siblingInfo: { totalSiblings: 3, position: 1 },
          nthChild: 2,
          nthOfType: 1,
          formElementIndex: 3,
        },
      });

      const result = await strategy.find(step);

      expect(result.success).toBe(true);
    });
  });

  describe('priority', () => {
    it('has priority 4', () => {
      expect(strategy.priority).toBe(4);
    });
  });
});
