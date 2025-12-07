import { create } from 'zustand';
import { Playbook, PlaybookCatalogItem } from '../../shared/types';

interface SyncStatus {
  connected: boolean;
  lastSync: Date | null;
  pendingUploads: number;
}

// Catalog grouped by category
interface CatalogByCategory {
  [category: string]: PlaybookCatalogItem[];
}

interface SupabaseState {
  configured: boolean;
  connected: boolean;
  status: SyncStatus;
  isLoading: boolean;
  url: string;
  anonKey: string;
  remotePlaybooks: Array<{ id: string; name: string; updatedAt: string }>;

  // Catalog state
  catalog: PlaybookCatalogItem[];
  catalogByCategory: CatalogByCategory;
  selectedCatalogItem: PlaybookCatalogItem | null;
  selectedPlaybook: Playbook | null;

  // Actions
  setCredentials: (url: string, anonKey: string) => void;
  configure: () => Promise<boolean>;
  refreshStatus: () => Promise<void>;
  uploadPlaybook: (id: string) => Promise<{ success: boolean; message: string }>;
  uploadAllPlaybooks: () => Promise<{ success: boolean; message: string }>;
  listRemotePlaybooks: () => Promise<void>;
  downloadPlaybook: (id: string) => Promise<{ success: boolean; message: string }>;
  deleteRemotePlaybook: (id: string) => Promise<{ success: boolean; message: string }>;

  // Catalog actions
  loadCatalog: () => Promise<void>;
  selectCatalogItem: (item: PlaybookCatalogItem | null) => void;
  loadPlaybookFromCatalog: (playbookId: string) => Promise<void>;
  saveCatalogPlaybook: (playbook: Playbook) => Promise<{ success: boolean; message: string }>;
  runPlaybookFromCatalog: (playbookId: string) => Promise<{ success: boolean; error?: string }>;

  // Browser highlight actions
  highlightElement: (selector: string) => Promise<{ success: boolean; error?: string }>;
  clearHighlight: () => Promise<void>;
}

export const useSupabaseStore = create<SupabaseState>((set, get) => ({
  configured: false,
  connected: false,
  status: {
    connected: false,
    lastSync: null,
    pendingUploads: 0,
  },
  isLoading: false,
  url: '',
  anonKey: '',
  remotePlaybooks: [],

  // Catalog state
  catalog: [],
  catalogByCategory: {},
  selectedCatalogItem: null,
  selectedPlaybook: null,

  setCredentials: (url, anonKey) => {
    set({ url, anonKey });
  },

  configure: async () => {
    const { url, anonKey } = get();
    if (!url || !anonKey) {
      return false;
    }

    set({ isLoading: true });
    try {
      const result = await window.electron.invoke('supabase:configure', url, anonKey);
      if (result.success) {
        set({ configured: true, connected: true });
        // Save to localStorage for persistence
        localStorage.setItem('supabase_url', url);
        localStorage.setItem('supabase_key', anonKey);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Supabase configure error:', error);
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  refreshStatus: async () => {
    try {
      const result = await window.electron.invoke('supabase:getStatus') as {
        success: boolean;
        status: SyncStatus;
        configured: boolean;
        connected: boolean;
      };
      if (result.success) {
        set({
          configured: result.configured,
          connected: result.connected,
          status: result.status,
        });
      }
    } catch (error) {
      console.error('Status refresh error:', error);
    }
  },

  uploadPlaybook: async (id: string) => {
    set({ isLoading: true });
    try {
      const result = await window.electron.invoke('supabase:upload', id) as { success: boolean; message: string };
      await get().refreshStatus();
      return result;
    } catch (error) {
      return { success: false, message: '업로드 실패' };
    } finally {
      set({ isLoading: false });
    }
  },

  uploadAllPlaybooks: async () => {
    set({ isLoading: true });
    try {
      const result = await window.electron.invoke('supabase:uploadAll') as { success: boolean; message: string };
      await get().refreshStatus();
      return result;
    } catch (error) {
      return { success: false, message: '전체 업로드 실패' };
    } finally {
      set({ isLoading: false });
    }
  },

  listRemotePlaybooks: async () => {
    set({ isLoading: true });
    try {
      const result = await window.electron.invoke('supabase:listRemote') as {
        success: boolean;
        playbooks?: Array<{ id: string; name: string; updatedAt: string }>;
      };
      if (result.success && result.playbooks) {
        set({ remotePlaybooks: result.playbooks });
      }
    } catch (error) {
      console.error('List remote error:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  downloadPlaybook: async (id: string) => {
    set({ isLoading: true });
    try {
      const result = await window.electron.invoke('supabase:download', id) as { success: boolean; message: string };
      return result;
    } catch (error) {
      return { success: false, message: '다운로드 실패' };
    } finally {
      set({ isLoading: false });
    }
  },

  deleteRemotePlaybook: async (id: string) => {
    set({ isLoading: true });
    try {
      const result = await window.electron.invoke('supabase:deleteRemote', id) as { success: boolean; message: string };
      await get().listRemotePlaybooks();
      return result;
    } catch (error) {
      return { success: false, message: '삭제 실패' };
    } finally {
      set({ isLoading: false });
    }
  },

  // === Catalog Actions ===
  loadCatalog: async () => {
    if (!get().connected) {
      console.log('[SupabaseStore] Not connected, skipping catalog load');
      return;
    }

    set({ isLoading: true });
    try {
      const result = await window.electron.invoke('supabase:getCatalog') as {
        success: boolean;
        playbooks?: PlaybookCatalogItem[];
        message: string;
      };

      if (result.success && result.playbooks) {
        // Group by category
        const catalogByCategory: CatalogByCategory = {};
        for (const item of result.playbooks) {
          const category = item.category || '기타';
          if (!catalogByCategory[category]) {
            catalogByCategory[category] = [];
          }
          catalogByCategory[category].push(item);
        }

        set({
          catalog: result.playbooks,
          catalogByCategory,
        });
        console.log(`[SupabaseStore] Loaded ${result.playbooks.length} playbooks from catalog`);
      } else {
        console.error('[SupabaseStore] Catalog load failed:', result.message);
      }
    } catch (error) {
      console.error('[SupabaseStore] Catalog load error:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  selectCatalogItem: (item: PlaybookCatalogItem | null) => {
    set({ selectedCatalogItem: item, selectedPlaybook: null });
  },

  loadPlaybookFromCatalog: async (playbookId: string) => {
    set({ isLoading: true });
    try {
      const result = await window.electron.invoke('supabase:getPlaybook', playbookId) as {
        success: boolean;
        playbook?: Playbook;
        message: string;
      };

      if (result.success && result.playbook) {
        set({ selectedPlaybook: result.playbook });
        console.log(`[SupabaseStore] Loaded playbook: ${result.playbook.metadata.name}`);
      } else {
        console.error('[SupabaseStore] Playbook load failed:', result.message);
      }
    } catch (error) {
      console.error('[SupabaseStore] Playbook load error:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  saveCatalogPlaybook: async (playbook: Playbook) => {
    set({ isLoading: true });
    try {
      const result = await window.electron.invoke('supabase:updatePlaybook', playbook) as {
        success: boolean;
        message: string;
      };

      if (result.success) {
        // Update selectedPlaybook with saved version
        set({ selectedPlaybook: playbook });
        // Reload catalog to reflect changes
        await get().loadCatalog();
      }

      return result;
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : '저장 실패' };
    } finally {
      set({ isLoading: false });
    }
  },

  runPlaybookFromCatalog: async (playbookId: string) => {
    try {
      const result = await window.electron.invoke('runner:runFromCatalog', playbookId) as {
        success: boolean;
        error?: string;
      };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '실행 실패',
      };
    }
  },

  // === Browser Highlight Actions ===
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
        error: error instanceof Error ? error.message : '하이라이트 실패',
      };
    }
  },

  clearHighlight: async () => {
    try {
      await window.electron.invoke('browser:clearHighlight');
    } catch (error) {
      console.error('[SupabaseStore] Clear highlight error:', error);
    }
  },
}));

// Initialize: check if main process already connected, then try localStorage
if (typeof window !== 'undefined') {
  // Listen for supabase:connected event from main process
  window.electron.on('supabase:connected', async (data: unknown) => {
    const connectionData = data as { connected: boolean; configured: boolean };
    console.log('[SupabaseStore] Received supabase:connected event:', connectionData);

    const store = useSupabaseStore.getState();
    if (connectionData.connected) {
      // Update state directly without waiting for refreshStatus
      useSupabaseStore.setState({
        connected: true,
        configured: true,
      });
      // Load catalog now that we're connected
      await store.loadCatalog();
    }
  });

  // First, check if main process already configured Supabase (from .env)
  setTimeout(async () => {
    const store = useSupabaseStore.getState();
    await store.refreshStatus();

    // If already connected from main process, load catalog
    if (store.connected) {
      console.log('[SupabaseStore] Main process already connected, loading catalog...');
      await store.loadCatalog();
    } else {
      // Try localStorage credentials as fallback
      const savedUrl = localStorage.getItem('supabase_url');
      const savedKey = localStorage.getItem('supabase_key');
      if (savedUrl && savedKey) {
        store.setCredentials(savedUrl, savedKey);
        const success = await store.configure();
        if (success) {
          await store.loadCatalog();
        }
      }
    }
  }, 500);
}
