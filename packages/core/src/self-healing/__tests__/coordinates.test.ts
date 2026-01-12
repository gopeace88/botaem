import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoordinatesStrategy } from '../strategies/coordinates';
import { createMockPage, createMockStep } from './mocks';
import type { Page } from 'playwright';

describe('CoordinatesStrategy', () => {
  let mockPage: Page;
  let strategy: CoordinatesStrategy;

  beforeEach(() => {
    mockPage = createMockPage();
    strategy = new CoordinatesStrategy(mockPage);
  });

  describe('canHandle', () => {
    it('returns true when step has valid coordinates in smartSelector', () => {
      const step = createMockStep({
        smartSelector: {
          primary: { strategy: 'css', value: '#btn', confidence: 100 },
          fallbacks: [],
          coordinates: { x: 100, y: 200, width: 50, height: 30 },
          elementHash: 'hash',
        },
      });
      expect(strategy.canHandle(step)).toBe(true);
    });

    it('returns true when step has valid boundingBox in identity', () => {
      const step = createMockStep({
        smartSelector: undefined,
        identity: {
          tagName: 'BUTTON',
          boundingBox: { x: 100, y: 200, width: 50, height: 30 },
          backendNodeId: 1,
          capturedAt: Date.now(),
        },
      });
      expect(strategy.canHandle(step)).toBe(true);
    });

    it('returns false when coordinates are invalid (zero width)', () => {
      const step = createMockStep({
        smartSelector: {
          primary: { strategy: 'css', value: '#btn', confidence: 100 },
          fallbacks: [],
          coordinates: { x: 100, y: 200, width: 0, height: 30 },
          elementHash: 'hash',
        },
        identity: undefined,
      });
      expect(strategy.canHandle(step)).toBe(false);
    });

    it('returns false when no coordinates available', () => {
      const step = createMockStep({
        smartSelector: undefined,
        identity: undefined,
      });
      expect(strategy.canHandle(step)).toBe(false);
    });
  });

  describe('find', () => {
    it('returns success when element found at coordinates', async () => {
      mockPage.evaluate = vi.fn().mockResolvedValue({
        tagName: 'BUTTON',
        isVisible: true,
        isInteractive: true,
      });
      strategy = new CoordinatesStrategy(mockPage);

      const step = createMockStep({
        smartSelector: {
          primary: { strategy: 'css', value: '#btn', confidence: 100 },
          fallbacks: [],
          coordinates: { x: 100, y: 200, width: 50, height: 30 },
          elementHash: 'hash',
        },
      });

      const result = await strategy.find(step);

      expect(result.success).toBe(true);
      expect(result.selector).toContain('coordinates(');
      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it('returns failure when no element at coordinates', async () => {
      mockPage.evaluate = vi.fn().mockResolvedValue(null);
      strategy = new CoordinatesStrategy(mockPage);

      const step = createMockStep({
        smartSelector: {
          primary: { strategy: 'css', value: '#btn', confidence: 100 },
          fallbacks: [],
          coordinates: { x: 100, y: 200, width: 50, height: 30 },
          elementHash: 'hash',
        },
      });

      const result = await strategy.find(step);

      expect(result.success).toBe(false);
    });

    it('returns failure when element is not visible', async () => {
      mockPage.evaluate = vi.fn().mockResolvedValue({
        tagName: 'BUTTON',
        isVisible: false,
        isInteractive: true,
      });
      strategy = new CoordinatesStrategy(mockPage);

      const step = createMockStep({
        smartSelector: {
          primary: { strategy: 'css', value: '#btn', confidence: 100 },
          fallbacks: [],
          coordinates: { x: 100, y: 200, width: 50, height: 30 },
          elementHash: 'hash',
        },
      });

      const result = await strategy.find(step);

      expect(result.success).toBe(false);
    });

    it('calculates center coordinates correctly', async () => {
      let capturedCoords: { x: number; y: number } | null = null;
      mockPage.evaluate = vi.fn().mockImplementation((_fn, coords) => {
        capturedCoords = coords;
        return { tagName: 'BUTTON', isVisible: true, isInteractive: true };
      });
      strategy = new CoordinatesStrategy(mockPage);

      const step = createMockStep({
        smartSelector: {
          primary: { strategy: 'css', value: '#btn', confidence: 100 },
          fallbacks: [],
          coordinates: { x: 100, y: 200, width: 50, height: 30 },
          elementHash: 'hash',
        },
      });

      await strategy.find(step);

      expect(capturedCoords).toEqual({ x: 125, y: 215 });
    });
  });

  describe('clickAtCoordinates', () => {
    it('clicks at center of bounding box', async () => {
      await strategy.clickAtCoordinates({ x: 100, y: 200, width: 50, height: 30 });

      expect(mockPage.mouse.click).toHaveBeenCalledWith(125, 215);
    });
  });

  describe('priority', () => {
    it('has priority 5 (lowest)', () => {
      expect(strategy.priority).toBe(5);
    });
  });
});
