import { create } from 'zustand';
import { Playbook, PlaybookListItem, IpcResult } from '../../shared/types';

interface PlaybookState {
  playbooks: PlaybookListItem[];
  selectedPlaybook: Playbook | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadPlaybooks: () => Promise<void>;
  selectPlaybook: (id: string) => Promise<void>;
  savePlaybook: (playbook: Playbook) => Promise<boolean>;
  deletePlaybook: (id: string) => Promise<boolean>;
  clearSelection: () => void;
  clearError: () => void;
}

export const usePlaybookStore = create<PlaybookState>((set, get) => ({
  playbooks: [],
  selectedPlaybook: null,
  isLoading: false,
  error: null,

  loadPlaybooks: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = (await window.electron.invoke('playbook:list')) as IpcResult<
        PlaybookListItem[]
      >;
      if (result.success && result.data) {
        set({ playbooks: result.data, isLoading: false });
      } else {
        set({ error: result.error || 'Failed to load playbooks', isLoading: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
      });
    }
  },

  selectPlaybook: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = (await window.electron.invoke('playbook:load', id)) as IpcResult<Playbook>;
      if (result.success && result.data) {
        set({ selectedPlaybook: result.data, isLoading: false });
      } else {
        set({ error: result.error || 'Failed to load playbook', isLoading: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
      });
    }
  },

  savePlaybook: async (playbook: Playbook) => {
    set({ isLoading: true, error: null });
    try {
      const result = (await window.electron.invoke('playbook:save', playbook)) as IpcResult;
      if (result.success) {
        set({ selectedPlaybook: playbook, isLoading: false });
        await get().loadPlaybooks();
        return true;
      } else {
        set({ error: result.error || 'Failed to save playbook', isLoading: false });
        return false;
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
      });
      return false;
    }
  },

  deletePlaybook: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = (await window.electron.invoke('playbook:delete', id)) as IpcResult;
      if (result.success) {
        set({ isLoading: false });
        if (get().selectedPlaybook?.metadata.id === id) {
          set({ selectedPlaybook: null });
        }
        await get().loadPlaybooks();
        return true;
      } else {
        set({ error: result.error || 'Failed to delete playbook', isLoading: false });
        return false;
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
      });
      return false;
    }
  },

  clearSelection: () => {
    set({ selectedPlaybook: null });
  },

  clearError: () => {
    set({ error: null });
  },
}));
