/**
 * Recording Service
 * Captures user actions in the browser and generates playbook steps
 */

import { Page } from 'playwright';
import { PlaybookStep, StepAction, Playbook, PlaybookMetadata, Category, Difficulty } from '../playbook/types';
import { BotameAutomation } from './botame.automation';

// Recorded action from browser
export interface RecordedAction {
  type: 'click' | 'type' | 'navigate' | 'select';
  timestamp: number;
  url: string;
  selector: string;
  value?: string;
  elementInfo: {
    tagName: string;
    id?: string;
    name?: string;
    className?: string;
    textContent?: string;
    role?: string;
    ariaLabel?: string;
    placeholder?: string;
    type?: string;
  };
}

// Recording state
export type RecordingState = 'idle' | 'recording' | 'paused';

// Recording options
export interface RecordingOptions {
  captureNavigation?: boolean;
  captureClicks?: boolean;
  captureInputs?: boolean;
  captureSelects?: boolean;
  debounceMs?: number;
}

// Event callback types
export type RecordingEventCallback = (event: RecordingEvent) => void;

export type RecordingEvent =
  | { type: 'started' }
  | { type: 'stopped'; steps: PlaybookStep[] }
  | { type: 'paused' }
  | { type: 'resumed' }
  | { type: 'action_recorded'; action: RecordedAction; step: PlaybookStep }
  | { type: 'error'; error: string };

export class RecordingService {
  private automation: BotameAutomation;
  private state: RecordingState = 'idle';
  private recordedActions: RecordedAction[] = [];
  private eventCallback: RecordingEventCallback | null = null;
  private options: Required<RecordingOptions>;
  private lastInputValue: Map<string, string> = new Map();
  private startUrl: string = '';

  constructor(automation: BotameAutomation) {
    this.automation = automation;
    this.options = {
      captureNavigation: true,
      captureClicks: true,
      captureInputs: true,
      captureSelects: true,
      debounceMs: 500,
    };
  }

  /**
   * Set event callback for recording events
   */
  onEvent(callback: RecordingEventCallback): void {
    this.eventCallback = callback;
  }

  /**
   * Emit event to callback
   */
  private emit(event: RecordingEvent): void {
    if (this.eventCallback) {
      this.eventCallback(event);
    }
  }

  /**
   * Get current recording state
   */
  getState(): RecordingState {
    return this.state;
  }

  /**
   * Get recorded steps
   */
  getRecordedSteps(): PlaybookStep[] {
    return this.recordedActions.map((action, index) => this.actionToStep(action, index));
  }

  /**
   * Get recorded actions (raw)
   */
  getRecordedActions(): RecordedAction[] {
    return [...this.recordedActions];
  }

  /**
   * Start recording user actions
   */
  async startRecording(options?: RecordingOptions): Promise<boolean> {
    const page = this.automation.getPage();
    if (!page) {
      this.emit({ type: 'error', error: '브라우저가 초기화되지 않았습니다.' });
      return false;
    }

    if (this.state === 'recording') {
      this.emit({ type: 'error', error: '이미 녹화 중입니다.' });
      return false;
    }

    // Apply options
    if (options) {
      this.options = { ...this.options, ...options };
    }

    // Clear previous recordings
    this.recordedActions = [];
    this.lastInputValue.clear();
    this.startUrl = page.url();

    try {
      // Expose function for receiving actions from browser
      await page.exposeFunction('__botameRecordAction', (action: RecordedAction) => {
        this.handleRecordedAction(action);
      });
    } catch (e) {
      // Function might already be exposed from previous session
      console.log('[Recording] exposeFunction already exists, continuing...');
    }

    // Inject recording script
    await this.injectRecordingScript(page);

    // Listen for page navigation
    if (this.options.captureNavigation) {
      page.on('framenavigated', (frame) => {
        if (frame === page.mainFrame()) {
          const url = frame.url();
          // Only record if URL actually changed
          if (this.recordedActions.length === 0 ||
              this.recordedActions[this.recordedActions.length - 1].url !== url) {
            this.handleRecordedAction({
              type: 'navigate',
              timestamp: Date.now(),
              url,
              selector: '',
              elementInfo: { tagName: '' },
            });
          }
        }
      });
    }

    this.state = 'recording';
    this.emit({ type: 'started' });
    console.log('[Recording] Started recording user actions');
    return true;
  }

  /**
   * Inject recording script into the page
   */
  private async injectRecordingScript(page: Page): Promise<void> {
    await page.addInitScript(() => {
      // Prevent double injection
      if ((window as any).__botameRecordingActive) return;
      (window as any).__botameRecordingActive = true;

      // Generate optimal selector for element
      function generateSelector(el: Element): string {
        // Priority 1: data-testid
        const testId = el.getAttribute('data-testid');
        if (testId) return `[data-testid="${testId}"]`;

        // Priority 2: role + name (accessibility)
        const role = el.getAttribute('role') || (el as HTMLElement).role;
        const ariaLabel = el.getAttribute('aria-label');
        if (role && ariaLabel) {
          return `role=${role}[name="${ariaLabel}"]`;
        }

        // Priority 3: id
        const id = el.id;
        if (id && !id.match(/^[0-9]/) && !id.includes(':')) {
          return `#${id}`;
        }

        // Priority 4: name attribute (for inputs)
        const name = el.getAttribute('name');
        if (name) {
          return `[name="${name}"]`;
        }

        // Priority 5: unique text content for buttons/links
        const tagName = el.tagName.toLowerCase();
        if (['button', 'a', 'span'].includes(tagName)) {
          const text = el.textContent?.trim();
          if (text && text.length < 50 && !text.includes('\n')) {
            return `text=${text}`;
          }
        }

        // Priority 6: type attribute for inputs
        if (tagName === 'input') {
          const type = (el as HTMLInputElement).type || 'text';
          const placeholder = el.getAttribute('placeholder');
          if (placeholder) {
            return `input[type="${type}"][placeholder="${placeholder}"]`;
          }
          return `input[type="${type}"]`;
        }

        // Priority 7: CSS selector with nth-of-type
        const parent = el.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
          if (siblings.length === 1) {
            const parentSelector = generateSelector(parent);
            return `${parentSelector} > ${tagName}`;
          }
          const index = siblings.indexOf(el) + 1;
          return `${tagName}:nth-of-type(${index})`;
        }

        return tagName;
      }

      // Get element info
      function getElementInfo(el: Element): any {
        return {
          tagName: el.tagName.toLowerCase(),
          id: el.id || undefined,
          name: el.getAttribute('name') || undefined,
          className: el.className || undefined,
          textContent: el.textContent?.trim().slice(0, 100) || undefined,
          role: el.getAttribute('role') || undefined,
          ariaLabel: el.getAttribute('aria-label') || undefined,
          placeholder: el.getAttribute('placeholder') || undefined,
          type: (el as HTMLInputElement).type || undefined,
        };
      }

      // Click handler
      document.addEventListener('click', (e) => {
        const target = e.target as Element;
        if (!target) return;

        // Ignore clicks on recording UI (if any)
        if (target.closest('[data-botame-recording-ui]')) return;

        const action = {
          type: 'click' as const,
          timestamp: Date.now(),
          url: window.location.href,
          selector: generateSelector(target),
          elementInfo: getElementInfo(target),
        };

        (window as any).__botameRecordAction?.(action);
      }, true);

      // Input handler (debounced)
      let inputTimer: any = null;
      document.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement | HTMLTextAreaElement;
        if (!target) return;

        // Clear previous timer
        if (inputTimer) clearTimeout(inputTimer);

        // Debounce input events
        inputTimer = setTimeout(() => {
          const action = {
            type: 'type' as const,
            timestamp: Date.now(),
            url: window.location.href,
            selector: generateSelector(target),
            value: target.value,
            elementInfo: getElementInfo(target),
          };

          (window as any).__botameRecordAction?.(action);
        }, 500);
      }, true);

      // Select change handler
      document.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        if (target.tagName !== 'SELECT') return;

        const action = {
          type: 'select' as const,
          timestamp: Date.now(),
          url: window.location.href,
          selector: generateSelector(target),
          value: target.value,
          elementInfo: getElementInfo(target),
        };

        (window as any).__botameRecordAction?.(action);
      }, true);

      console.log('[Botame Recording] Script injected and active');
    });

    // Also inject into current page context immediately using evaluate
    await page.evaluate(() => {
      // Prevent double injection
      if ((window as any).__botameRecordingActive) return;
      (window as any).__botameRecordingActive = true;

      // Generate optimal selector for element
      function generateSelector(el: Element): string {
        // Priority 1: data-testid
        const testId = el.getAttribute('data-testid');
        if (testId) return `[data-testid="${testId}"]`;

        // Priority 2: role + name (accessibility)
        const role = el.getAttribute('role') || (el as HTMLElement).role;
        const ariaLabel = el.getAttribute('aria-label');
        if (role && ariaLabel) {
          return `role=${role}[name="${ariaLabel}"]`;
        }

        // Priority 3: id
        const id = el.id;
        if (id && !id.match(/^[0-9]/) && !id.includes(':')) {
          return `#${id}`;
        }

        // Priority 4: name attribute (for inputs)
        const name = el.getAttribute('name');
        if (name) {
          return `[name="${name}"]`;
        }

        // Priority 5: unique text content for buttons/links
        const tagName = el.tagName.toLowerCase();
        if (['button', 'a', 'span'].includes(tagName)) {
          const text = el.textContent?.trim();
          if (text && text.length < 50 && !text.includes('\n')) {
            return `text=${text}`;
          }
        }

        // Priority 6: type attribute for inputs
        if (tagName === 'input') {
          const type = (el as HTMLInputElement).type || 'text';
          const placeholder = el.getAttribute('placeholder');
          if (placeholder) {
            return `input[type="${type}"][placeholder="${placeholder}"]`;
          }
          return `input[type="${type}"]`;
        }

        // Priority 7: CSS selector with nth-of-type
        const parent = el.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
          if (siblings.length === 1) {
            const parentSelector = generateSelector(parent);
            return `${parentSelector} > ${tagName}`;
          }
          const index = siblings.indexOf(el) + 1;
          return `${tagName}:nth-of-type(${index})`;
        }

        return tagName;
      }

      // Get element info
      function getElementInfo(el: Element): any {
        return {
          tagName: el.tagName.toLowerCase(),
          id: el.id || undefined,
          name: el.getAttribute('name') || undefined,
          className: el.className || undefined,
          textContent: el.textContent?.trim().slice(0, 100) || undefined,
          role: el.getAttribute('role') || undefined,
          ariaLabel: el.getAttribute('aria-label') || undefined,
          placeholder: el.getAttribute('placeholder') || undefined,
          type: (el as HTMLInputElement).type || undefined,
        };
      }

      // Click handler
      document.addEventListener('click', (e) => {
        const target = e.target as Element;
        if (!target) return;

        // Ignore clicks on recording UI (if any)
        if (target.closest('[data-botame-recording-ui]')) return;

        const action = {
          type: 'click' as const,
          timestamp: Date.now(),
          url: window.location.href,
          selector: generateSelector(target),
          elementInfo: getElementInfo(target),
        };

        console.log('[Botame Recording] Click captured:', action.selector);
        (window as any).__botameRecordAction?.(action);
      }, true);

      // Input handler (debounced)
      let inputTimer: any = null;
      document.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement | HTMLTextAreaElement;
        if (!target) return;

        // Clear previous timer
        if (inputTimer) clearTimeout(inputTimer);

        // Debounce input events
        inputTimer = setTimeout(() => {
          const action = {
            type: 'type' as const,
            timestamp: Date.now(),
            url: window.location.href,
            selector: generateSelector(target),
            value: target.value,
            elementInfo: getElementInfo(target),
          };

          console.log('[Botame Recording] Input captured:', action.selector);
          (window as any).__botameRecordAction?.(action);
        }, 500);
      }, true);

      // Select change handler
      document.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        if (target.tagName !== 'SELECT') return;

        const action = {
          type: 'select' as const,
          timestamp: Date.now(),
          url: window.location.href,
          selector: generateSelector(target),
          value: target.value,
          elementInfo: getElementInfo(target),
        };

        console.log('[Botame Recording] Select captured:', action.selector);
        (window as any).__botameRecordAction?.(action);
      }, true);

      console.log('[Botame Recording] Activated on current page');
    });
  }

  /**
   * Handle recorded action from browser
   */
  private handleRecordedAction(action: RecordedAction): void {
    if (this.state !== 'recording') return;

    // Filter actions based on options
    if (action.type === 'click' && !this.options.captureClicks) return;
    if (action.type === 'type' && !this.options.captureInputs) return;
    if (action.type === 'select' && !this.options.captureSelects) return;
    if (action.type === 'navigate' && !this.options.captureNavigation) return;

    // Deduplicate consecutive navigate events to same URL
    if (action.type === 'navigate' && this.recordedActions.length > 0) {
      const lastAction = this.recordedActions[this.recordedActions.length - 1];
      if (lastAction.type === 'navigate' && lastAction.url === action.url) {
        return;
      }
    }

    // For type actions, update if same selector
    if (action.type === 'type') {
      const existingIndex = this.recordedActions.findIndex(
        a => a.type === 'type' && a.selector === action.selector
      );
      if (existingIndex >= 0) {
        // Update existing action with new value
        this.recordedActions[existingIndex] = action;
        const step = this.actionToStep(action, existingIndex);
        this.emit({ type: 'action_recorded', action, step });
        return;
      }
    }

    // Add new action
    this.recordedActions.push(action);
    const step = this.actionToStep(action, this.recordedActions.length - 1);
    this.emit({ type: 'action_recorded', action, step });

    console.log('[Recording] Action recorded:', action.type, action.selector);
  }

  /**
   * Convert recorded action to playbook step
   */
  private actionToStep(action: RecordedAction, index: number): PlaybookStep {
    const stepId = `step${index + 1}`;

    switch (action.type) {
      case 'navigate':
        return {
          id: stepId,
          action: 'navigate' as StepAction,
          value: action.url,
          message: `${new URL(action.url).pathname} 페이지로 이동합니다`,
        };

      case 'click':
        return {
          id: stepId,
          action: 'click' as StepAction,
          selector: action.selector,
          message: this.generateClickMessage(action),
          timeout: 5000,
        };

      case 'type':
        return {
          id: stepId,
          action: 'type' as StepAction,
          selector: action.selector,
          value: action.value || '',
          message: this.generateTypeMessage(action),
          timeout: 5000,
        };

      case 'select':
        return {
          id: stepId,
          action: 'select' as StepAction,
          selector: action.selector,
          value: action.value || '',
          message: `옵션을 선택합니다: ${action.value}`,
          timeout: 5000,
        };

      default:
        return {
          id: stepId,
          action: 'wait' as StepAction,
          timeout: 1000,
          message: '대기 중...',
        };
    }
  }

  /**
   * Generate human-readable message for click action
   */
  private generateClickMessage(action: RecordedAction): string {
    const { elementInfo } = action;

    // Use aria-label if available
    if (elementInfo.ariaLabel) {
      return `${elementInfo.ariaLabel} 클릭`;
    }

    // Use text content for buttons
    if (elementInfo.textContent && ['button', 'a', 'span'].includes(elementInfo.tagName)) {
      return `"${elementInfo.textContent.slice(0, 30)}" 클릭`;
    }

    // Use placeholder for inputs
    if (elementInfo.placeholder) {
      return `${elementInfo.placeholder} 입력란 클릭`;
    }

    // Generic message
    return `${elementInfo.tagName} 요소 클릭`;
  }

  /**
   * Generate human-readable message for type action
   */
  private generateTypeMessage(action: RecordedAction): string {
    const { elementInfo } = action;

    // Check if it's a password field
    if (elementInfo.type === 'password') {
      return '비밀번호 입력';
    }

    // Use placeholder or aria-label
    if (elementInfo.placeholder) {
      return `${elementInfo.placeholder} 입력`;
    }
    if (elementInfo.ariaLabel) {
      return `${elementInfo.ariaLabel} 입력`;
    }

    // Generic message
    return '텍스트 입력';
  }

  /**
   * Stop recording and return steps
   */
  async stopRecording(): Promise<PlaybookStep[]> {
    if (this.state === 'idle') {
      return [];
    }

    this.state = 'idle';
    const steps = this.getRecordedSteps();

    // Add initial navigate step if recording started on a specific page
    if (this.startUrl && steps.length > 0 && steps[0].action !== 'navigate') {
      steps.unshift({
        id: 'step0',
        action: 'navigate',
        value: this.startUrl,
        message: `${new URL(this.startUrl).pathname} 페이지로 이동합니다`,
      });
      // Renumber steps
      steps.forEach((step, i) => {
        step.id = `step${i + 1}`;
      });
    }

    this.emit({ type: 'stopped', steps });
    console.log('[Recording] Stopped. Total steps:', steps.length);

    return steps;
  }

  /**
   * Pause recording
   */
  pauseRecording(): void {
    if (this.state === 'recording') {
      this.state = 'paused';
      this.emit({ type: 'paused' });
      console.log('[Recording] Paused');
    }
  }

  /**
   * Resume recording
   */
  resumeRecording(): void {
    if (this.state === 'paused') {
      this.state = 'recording';
      this.emit({ type: 'resumed' });
      console.log('[Recording] Resumed');
    }
  }

  /**
   * Clear recorded actions
   */
  clearRecording(): void {
    this.recordedActions = [];
    this.lastInputValue.clear();
    console.log('[Recording] Cleared all recorded actions');
  }

  /**
   * Delete a specific step
   */
  deleteStep(stepIndex: number): void {
    if (stepIndex >= 0 && stepIndex < this.recordedActions.length) {
      this.recordedActions.splice(stepIndex, 1);
      console.log('[Recording] Deleted step at index:', stepIndex);
    }
  }

  /**
   * Update a step's properties
   */
  updateStep(stepIndex: number, updates: Partial<PlaybookStep>): void {
    if (stepIndex >= 0 && stepIndex < this.recordedActions.length) {
      const action = this.recordedActions[stepIndex];
      if (updates.selector) action.selector = updates.selector;
      if (updates.value !== undefined) action.value = updates.value;
      console.log('[Recording] Updated step at index:', stepIndex);
    }
  }

  /**
   * Generate complete playbook from recorded steps
   */
  generatePlaybook(metadata: {
    id: string;
    name: string;
    description?: string;
    category?: Category;
    difficulty?: Difficulty;
  }): Playbook {
    const steps = this.getRecordedSteps();

    // Add guide step at the beginning
    steps.unshift({
      id: 'step0',
      action: 'guide',
      message: `${metadata.name}을(를) 시작합니다.`,
    });

    // Renumber steps
    steps.forEach((step, i) => {
      step.id = `step${i + 1}`;
    });

    // Add completion guide step
    steps.push({
      id: `step${steps.length + 1}`,
      action: 'guide',
      message: `${metadata.name}이(가) 완료되었습니다.`,
    });

    const playbookMetadata: PlaybookMetadata = {
      id: metadata.id,
      name: metadata.name,
      version: '1.0.0',
      description: metadata.description || `${metadata.name} 자동화 플레이북`,
      category: metadata.category || '기타',
      difficulty: metadata.difficulty || '보통',
      keywords: [metadata.name],
    };

    return {
      metadata: playbookMetadata,
      steps,
    };
  }
}

// Factory function
export function createRecordingService(automation: BotameAutomation): RecordingService {
  return new RecordingService(automation);
}
