import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlaywrightLocatorStrategy } from '../strategies/playwright';
import { createMockPage, createMockLocator, createMockStep } from './mocks';
import type { Page } from 'playwright';

describe('PlaywrightLocatorStrategy', () => {
  let mockPage: Page;
  let strategy: PlaywrightLocatorStrategy;

  beforeEach(() => {
    mockPage = createMockPage();
    strategy = new PlaywrightLocatorStrategy(mockPage);
  });

  describe('canHandle', () => {
    it('returns true when step has smartSelector with primary', () => {
      const step = createMockStep();
      expect(strategy.canHandle(step)).toBe(true);
    });

    it('returns false when step has no smartSelector', () => {
      const step = createMockStep({ smartSelector: undefined });
      expect(strategy.canHandle(step)).toBe(false);
    });
  });

  describe('find', () => {
    it('finds element with CSS selector', async () => {
      const mockLocator = createMockLocator({ count: 1 });
      mockPage = createMockPage({ locatorResult: mockLocator });
      strategy = new PlaywrightLocatorStrategy(mockPage);

      const step = createMockStep({
        smartSelector: {
          primary: { strategy: 'css', value: '#test-button', confidence: 100 },
          fallbacks: [],
          coordinates: { x: 0, y: 0, width: 10, height: 10 },
          elementHash: 'hash',
        },
      });

      const result = await strategy.find(step);

      expect(result.success).toBe(true);
      expect(mockPage.locator).toHaveBeenCalledWith('#test-button');
    });

    it('finds element with testId selector', async () => {
      const mockLocator = createMockLocator({ count: 1 });
      mockPage = createMockPage({ getByTestIdResult: mockLocator });
      strategy = new PlaywrightLocatorStrategy(mockPage);

      const step = createMockStep({
        smartSelector: {
          primary: { strategy: 'testId', value: 'submit-btn', confidence: 100 },
          fallbacks: [],
          coordinates: { x: 0, y: 0, width: 10, height: 10 },
          elementHash: 'hash',
        },
      });

      const result = await strategy.find(step);

      expect(result.success).toBe(true);
      expect(mockPage.getByTestId).toHaveBeenCalledWith('submit-btn');
    });

    it('finds element with placeholder selector', async () => {
      const mockLocator = createMockLocator({ count: 1 });
      mockPage = createMockPage({ getByPlaceholderResult: mockLocator });
      strategy = new PlaywrightLocatorStrategy(mockPage);

      const step = createMockStep({
        smartSelector: {
          primary: { strategy: 'placeholder', value: 'Enter email', confidence: 100 },
          fallbacks: [],
          coordinates: { x: 0, y: 0, width: 10, height: 10 },
          elementHash: 'hash',
        },
      });

      const result = await strategy.find(step);

      expect(result.success).toBe(true);
      expect(mockPage.getByPlaceholder).toHaveBeenCalledWith('Enter email');
    });

    it('skips text strategy for input actions', async () => {
      const step = createMockStep({
        action: 'type',
        smartSelector: {
          primary: { strategy: 'text', value: 'Submit', confidence: 100 },
          fallbacks: [],
          coordinates: { x: 0, y: 0, width: 10, height: 10 },
          elementHash: 'hash',
        },
      });

      const result = await strategy.find(step);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not suitable');
    });

    it('returns failure when element not found', async () => {
      const mockLocator = createMockLocator({ count: 0 });
      mockPage = createMockPage({ locatorResult: mockLocator });
      strategy = new PlaywrightLocatorStrategy(mockPage);

      const step = createMockStep();

      const result = await strategy.find(step);

      expect(result.success).toBe(false);
    });
  });

  describe('priority', () => {
    it('has priority 2', () => {
      expect(strategy.priority).toBe(2);
    });
  });

  describe('createLocatorFromSelector', () => {
    it('handles role selector with name', () => {
      const step = createMockStep({
        smartSelector: {
          primary: { strategy: 'role', value: 'button[name="Submit"]', confidence: 100 },
          fallbacks: [],
          coordinates: { x: 0, y: 0, width: 10, height: 10 },
          elementHash: 'hash',
        },
      });

      strategy.find(step);

      expect(mockPage.getByRole).toHaveBeenCalledWith('button', { name: 'Submit' });
    });

    it('handles xpath selector', async () => {
      const mockLocator = createMockLocator({ count: 1 });
      mockPage = createMockPage({ locatorResult: mockLocator });
      strategy = new PlaywrightLocatorStrategy(mockPage);

      const step = createMockStep({
        smartSelector: {
          primary: { strategy: 'xpath', value: '//button[@id="test"]', confidence: 100 },
          fallbacks: [],
          coordinates: { x: 0, y: 0, width: 10, height: 10 },
          elementHash: 'hash',
        },
      });

      await strategy.find(step);

      expect(mockPage.locator).toHaveBeenCalledWith('xpath=//button[@id="test"]');
    });
  });
});
