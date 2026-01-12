import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FallbackStrategy } from '../strategies/fallback';
import { createMockPage, createMockLocator, createMockStep } from './mocks';
import type { Page } from 'playwright';

describe('FallbackStrategy', () => {
  let mockPage: Page;
  let strategy: FallbackStrategy;

  beforeEach(() => {
    mockPage = createMockPage();
    strategy = new FallbackStrategy(mockPage);
  });

  describe('canHandle', () => {
    it('returns true when step has fallbacks', () => {
      const step = createMockStep({
        smartSelector: {
          primary: { strategy: 'css', value: '#primary', confidence: 100 },
          fallbacks: [{ strategy: 'css', value: '#fallback1', confidence: 90 }],
          coordinates: { x: 0, y: 0, width: 10, height: 10 },
          elementHash: 'hash',
        },
      });
      expect(strategy.canHandle(step)).toBe(true);
    });

    it('returns false when step has no fallbacks', () => {
      const step = createMockStep({
        smartSelector: {
          primary: { strategy: 'css', value: '#primary', confidence: 100 },
          fallbacks: [],
          coordinates: { x: 0, y: 0, width: 10, height: 10 },
          elementHash: 'hash',
        },
      });
      expect(strategy.canHandle(step)).toBe(false);
    });

    it('returns false when step has no smartSelector', () => {
      const step = createMockStep({ smartSelector: undefined });
      expect(strategy.canHandle(step)).toBe(false);
    });
  });

  describe('find', () => {
    it('tries fallbacks in order and returns first success', async () => {
      const failLocator = createMockLocator({ count: 0 });
      const successLocator = createMockLocator({ count: 1 });

      let callCount = 0;
      mockPage.locator = vi.fn().mockImplementation((selector: string) => {
        callCount++;
        if (selector === '#fallback2') return successLocator;
        return failLocator;
      });
      strategy = new FallbackStrategy(mockPage);

      const step = createMockStep({
        smartSelector: {
          primary: { strategy: 'css', value: '#primary', confidence: 100 },
          fallbacks: [
            { strategy: 'css', value: '#fallback1', confidence: 90 },
            { strategy: 'css', value: '#fallback2', confidence: 80 },
            { strategy: 'css', value: '#fallback3', confidence: 70 },
          ],
          coordinates: { x: 0, y: 0, width: 10, height: 10 },
          elementHash: 'hash',
        },
      });

      const result = await strategy.find(step);

      expect(result.success).toBe(true);
      expect(result.selector).toBe('#fallback2');
      expect(result.record).toBeDefined();
      expect(result.record?.originalSelector).toBe('#primary');
      expect(result.record?.healedSelector).toBe('#fallback2');
    });

    it('returns failure when all fallbacks fail', async () => {
      const failLocator = createMockLocator({ count: 0 });
      mockPage = createMockPage({ locatorResult: failLocator });
      strategy = new FallbackStrategy(mockPage);

      const step = createMockStep({
        smartSelector: {
          primary: { strategy: 'css', value: '#primary', confidence: 100 },
          fallbacks: [
            { strategy: 'css', value: '#fallback1', confidence: 90 },
          ],
          coordinates: { x: 0, y: 0, width: 10, height: 10 },
          elementHash: 'hash',
        },
      });

      const result = await strategy.find(step);

      expect(result.success).toBe(false);
    });

    it('skips text/label/role strategies for input actions', async () => {
      const successLocator = createMockLocator({ count: 1 });
      mockPage = createMockPage({ locatorResult: successLocator });
      strategy = new FallbackStrategy(mockPage);

      const step = createMockStep({
        action: 'type',
        smartSelector: {
          primary: { strategy: 'css', value: '#primary', confidence: 100 },
          fallbacks: [
            { strategy: 'text', value: 'Submit', confidence: 90 },
            { strategy: 'label', value: 'Email', confidence: 85 },
            { strategy: 'css', value: '#input-email', confidence: 80 },
          ],
          coordinates: { x: 0, y: 0, width: 10, height: 10 },
          elementHash: 'hash',
        },
      });

      const result = await strategy.find(step);

      expect(result.success).toBe(true);
      expect(result.selector).toBe('#input-email');
    });

    it('creates healing record with correct data', async () => {
      const successLocator = createMockLocator({ count: 1 });
      mockPage = createMockPage({ locatorResult: successLocator });
      strategy = new FallbackStrategy(mockPage);

      const step = createMockStep({
        smartSelector: {
          primary: { strategy: 'css', value: '#old-selector', confidence: 100 },
          fallbacks: [
            { strategy: 'testId', value: 'new-button', confidence: 90 },
          ],
          coordinates: { x: 0, y: 0, width: 10, height: 10 },
          elementHash: 'hash',
        },
      });

      const result = await strategy.find(step);

      expect(result.record).toBeDefined();
      expect(result.record?.originalSelector).toBe('#old-selector');
      expect(result.record?.healedSelector).toBe('new-button');
      expect(result.record?.strategy).toBe('testId');
      expect(result.record?.success).toBe(true);
      expect(result.record?.timestamp).toBeGreaterThan(0);
    });
  });

  describe('priority', () => {
    it('has priority 3', () => {
      expect(strategy.priority).toBe(3);
    });
  });
});
