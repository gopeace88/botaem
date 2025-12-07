import { create } from 'zustand';
import { PlaybookStep } from '@electron/playbook/types';

// Recording state type
export type RecordingState = 'idle' | 'recording' | 'paused';

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

// Store state interface
interface RecordingStoreState {
  state: RecordingState;
  steps: PlaybookStep[];
  actions: RecordedAction[];
  isModalOpen: boolean;
  metadata: {
    id: string;
    name: string;
    description: string;
  };
}

// Store actions interface
interface RecordingStoreActions {
  // Recording control
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<PlaybookStep[]>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  clearRecording: () => void;

  // Step management
  addStep: (step: PlaybookStep) => void;
  deleteStep: (index: number) => Promise<void>;
  updateStep: (index: number, updates: Partial<PlaybookStep>) => Promise<void>;
  setSteps: (steps: PlaybookStep[]) => void;

  // Actions
  addAction: (action: RecordedAction) => void;

  // Modal
  openModal: () => void;
  closeModal: () => void;

  // Metadata
  setMetadata: (metadata: Partial<RecordingStoreState['metadata']>) => void;

  // Save
  savePlaybook: () => Promise<boolean>;

  // Reset
  reset: () => void;
}

// Combined store type
type RecordingStore = RecordingStoreState & RecordingStoreActions;

// Initial state
const initialState: RecordingStoreState = {
  state: 'idle',
  steps: [],
  actions: [],
  isModalOpen: false,
  metadata: {
    id: '',
    name: '',
    description: '',
  },
};

// Create the store
export const useRecordingStore = create<RecordingStore>((set, get) => ({
  // Initial state
  ...initialState,

  // Recording control
  startRecording: async () => {
    try {
      const result = await window.electron.invoke('recording:start') as { success: boolean };
      if (result.success) {
        set({ state: 'recording', steps: [], actions: [] });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to start recording:', error);
      return false;
    }
  },

  stopRecording: async () => {
    try {
      const result = await window.electron.invoke('recording:stop') as {
        success: boolean;
        data?: PlaybookStep[];
      };
      if (result.success && result.data) {
        set({ state: 'idle', steps: result.data });
        return result.data;
      }
      set({ state: 'idle' });
      return [];
    } catch (error) {
      console.error('Failed to stop recording:', error);
      set({ state: 'idle' });
      return [];
    }
  },

  pauseRecording: () => {
    window.electron.invoke('recording:pause');
    set({ state: 'paused' });
  },

  resumeRecording: () => {
    window.electron.invoke('recording:resume');
    set({ state: 'recording' });
  },

  clearRecording: () => {
    window.electron.invoke('recording:clear');
    set({ steps: [], actions: [] });
  },

  // Step management
  addStep: (step: PlaybookStep) => {
    const { steps } = get();
    set({ steps: [...steps, step] });
  },

  deleteStep: async (index: number) => {
    await window.electron.invoke('recording:deleteStep', index);
    const { steps } = get();
    const newSteps = [...steps];
    newSteps.splice(index, 1);
    set({ steps: newSteps });
  },

  updateStep: async (index: number, updates: Partial<PlaybookStep>) => {
    await window.electron.invoke('recording:updateStep', index, updates);
    const { steps } = get();
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], ...updates };
    set({ steps: newSteps });
  },

  setSteps: (steps: PlaybookStep[]) => {
    set({ steps });
  },

  // Actions
  addAction: (action: RecordedAction) => {
    const { actions } = get();
    set({ actions: [...actions, action] });
  },

  // Modal
  openModal: () => {
    set({ isModalOpen: true });
  },

  closeModal: () => {
    set({ isModalOpen: false });
  },

  // Metadata
  setMetadata: (metadata: Partial<RecordingStoreState['metadata']>) => {
    const current = get().metadata;
    set({ metadata: { ...current, ...metadata } });
  },

  // Save
  savePlaybook: async () => {
    const { metadata } = get();

    if (!metadata.id || !metadata.name) {
      console.error('Playbook ID and name are required');
      return false;
    }

    try {
      const result = await window.electron.invoke('recording:generatePlaybook', {
        id: metadata.id,
        name: metadata.name,
        description: metadata.description,
      }) as { success: boolean; playbook?: unknown };

      if (result.success && result.playbook) {
        // Save the playbook
        await window.electron.invoke('recording:savePlaybook', result.playbook);
        get().reset();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to save playbook:', error);
      return false;
    }
  },

  // Reset
  reset: () => {
    set(initialState);
  },
}));
