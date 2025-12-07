import { create } from 'zustand';
import { Playbook, PlaybookStep, ExecutionStatus } from '@electron/playbook/types';

// Store state interface
interface PlaybookState {
  playbook: Playbook | null;
  status: ExecutionStatus;
  currentStepIndex: number;
  variables: Record<string, unknown>;
}

// Store actions interface
interface PlaybookActions {
  // Playbook management
  loadPlaybook: (playbook: Playbook) => void;

  // Execution status
  setStatus: (status: ExecutionStatus) => void;

  // Step management
  setCurrentStepIndex: (index: number) => void;
  getCurrentStep: () => PlaybookStep | null;
  nextStep: () => void;
  previousStep: () => void;

  // Variables
  setVariables: (vars: Record<string, unknown>) => void;
  clearVariables: () => void;

  // Progress
  getProgress: () => { current: number; total: number; percentage: number };

  // Reset
  reset: () => void;
}

// Combined store type
type PlaybookStore = PlaybookState & PlaybookActions;

// Initial state
const initialState: PlaybookState = {
  playbook: null,
  status: 'idle',
  currentStepIndex: 0,
  variables: {},
};

// Create the store
export const usePlaybookStore = create<PlaybookStore>((set, get) => ({
  // Initial state
  ...initialState,

  // Playbook management
  loadPlaybook: (playbook: Playbook) => {
    set({
      playbook,
      currentStepIndex: 0,
      status: 'idle',
    });
  },

  // Execution status
  setStatus: (status: ExecutionStatus) => {
    set({ status });
  },

  // Step management
  setCurrentStepIndex: (index: number) => {
    set({ currentStepIndex: index });
  },

  getCurrentStep: () => {
    const { playbook, currentStepIndex } = get();
    if (!playbook) return null;
    return playbook.steps[currentStepIndex] || null;
  },

  nextStep: () => {
    const { playbook, currentStepIndex } = get();
    if (!playbook) return;

    const maxIndex = playbook.steps.length - 1;
    if (currentStepIndex < maxIndex) {
      set({ currentStepIndex: currentStepIndex + 1 });
    }
  },

  previousStep: () => {
    const { currentStepIndex } = get();
    if (currentStepIndex > 0) {
      set({ currentStepIndex: currentStepIndex - 1 });
    }
  },

  // Variables
  setVariables: (vars: Record<string, unknown>) => {
    const { variables } = get();
    set({ variables: { ...variables, ...vars } });
  },

  clearVariables: () => {
    set({ variables: {} });
  },

  // Progress
  getProgress: () => {
    const { playbook, currentStepIndex } = get();
    if (!playbook || playbook.steps.length === 0) {
      return { current: 0, total: 0, percentage: 0 };
    }

    const total = playbook.steps.length;
    const current = currentStepIndex;
    const percentage = Math.round((current / total) * 100);

    return { current, total, percentage };
  },

  // Reset
  reset: () => {
    set(initialState);
  },
}));
