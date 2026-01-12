import type { SelectorWithScore } from './playbook';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SmartSelector {
  primary: SelectorWithScore;
  fallbacks: SelectorWithScore[];
  coordinates: BoundingBox;
  elementHash: string;
  snapshot?: ElementSnapshot;
  aiGenerated?: AIGeneratedSelectors;
}

export interface AIGeneratedSelectors {
  selectors: SelectorWithScore[];
  generatedAt: string;
  model: string;
  confidence: number;
  reasoning?: string;
  domContext?: string;
}

export interface ElementSnapshot {
  nodeId: number;
  backendNodeId: number;
  tagName: string;
  attributes: Record<string, string>;
  textContent?: string;
  boundingBox: BoundingBox;
  isVisible: boolean;
  isInViewport: boolean;
  xpath: string;
  cssPath: string;
  parentNodeId?: number;
  role?: string;
  name?: string;
  description?: string;
}

export interface DOMSnapshot {
  timestamp: number;
  url: string;
  viewport: { width: number; height: number };
  elements: ElementSnapshot[];
}

export interface ElementIdentity {
  axRole?: string;
  axName?: string;
  ariaLabel?: string;
  dataTestId?: string;
  name?: string;
  tagName: string;
  id?: string;
  type?: string;
  placeholder?: string;
  boundingBox: BoundingBox;
  visualHash?: string;
  backendNodeId: number;
  textContent?: string;
  capturedAt: number;
  parentRole?: string;
  parentName?: string;
}

export const MATCHING_STRATEGIES = [
  'accessibility',
  'ariaLabel',
  'name',
  'testId',
  'placeholder',
  'text',
  'css',
  'xpath',
  'visual',
  'coordinates',
] as const;

export type MatchingStrategy = (typeof MATCHING_STRATEGIES)[number];
