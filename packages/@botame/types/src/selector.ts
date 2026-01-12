/**
 * Selector Types - 셀렉터 관련 타입 정의
 * @module @botame/types/selector
 */

import type { PlaybookStep, SelectorStrategy } from "./playbook";

/** 신뢰도가 포함된 셀렉터 */
export interface SelectorWithScore {
  strategy: SelectorStrategy;
  value: string;
  confidence: number; // 0-100, 높을수록 안정적
}

// ============================================
// v2: SmartSelector
// ============================================

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** AI 생성 셀렉터 정보 */
export interface AIGeneratedSelectors {
  selectors: SelectorWithScore[];
  generatedAt: string;
  model: string;
  confidence: number;
  reasoning?: string;
  domContext?: string;
}

/** 스마트 셀렉터 */
export interface SmartSelector {
  primary: SelectorWithScore;
  fallbacks: SelectorWithScore[];
  coordinates: BoundingBox;
  elementHash: string;
  snapshot?: ElementSnapshot;
  aiGenerated?: AIGeneratedSelectors;
}

/** 요소 스냅샷 */
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

// ============================================
// v3: ElementIdentity
// ============================================

/** 요소 식별자 (v3) */
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

// ============================================
// v4: Enhanced Fallbacks
// ============================================

/** 텍스트 기반 셀렉터 */
export interface TextBasedSelector {
  type: "exact" | "contains" | "regex";
  value: string;
  pattern?: string;
  selector: string;
  confidence: number;
}

/** 부모 체인 기반 셀렉터 */
export interface ParentChainSelector {
  parentSelector: string;
  childSelector: string;
  fullSelector: string;
  depth: number;
  confidence: number;
}

/** 근처 라벨 기반 셀렉터 */
export interface NearbyLabelSelector {
  labelText: string;
  relationship: "for" | "sibling" | "preceding" | "following" | "parent";
  targetSelector: string;
  confidence: number;
}

/** 확장된 폴백 셀렉터 (v4) */
export interface EnhancedFallbacks {
  textSelectors: TextBasedSelector[];
  parentChainSelectors: ParentChainSelector[];
  nearbyLabelSelectors: NearbyLabelSelector[];
}

/** 구조적 위치 정보 */
export interface StructuralPosition {
  parentChain: ParentInfo[];
  siblingInfo: SiblingInfo;
  nthChild: number;
  nthOfType: number;
  formElementIndex?: number;
}

/** 부모 요소 정보 */
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

/** 형제 요소 정보 */
export interface SiblingInfo {
  prevSiblingText?: string;
  nextSiblingText?: string;
  prevSiblingTag?: string;
  nextSiblingTag?: string;
  totalSiblings: number;
  position: number;
}

/** 텍스트 패턴 */
export interface TextPatterns {
  original: string;
  normalized: string;
  variations: TextVariation[];
  regexPattern: string;
  keywords: string[];
}

/** 텍스트 변형 */
export interface TextVariation {
  type: "korean" | "english" | "mixed" | "abbreviated";
  value: string;
  pattern: string;
}

export type MatchingStrategy =
  | "accessibility"
  | "ariaLabel"
  | "name"
  | "testId"
  | "placeholder"
  | "text"
  | "css"
  | "xpath"
  | "visual"
  | "coordinates";

export type HealMethodV4 =
  | "fallback"
  | "text"
  | "aria"
  | "dynamic"
  | "manual"
  | "parentChain"
  | "nearbyLabel"
  | "textPattern"
  | "structural"
  | "coordinates";

// ============================================
// Semantic Step Types (v2/v3/v4)
// ============================================

/** 대기 조건 */
export interface WaitCondition {
  type: "visible" | "hidden" | "enabled" | "networkIdle" | "custom";
  timeout?: number;
  customScript?: string;
}

/** 실패 처리 전략 */
export type FailureStrategy = "skip" | "retry" | "heal" | "stop" | "ask";

/**
 * 의미론적 워크플로우 스텝 (v2)
 */
export interface SemanticStep extends PlaybookStep {
  smartSelector?: SmartSelector;
  waitCondition?: WaitCondition;
  onFailure?: FailureStrategy;
  healingHistory?: import("./execution").HealingRecord[];
}

/**
 * 확장된 SemanticStep (v3)
 */
export interface SemanticStepV3 extends PlaybookStep {
  identity?: ElementIdentity;
  smartSelector?: SmartSelector;
  waitCondition?: WaitCondition;
  onFailure?: FailureStrategy;
  healingHistory?: import("./execution").HealingRecord[];
}

/**
 * 확장된 SemanticStep (v4)
 */
export interface SemanticStepV4 extends SemanticStepV3 {
  enhancedFallbacks?: EnhancedFallbacks;
  structuralPosition?: StructuralPosition;
  textPatterns?: TextPatterns;
}
