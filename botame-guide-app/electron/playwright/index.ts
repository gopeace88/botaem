/**
 * Playwright Controller Module
 *
 * Exports all Playwright-related functionality for browser automation.
 */

// Types
export * from './types';

// Controllers
export { BrowserController } from './browser-controller';
export { PageController } from './page-controller';
export type { ActionOptions, TypeOptions, AssertOptions } from './page-controller';
export { HighlightController } from './highlight-controller';
export { StepExecutor } from './step-executor';
