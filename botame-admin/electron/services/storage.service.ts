import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Playbook } from '@botame/types';

/**
 * IndexedDB Schema for offline storage
 */
interface BotameDB extends DBSchema {
  playbooks: {
    key: string;
    value: Playbook;
    indexes: { 'by-date': number };
  };
  cache: {
    key: string;
    value: {
      data: unknown;
      timestamp: number;
      ttl: number;
    };
  };
  'pending-sync': {
    key: string;
    value: {
      type: 'upload' | 'delete';
      playbook: Playbook;
      timestamp: number;
      retryCount: number;
    };
  };
}

/**
 * IndexedDB Storage Service
 * Provides offline-first data persistence
 */
export class StorageService {
  private db: IDBPDatabase<BotameDB> | null = null;
  private readonly DB_NAME = 'BotameDB';
  private readonly DB_VERSION = 1;

  /**
   * Initialize database
   */
  async initialize(): Promise<void> {
    if (this.db) return;

    this.db = await openDB<BotameDB>(this.DB_NAME, this.DB_VERSION, {
      upgrade(db) {
        // Playbooks store
        if (!db.objectStoreNames.contains('playbooks')) {
          const playbookStore = db.createObjectStore('playbooks', { keyPath: 'metadata.id' });
          playbookStore.createIndex('by-date', 'metadata.updatedAt');
        }

        // Cache store
        if (!db.objectStoreNames.contains('cache')) {
          const cacheStore = db.createObjectStore('cache', { keyPath: 'key' });
          cacheStore.createIndex('timestamp', 'value.timestamp');
        }

        // Pending sync store
        if (!db.objectStoreNames.contains('pending-sync')) {
          db.createObjectStore('pending-sync', { keyPath: 'key', autoIncrement: true });
        }
      },
    });

    console.log('[Storage] Database initialized');
  }

  /**
   * Save playbook to IndexedDB
   */
  async savePlaybook(playbook: Playbook): Promise<void> {
    if (!this.db) await this.initialize();
    await this.db!.put('playbooks', playbook);
    console.log(`[Storage] Saved playbook: ${playbook.metadata.id}`);
  }

  /**
   * Get playbook from IndexedDB
   */
  async getPlaybook(id: string): Promise<Playbook | undefined> {
    if (!this.db) await this.initialize();
    return await this.db!.get('playbooks', id);
  }

  /**
   * List all playbooks
   */
  async listPlaybooks(): Promise<Playbook[]> {
    if (!this.db) await this.initialize();
    return await this.db!.getAll('playbooks');
  }

  /**
   * Delete playbook
   */
  async deletePlaybook(id: string): Promise<void> {
    if (!this.db) await this.initialize();
    await this.db!.delete('playbooks', id);
    console.log(`[Storage] Deleted playbook: ${id}`);
  }

  /**
   * Cache data with TTL
   */
  async setCache(key: string, data: unknown, ttl: number = 3600000): Promise<void> {
    if (!this.db) await this.initialize();
    await this.db!.put('cache', {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Get cached data
   */
  async getCache(key: string): Promise<unknown | null> {
    if (!this.db) await this.initialize();
    const cached = await this.db!.get('cache', key);
    
    if (!cached) return null;

    const { data, timestamp, ttl } = cached;
    const expired = Date.now() - timestamp > ttl;

    if (expired) {
      await this.db!.delete('cache', key);
      return null;
    }

    return data;
  }

  /**
   * Add to pending sync queue
   */
  async addToPendingSync(type: 'upload' | 'delete', playbook: Playbook): Promise<void> {
    if (!this.db) await this.initialize();
    await this.db!.add('pending-sync', {
      type,
      playbook,
      timestamp: Date.now(),
      retryCount: 0,
    });
  }

  /**
   * Get pending sync items
   */
  async getPendingSync(): Promise<Array<{ type: string; playbook: Playbook }>> {
    if (!this.db) await this.initialize();
    const items = await this.db!.getAll('pending-sync');
    return items.map(item => ({
      type: item.type,
      playbook: item.playbook,
    }));
  }

  /**
   * Remove from pending sync
   */
  async removePendingSync(key: number): Promise<void> {
    if (!this.db) await this.initialize();
    await this.db!.delete('pending-sync', key);
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    if (!this.db) await this.initialize();
    await this.db!.clear('playbooks');
    await this.db!.clear('cache');
    await this.db!.clear('pending-sync');
    console.log('[Storage] Database cleared');
  }
}

// Singleton instance
let storageServiceInstance: StorageService | null = null;

export function getStorageService(): StorageService {
  if (!storageServiceInstance) {
    storageServiceInstance = new StorageService();
  }
  return storageServiceInstance;
}
