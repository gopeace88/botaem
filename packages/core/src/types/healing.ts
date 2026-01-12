import type { SelectorStrategy } from './playbook';
import type { MatchingStrategy, ElementIdentity } from './selector';

export interface HealingRecord {
  timestamp: number;
  originalSelector: string;
  healedSelector: string;
  strategy: SelectorStrategy;
  success: boolean;
}

export interface HealingRecordV3 extends HealingRecord {
  matchingStrategy: MatchingStrategy;
  identity?: ElementIdentity;
  attemptedStrategies: MatchingStrategy[];
}

export const HEAL_METHODS = [
  'identity',
  'playwright',
  'fallback',
  'structural',
  'coordinates',
] as const;

export type HealStrategy = (typeof HEAL_METHODS)[number];

export const HEAL_METHODS_V4 = [
  'fallback',
  'text',
  'aria',
  'dynamic',
  'manual',
  'parentChain',
  'nearbyLabel',
  'textPattern',
  'structural',
  'coordinates',
] as const;

export type HealMethodV4 = (typeof HEAL_METHODS_V4)[number];

export interface HealingResult {
  success: boolean;
  strategy: HealStrategy;
  selector?: string;
  record?: HealingRecord;
  error?: string;
}

export interface HealingStats {
  total: number;
  byStrategy: Record<string, number>;
  successRate: number;
}

export interface EnhancedFallbacks {
  textSelectors: TextBasedSelector[];
  parentChainSelectors: ParentChainSelector[];
  nearbyLabelSelectors: NearbyLabelSelector[];
}

export interface TextBasedSelector {
  type: 'exact' | 'contains' | 'regex';
  value: string;
  pattern?: string;
  selector: string;
  confidence: number;
}

export interface ParentChainSelector {
  parentSelector: string;
  childSelector: string;
  fullSelector: string;
  depth: number;
  confidence: number;
}

export interface NearbyLabelSelector {
  labelText: string;
  relationship: 'for' | 'sibling' | 'preceding' | 'following' | 'parent';
  targetSelector: string;
  confidence: number;
}

export interface StructuralPosition {
  parentChain: ParentInfo[];
  siblingInfo: SiblingInfo;
  nthChild: number;
  nthOfType: number;
  formElementIndex?: number;
}

export interface ParentInfo {
  tagName: string;
  id?: string;
  role?: string;
  ariaLabel?: string;
  className?: string;
  selector: string;
  isLandmark: boolean;
  isForm: boolean;
}

export interface SiblingInfo {
  prevSiblingText?: string;
  nextSiblingText?: string;
  prevSiblingTag?: string;
  nextSiblingTag?: string;
  totalSiblings: number;
  position: number;
}

export interface TextPatterns {
  original: string;
  normalized: string;
  variations: TextVariation[];
  regexPattern: string;
  keywords: string[];
}

export interface TextVariation {
  type: 'korean' | 'english' | 'mixed' | 'abbreviated';
  value: string;
  pattern: string;
}
