/**
 * Core modules index - 보탬e v2/v3 핵심 모듈
 */

export { SnapshotService } from './snapshot.service';
export { SmartSelectorGenerator } from './smart-selector';
export { Highlighter } from './highlighter';
export type { HighlightOptions } from './highlighter';
export { SelfHealingEngine } from './self-healing';
export type { HealingResult } from './self-healing';

// v3: CDP-First Semantic Recording
export { AccessibilityService } from './accessibility.service';
export type { AccessibilityInfo } from './accessibility.service';
export { SemanticSelectorGenerator } from './semantic-selector';
export type { SemanticSelectorResult } from './semantic-selector';
