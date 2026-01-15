/**
 * Data Retention Policy
 * Defines how long different types of data are kept
 */

export const RETENTION_POLICY = {
  // Logs: Keep for 30 days
  logs: {
    combined: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
    error: 90 * 24 * 60 * 60 * 1000,  // 90 days
    exceptions: 365 * 24 * 60 * 60 * 1000, // 1 year
  },

  // Cache: 1 hour TTL
  cache: {
    default: 60 * 60 * 1000, // 1 hour
    short: 15 * 60 * 1000,  // 15 minutes
    long: 24 * 60 * 60 * 1000, // 24 hours
  },

  // Playbooks: Keep forever unless manually deleted
  playbooks: {
    backup: 7 * 24 * 60 * 60 * 1000, // 7 days for backups
    trash: 30 * 24 * 60 * 60 * 1000, // 30 days in trash
  },

  // Credentials: No expiration (user managed)
  credentials: {
    never: 0, // Never auto-delete
  },

  // Browser data: Clear on exit
  browser: {
    session: 0, // Clear on exit
    persistent: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
} as const;

/**
 * Data cleanup task
 */
export async function cleanupOldData(): Promise<void> {
  const { app } = await import('electron');
  const path = await import('path');
  const fs = await import('fs/promises');

  const userDataPath = app.getPath('userData');
  const logsPath = path.join(userDataPath, 'logs');
  const retentionMs = RETENTION_POLICY.logs.combined;

  try {
    const files = await fs.readdir(logsPath);
    const now = Date.now();

    for (const file of files) {
      const filePath = path.join(logsPath, file);
      const stats = await fs.stat(filePath);
      
      if (now - stats.mtimeMs > retentionMs) {
        await fs.unlink(filePath);
        console.log(`[Cleanup] Deleted old log: ${file}`);
      }
    }
  } catch (error) {
    console.error('[Cleanup] Failed to clean old logs:', error);
  }
}
