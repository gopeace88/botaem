/**
 * Playwright Controller Type Definitions
 */

// === Browser Options ===
export interface BrowserLaunchOptions {
  headless?: boolean;
  slowMo?: number;
  devtools?: boolean;
  args?: string[];
}

export interface ContextOptions {
  viewport?: { width: number; height: number } | null;
  userAgent?: string;
  locale?: string;
  timezoneId?: string;
}

// === Highlight Options ===
export interface HighlightOptions {
  selector: string;
  message?: string;
  position?: 'auto' | 'top' | 'bottom' | 'left' | 'right';
  style?: HighlightStyle;
  duration?: number;
}

export interface HighlightStyle {
  color?: string;
  backgroundColor?: string;
  borderWidth?: number;
  pulse?: boolean;
  arrow?: boolean;
}

// === Action Results ===
export interface ActionResult {
  success: boolean;
  error?: Error;
  duration?: number;
  screenshot?: string;
}

export interface NavigateResult extends ActionResult {
  url?: string;
  title?: string;
}

export interface ClickResult extends ActionResult {
  clicked?: boolean;
}

export interface TypeResult extends ActionResult {
  typed?: string;
}

export interface SelectResult extends ActionResult {
  selected?: string[];
}

export interface WaitResult extends ActionResult {
  waited?: number;
}

export interface AssertResult extends ActionResult {
  expected?: string;
  actual?: string;
}

// === Page Info ===
export interface PageInfo {
  url: string;
  title: string;
  viewport: { width: number; height: number };
}

// === Element Info ===
export interface ElementInfo {
  selector: string;
  exists: boolean;
  visible?: boolean;
  enabled?: boolean;
  text?: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// === Controller State ===
export type ControllerState = 'idle' | 'launching' | 'ready' | 'busy' | 'error' | 'closed';

// === Events ===
export type BrowserEvent =
  | 'stateChange'
  | 'pageLoad'
  | 'pageError'
  | 'navigation'
  | 'dialog'
  | 'console';

export interface BrowserEventPayload {
  stateChange: { from: ControllerState; to: ControllerState };
  pageLoad: { url: string; title: string };
  pageError: { error: Error };
  navigation: { url: string };
  dialog: { type: string; message: string };
  console: { type: string; text: string };
}
