/**
 * Healing Types - 자동 고침 관련 타입
 * @module @botame/types/healing
 */

import { SelectorStrategy } from "./playbook";
import { ElementSnapshot } from "./selector";

/** 치유 전략 */
export type HealStrategy =
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

/** 치유 결과 */
export interface HealResult {
  success: boolean;
  strategy?: HealStrategy;
  selector?: string;
  confidence?: number;
  error?: string;
}

/** 치유 컨텍스트 */
export interface HealContext {
  originalSelector: string;
  currentUrl: string;
  stepMessage?: string;
  elementHints?: string[];
}

/** 폴백 셀렉터 시도 결과 */
export interface FallbackAttempt {
  selector: string;
  strategy: SelectorStrategy;
  success: boolean;
  error?: string;
}

/** DOM 스냅샷 */
export interface DOMSnapshot {
  timestamp: number;
  url: string;
  viewport: { width: number; height: number };
  elements: ElementSnapshot[];
}
