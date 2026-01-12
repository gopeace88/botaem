import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IdentityStrategy } from '../strategies/identity';
import { createMockPage, createMockLocator, createMockStep } from './mocks';
import type { Page } from 'playwright';

describe('IdentityStrategy', () => {
  let mockPage: Page;
  let strategy: IdentityStrategy;

  beforeEach(() => {
    mockPage = createMockPage();
    strategy = new IdentityStrategy(mockPage);
  });

  describe('canHandle', () => {
    it('returns true when step has identity', () => {
      const step = createMockStep({ identity: { tagName: 'BUTTON', backendNodeId: 1, boundingBox: { x: 0, y: 0, width: 10, height: 10 }, capturedAt: Date.now() } });
      expect(strategy.canHandle(step)).toBe(true);
    });

    it('returns false when step has no identity', () => {
      const step = createMockStep({ identity: undefined });
      expect(strategy.canHandle(step)).toBe(false);
    });
  });

  describe('find', () => {
    it('finds element by getByRole when axRole and axName exist', async () => {
      const mockLocator = createMockLocator({ count: 1 });
      mockPage = createMockPage({ getByRoleResult: mockLocator });
      strategy = new IdentityStrategy(mockPage);

      const step = createMockStep({
        identity: {
          tagName: 'BUTTON',
          axRole: 'button',
          axName: 'Submit',
          boundingBox: { x: 0, y: 0, width: 10, height: 10 },
          backendNodeId: 1,
          capturedAt: Date.now(),
        },
      });

      const result = await strategy.find(step);

      expect(result.success).toBe(true);
      expect(result.strategy).toBe('identity');
      expect(mockPage.getByRole).toHaveBeenCalledWith('button', { name: 'Submit' });
    });

    it('finds element by aria-label when axRole fails', async () => {
      const failingLocator = createMockLocator({ count: 0 });
      const successLocator = createMockLocator({ count: 1 });

      mockPage = createMockPage({
        getByRoleResult: failingLocator,
        locatorResult: successLocator,
      });
      strategy = new IdentityStrategy(mockPage);

      const step = createMockStep({
        identity: {
          tagName: 'BUTTON',
          axRole: 'button',
          axName: 'Submit',
          ariaLabel: 'Submit Form',
          boundingBox: { x: 0, y: 0, width: 10, height: 10 },
          backendNodeId: 1,
          capturedAt: Date.now(),
        },
      });

      const result = await strategy.find(step);

      expect(result.success).toBe(true);
    });

    it('returns failure when no strategy matches', async () => {
      const failingLocator = createMockLocator({ count: 0 });
      mockPage = createMockPage({
        getByRoleResult: failingLocator,
        locatorResult: failingLocator,
        getByTestIdResult: failingLocator,
        getByPlaceholderResult: failingLocator,
      });
      strategy = new IdentityStrategy(mockPage);

      const step = createMockStep({
        identity: {
          tagName: 'BUTTON',
          boundingBox: { x: 0, y: 0, width: 10, height: 10 },
          backendNodeId: 1,
          capturedAt: Date.now(),
        },
      });

      const result = await strategy.find(step);

      expect(result.success).toBe(false);
      expect(result.error).toContain('failed');
    });

    it('skips accessibility strategy for input actions with button role', async () => {
      const mockLocator = createMockLocator({ count: 1 });
      mockPage = createMockPage({
        getByRoleResult: mockLocator,
        locatorResult: mockLocator,
      });
      strategy = new IdentityStrategy(mockPage);

      const step = createMockStep({
        action: 'type',
        identity: {
          tagName: 'BUTTON',
          axRole: 'button',
          axName: 'Submit',
          ariaLabel: 'Submit Form',
          boundingBox: { x: 0, y: 0, width: 10, height: 10 },
          backendNodeId: 1,
          capturedAt: Date.now(),
        },
      });

      const result = await strategy.find(step);

      expect(mockPage.getByRole).not.toHaveBeenCalled();
    });
  });

  describe('priority', () => {
    it('has priority 1 (highest)', () => {
      expect(strategy.priority).toBe(1);
    });
  });
});
