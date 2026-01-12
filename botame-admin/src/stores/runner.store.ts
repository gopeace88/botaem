import { create } from 'zustand';
import { Playbook, PlaybookStep } from '../../shared/types';

export type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export interface PickedElement {
  selector: string;
  elementInfo: {
    tagName: string;
    id?: string;
    className?: string;
    text?: string;
    ariaLabel?: string;
    name?: string;
    placeholder?: string;
    type?: string;
  };
}

export interface StepResult {
  stepId: string;
  stepIndex: number;
  status: StepStatus;
  message?: string;
  error?: string;
  duration?: number;
  screenshot?: string;
  // 자동 고침 결과
  healed?: boolean;
  healedSelector?: string;
  originalSelector?: string;
  healMethod?: 'fallback' | 'text' | 'aria' | 'dynamic' | 'manual';
}

export interface RunnerState {
  isRunning: boolean;
  currentStepIndex: number;
  totalSteps: number;
  results: StepResult[];
  startTime?: number;
  endTime?: number;
}

interface RunnerEvent {
  type: 'started' | 'step_started' | 'step_completed' | 'completed' | 'error' | 'paused' | 'resumed';
  state: RunnerState;
  stepResult?: StepResult;
  error?: string;
}

interface RunnerStoreState {
  playbook: Playbook | null;
  state: RunnerState;
  isPaused: boolean;
  isPicking: boolean;
  error: string | null;

  // Actions
  setPlaybook: (playbook: Playbook | null) => void;
  run: (playbookId: string, startUrl?: string) => Promise<boolean>;
  runFromCatalog: (playbookId: string, startUrl?: string) => Promise<boolean>;
  runSingleStep: (step: PlaybookStep, stepIndex: number) => Promise<StepResult>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  closeBrowser: () => Promise<void>;
  handleEvent: (event: RunnerEvent) => void;
  reset: () => void;

  // Element picking
  pickElement: () => Promise<PickedElement | null>;
  cancelPicking: () => Promise<void>;

  // Element highlighting
  highlightElement: (selector: string) => Promise<{ success: boolean; error?: string }>;
  clearHighlight: () => Promise<void>;
}

const initialState: RunnerState = {
  isRunning: false,
  currentStepIndex: -1,
  totalSteps: 0,
  results: [],
};

export const useRunnerStore = create<RunnerStoreState>((set) => ({
  playbook: null,
  state: initialState,
  isPaused: false,
  isPicking: false,
  error: null,

  setPlaybook: (playbook) => {
    set({ playbook, state: initialState, error: null });
  },

  run: async (playbookId, startUrl) => {
    set({ error: null });
    try {
      const result = await window.electron.invoke('runner:run', playbookId, startUrl) as {
        success: boolean;
        error?: string;
        data?: StepResult[];
      };

      if (!result.success) {
        set({ error: result.error || '실행 실패' });
        return false;
      }
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '실행 오류' });
      return false;
    }
  },

  runFromCatalog: async (playbookId, startUrl) => {
    set({ error: null });
    try {
      const result = await window.electron.invoke('runner:runFromCatalog', playbookId, startUrl) as {
        success: boolean;
        error?: string;
        data?: StepResult[];
      };

      if (!result.success) {
        set({ error: result.error || '카탈로그 플레이북 실행 실패' });
        return false;
      }
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '카탈로그 플레이북 실행 오류' });
      return false;
    }
  },

  runSingleStep: async (step, stepIndex) => {
    set({ error: null });
    try {
      const result = await window.electron.invoke('runner:runStep', step, stepIndex) as StepResult;
      return result;
    } catch (error) {
      return {
        stepId: step.id,
        stepIndex,
        status: 'failed' as StepStatus,
        error: error instanceof Error ? error.message : '스텝 실행 오류',
      };
    }
  },

  pause: async () => {
    await window.electron.invoke('runner:pause');
    set({ isPaused: true });
  },

  resume: async () => {
    await window.electron.invoke('runner:resume');
    set({ isPaused: false });
  },

  stop: async () => {
    await window.electron.invoke('runner:stop');
    set({ isPaused: false });
  },

  closeBrowser: async () => {
    await window.electron.invoke('runner:closeBrowser');
    set({ state: initialState, isPaused: false });
  },

  handleEvent: (event) => {
    switch (event.type) {
      case 'started':
        set({ state: event.state, isPaused: false, error: null });
        break;
      case 'step_started':
      case 'step_completed':
        set({ state: event.state });
        break;
      case 'completed':
        set({ state: event.state, isPaused: false });
        break;
      case 'paused':
        set({ isPaused: true });
        break;
      case 'resumed':
        set({ isPaused: false });
        break;
      case 'error':
        set({ error: event.error || '알 수 없는 오류' });
        break;
    }
  },

  reset: () => {
    set({ playbook: null, state: initialState, isPaused: false, isPicking: false, error: null });
  },

  pickElement: async () => {
    set({ isPicking: true, error: null });
    try {
      const result = await window.electron.invoke('runner:pickElement') as {
        success: boolean;
        error?: string;
        data?: PickedElement;
      };

      set({ isPicking: false });

      if (!result.success || !result.data) {
        if (result.error) {
          set({ error: result.error });
        }
        return null;
      }
      return result.data;
    } catch (error) {
      set({ isPicking: false, error: error instanceof Error ? error.message : '요소 선택 오류' });
      return null;
    }
  },

  cancelPicking: async () => {
    await window.electron.invoke('runner:cancelPicking');
    set({ isPicking: false });
  },

  highlightElement: async (selector: string) => {
    try {
      const result = await window.electron.invoke('browser:highlight', selector) as {
        success: boolean;
        error?: string;
      };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '하이라이트 오류',
      };
    }
  },

  clearHighlight: async () => {
    try {
      await window.electron.invoke('browser:clearHighlight');
    } catch (error) {
      console.error('[RunnerStore] Clear highlight error:', error);
    }
  },
}));

// Subscribe to runner events
if (typeof window !== 'undefined') {
  window.electron.on('runner:event', (event) => {
    useRunnerStore.getState().handleEvent(event as RunnerEvent);
  });
}
