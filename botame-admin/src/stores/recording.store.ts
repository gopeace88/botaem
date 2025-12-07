import { create } from 'zustand';
import { RecordingState, PlaybookStep, PlaybookMetadata, Playbook, IpcResult } from '../../shared/types';
import { usePlaybookStore } from './playbook.store';

interface RecordingStoreState {
  state: RecordingState;
  steps: PlaybookStep[];
  metadata: Partial<PlaybookMetadata>;
  targetUrl: string;
  isModalOpen: boolean;

  // Actions
  setTargetUrl: (url: string) => void;
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  clearRecording: () => void;
  deleteStep: (index: number) => void;
  setMetadata: (metadata: Partial<PlaybookMetadata>) => void;
  openModal: () => void;
  closeModal: () => void;
  savePlaybook: () => Promise<boolean>;
  addStep: (step: PlaybookStep) => void;
}

export const useRecordingStore = create<RecordingStoreState>((set, get) => ({
  state: 'idle',
  steps: [],
  metadata: {
    id: '',
    name: '',
    description: '',
    category: '기타',
    difficulty: '보통',
  },
  targetUrl: '',
  isModalOpen: false,

  setTargetUrl: (url: string) => set({ targetUrl: url }),

  startRecording: async () => {
    try {
      const { targetUrl } = get();
      const result = (await window.electron.invoke(
        'recording:start',
        targetUrl || undefined
      )) as IpcResult;

      if (result.success) {
        set({ state: 'recording', steps: [] });
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
      const result = (await window.electron.invoke('recording:stop')) as IpcResult<PlaybookStep[]>;
      if (result.success && result.data) {
        set({ state: 'idle', steps: result.data });
      } else {
        set({ state: 'idle' });
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      set({ state: 'idle' });
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
    set({
      steps: [],
      metadata: {
        id: '',
        name: '',
        description: '',
        category: '기타',
        difficulty: '보통',
      },
    });
  },

  deleteStep: (index: number) => {
    window.electron.invoke('recording:deleteStep', index);
    set((state) => ({
      steps: state.steps.filter((_, i) => i !== index),
    }));
  },

  setMetadata: (metadata: Partial<PlaybookMetadata>) => {
    set((state) => ({
      metadata: { ...state.metadata, ...metadata },
    }));
  },

  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false }),

  savePlaybook: async () => {
    const { metadata, steps } = get();

    if (!metadata.id || !metadata.name) {
      return false;
    }

    try {
      const result = (await window.electron.invoke('recording:generatePlaybook', metadata)) as IpcResult<Playbook>;

      if (result.success && result.data) {
        const saveResult = (await window.electron.invoke(
          'playbook:save',
          result.data
        )) as IpcResult;

        if (saveResult.success) {
          set({
            isModalOpen: false,
            steps: [],
            metadata: {
              id: '',
              name: '',
              description: '',
              category: '기타',
              difficulty: '보통',
            },
          });

          // Refresh playbook list after saving
          await usePlaybookStore.getState().loadPlaybooks();

          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Failed to save playbook:', error);
      return false;
    }
  },

  addStep: (step: PlaybookStep) => {
    set((state) => ({
      steps: [...state.steps, step],
    }));
  },
}));

// Subscribe to recording events from main process
if (typeof window !== 'undefined' && window.electron) {
  window.electron.on('recording:event', (event: unknown) => {
    const e = event as { type: string; step?: PlaybookStep; steps?: PlaybookStep[] };

    switch (e.type) {
      case 'action_recorded':
        if (e.step) {
          useRecordingStore.getState().addStep(e.step);
        }
        break;
      case 'stopped':
        if (e.steps) {
          useRecordingStore.setState({ state: 'idle', steps: e.steps });
        }
        break;
      case 'paused':
        useRecordingStore.setState({ state: 'paused' });
        break;
      case 'resumed':
        useRecordingStore.setState({ state: 'recording' });
        break;
    }
  });
}
