import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SelfHealingEngine } from '../engine';
import { createMockPage, createMockLocator, createMockStep } from './mocks';
import type { Page } from 'playwright';

describe('SelfHealingEngine', () => {
  let mockPage: Page;
  let engine: SelfHealingEngine;

  beforeEach(() => {
    mockPage = createMockPage();
  });

  describe('constructor', () => {
    it('initializes with all strategies enabled by default', () => {
      engine = new SelfHealingEngine(mockPage);
      const strategies = engine.getStrategies();

      expect(strategies).toHaveLength(5);
      expect(strategies.map((s) => s.name)).toEqual([
        'identity',
        'playwright',
        'fallback',
        'structural',
        'coordinates',
      ]);
    });

    it('respects strategy options', () => {
      engine = new SelfHealingEngine(mockPage, {
        enableIdentity: false,
        enableStructural: false,
      });
      const strategies = engine.getStrategies();

      expect(strategies).toHaveLength(3);
      expect(strategies.map((s) => s.name)).toEqual([
        'playwright',
        'fallback',
        'coordinates',
      ]);
    });

    it('sorts strategies by priority', () => {
      engine = new SelfHealingEngine(mockPage);
      const strategies = engine.getStrategies();

      for (let i = 1; i < strategies.length; i++) {
        expect(strategies[i].priority).toBeGreaterThanOrEqual(strategies[i - 1].priority);
      }
    });
  });

  describe('findElement', () => {
    it('tries strategies in order until success', async () => {
      const successLocator = createMockLocator({ count: 1 });
      mockPage = createMockPage({
        getByRoleResult: createMockLocator({ count: 0 }),
        locatorResult: successLocator,
      });
      engine = new SelfHealingEngine(mockPage);

      const step = createMockStep();

      const result = await engine.findElement(step);

      expect(result.success).toBe(true);
    });

    it('returns failure when all strategies fail', async () => {
      const failLocator = createMockLocator({ count: 0 });
      mockPage = createMockPage({
        getByRoleResult: failLocator,
        locatorResult: failLocator,
        getByTestIdResult: failLocator,
        getByPlaceholderResult: failLocator,
      });
      mockPage.evaluate = vi.fn().mockResolvedValue(null);
      engine = new SelfHealingEngine(mockPage);

      const step = createMockStep({
        identity: undefined,
        smartSelector: {
          primary: { strategy: 'css', value: '#nonexistent', confidence: 100 },
          fallbacks: [],
          coordinates: { x: 0, y: 0, width: 0, height: 0 },
          elementHash: 'hash',
        },
      });

      const result = await engine.findElement(step);

      expect(result.success).toBe(false);
      expect(result.error).toBe('All strategies failed');
    });

    it('skips strategies that cannot handle the step', async () => {
      const successLocator = createMockLocator({ count: 1 });
      mockPage = createMockPage({ locatorResult: successLocator });
      engine = new SelfHealingEngine(mockPage);

      const step = createMockStep({
        identity: undefined,
        smartSelector: {
          primary: { strategy: 'css', value: '#test', confidence: 100 },
          fallbacks: [],
          coordinates: { x: 0, y: 0, width: 0, height: 0 },
          elementHash: 'hash',
        },
      });

      const result = await engine.findElement(step);

      expect(result.success).toBe(true);
      expect(result.strategy).toBe('playwright');
    });
  });

  describe('getStats', () => {
    it('tracks total attempts', async () => {
      const successLocator = createMockLocator({ count: 1 });
      mockPage = createMockPage({ locatorResult: successLocator });
      engine = new SelfHealingEngine(mockPage);

      const step = createMockStep();

      await engine.findElement(step);
      await engine.findElement(step);
      await engine.findElement(step);

      const stats = engine.getStats();

      expect(stats.total).toBe(3);
    });

    it('tracks success by strategy', async () => {
      const successLocator = createMockLocator({ count: 1 });
      mockPage = createMockPage({
        getByRoleResult: successLocator,
      });
      engine = new SelfHealingEngine(mockPage);

      const step = createMockStep();

      await engine.findElement(step);

      const stats = engine.getStats();

      expect(stats.byStrategy['identity']).toBe(1);
    });

    it('calculates success rate', async () => {
      const successLocator = createMockLocator({ count: 1 });
      const failLocator = createMockLocator({ count: 0 });

      mockPage = createMockPage({
        getByRoleResult: successLocator,
        locatorResult: successLocator,
      });
      engine = new SelfHealingEngine(mockPage);

      const step = createMockStep();

      await engine.findElement(step);
      await engine.findElement(step);

      const stats = engine.getStats();

      expect(stats.successRate).toBe(100);
    });
  });

  describe('getPage', () => {
    it('returns the page instance', () => {
      engine = new SelfHealingEngine(mockPage);

      expect(engine.getPage()).toBe(mockPage);
    });
  });
});
