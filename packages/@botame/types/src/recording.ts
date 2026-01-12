/**
 * Recording Types - 녹화 관련 타입
 * @module @botame/types/recording
 */

import { ActionType, SelectorInfo } from "./playbook";
import { ElementIdentity } from "./selector";

/** 녹화 상태 */
export type RecordingState = "idle" | "recording" | "paused";

/** 녹화된 액션 */
export interface RecordedAction {
  type: ActionType;
  selector?: string;
  selectors?: SelectorInfo[];
  value?: string;
  timestamp: number;
  clickX?: number;
  clickY?: number;
  elementInfo?: ElementInfo;
}

/** 요소 정보 */
export interface ElementInfo {
  tagName: string;
  id?: string;
  className?: string;
  text?: string;
  placeholder?: string;
  type?: string;
  role?: string;
  ariaLabel?: string;
  name?: string;
  dataTestId?: string;
}

/** 액션 캡처 */
export interface ActionCapture {
  action: ActionType;
  timestamp: number;

  primarySelector: string;
  fallbackSelectors: SelectorInfo[];

  identity: ElementIdentity;

  clickX?: number;
  clickY?: number;
}

export interface CDPEvent {
  type: string;
  [key: string]: unknown;
}

export interface Recorder {
  start(): void;
  recordAction(cdpEvent: CDPEvent): ActionCapture;
  generatePlaybook(): import("./playbook").Playbook;
  stop(): RecordedAction[];
}
