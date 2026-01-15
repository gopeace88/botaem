import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Playbook } from '@botame/types';

/**
 * IndexedDB Schema for offline storage
 */
interface GuideDB extends DBSchema {
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
}

/**
 * IndexedDB Storage Service
 * Provides offline-first data persistence
 */
export class StorageService {
  private db: IDBPDatabase<GuideDB> | null = null;
  private readonly DB_NAME = 'GuideDB';
  private readonly DB_VERSION = 1;

  /**
   * Initialize database
   */
  async initialize(): Promise<void> {
    if (this.db) return;

    this.db = await openDB<GuideDB>(this.DB_NAME, this.DB_VERSION, {
      upgrade(db) {
        // Playbooks store
        if (!db.objectStoreNames.contains('playbooks')) {
          const playbookStore = db.createObjectStore('playbooks', { keyPath: 'metadata.id' });
          playbookStore.createIndex('by-date', 'metadata.updatedAt');
        }

        // Cache store
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' });
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
   * Clear all data
   */
  async clear(): Promise<void> {
    if (!this.db) await this.initialize();
    await this.db!.clear('playbooks');
    await this.db!.clear('cache');
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
