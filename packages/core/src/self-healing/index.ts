export { SelfHealingEngine, type SelfHealingEngineOptions } from './engine';
export type { HealingStrategy } from './strategies/base';
export {
  IdentityStrategy,
  PlaywrightLocatorStrategy,
  FallbackStrategy,
  StructuralStrategy,
  CoordinatesStrategy,
} from './strategies';
