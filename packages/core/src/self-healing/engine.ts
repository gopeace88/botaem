import type { Page } from 'playwright';
import type { SemanticStepV4 } from '../types/execution';
import type { HealingResult, HealingStats, HealStrategy } from '../types/healing';
import type { HealingStrategy } from './strategies/base';
import { IdentityStrategy } from './strategies/identity';
import { PlaywrightLocatorStrategy } from './strategies/playwright';
import { FallbackStrategy } from './strategies/fallback';
import { StructuralStrategy } from './strategies/structural';
import { CoordinatesStrategy } from './strategies/coordinates';

export interface SelfHealingEngineOptions {
  enableIdentity?: boolean;
  enablePlaywright?: boolean;
  enableFallback?: boolean;
  enableStructural?: boolean;
  enableCoordinates?: boolean;
}

const DEFAULT_OPTIONS: Required<SelfHealingEngineOptions> = {
  enableIdentity: true,
  enablePlaywright: true,
  enableFallback: true,
  enableStructural: true,
  enableCoordinates: true,
};

export class SelfHealingEngine {
  private strategies: HealingStrategy[] = [];
  private stats: HealingStats = {
    total: 0,
    byStrategy: {},
    successRate: 0,
  };

  constructor(
    private page: Page,
    options: SelfHealingEngineOptions = {}
  ) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    this.initializeStrategies(opts);
  }

  private initializeStrategies(opts: Required<SelfHealingEngineOptions>): void {
    const strategyClasses: Array<{
      enabled: boolean;
      create: () => HealingStrategy;
    }> = [
      { enabled: opts.enableIdentity, create: () => new IdentityStrategy(this.page) },
      { enabled: opts.enablePlaywright, create: () => new PlaywrightLocatorStrategy(this.page) },
      { enabled: opts.enableFallback, create: () => new FallbackStrategy(this.page) },
      { enabled: opts.enableStructural, create: () => new StructuralStrategy(this.page) },
      { enabled: opts.enableCoordinates, create: () => new CoordinatesStrategy(this.page) },
    ];

    this.strategies = strategyClasses
      .filter((s) => s.enabled)
      .map((s) => s.create())
      .sort((a, b) => a.priority - b.priority);
  }

  async findElement(step: SemanticStepV4): Promise<HealingResult> {
    this.stats.total++;

    for (const strategy of this.strategies) {
      if (!strategy.canHandle(step)) {
        continue;
      }

      try {
        const result = await strategy.find(step);

        if (result.success) {
          this.recordSuccess(strategy.name);
          console.log(`[SelfHealingEngine] Success with ${strategy.name}: ${result.selector}`);
          return result;
        }
      } catch (error) {
        console.error(`[SelfHealingEngine] Strategy ${strategy.name} threw:`, error);
      }
    }

    return {
      success: false,
      strategy: 'coordinates' as HealStrategy,
      error: 'All strategies failed',
    };
  }

  private recordSuccess(strategyName: HealStrategy): void {
    this.stats.byStrategy[strategyName] = (this.stats.byStrategy[strategyName] || 0) + 1;

    const successCount = Object.values(this.stats.byStrategy).reduce((a, b) => a + b, 0);
    this.stats.successRate = (successCount / this.stats.total) * 100;
  }

  getStats(): HealingStats {
    return { ...this.stats };
  }

  getPage(): Page {
    return this.page;
  }

  getStrategies(): readonly HealingStrategy[] {
    return this.strategies;
  }
}
