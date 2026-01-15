import { autoUpdater, UpdateInfo } from 'electron-updater';
import { BrowserWindow } from 'electron';
import { EventEmitter } from 'events';

/**
 * Auto-updater Service
 * Handles application updates via GitHub Releases
 */
export class AutoUpdateService extends EventEmitter {
  private mainWindow: BrowserWindow | null = null;
  private updateAvailable: boolean = false;
  private updateDownloaded: boolean = false;
  private updateInfo: UpdateInfo | null = null;

  constructor() {
    super();
    this.configureUpdater();
  }

  /**
   * Set the main window for sending events
   */
  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  /**
   * Configure auto-updater settings
   */
  private configureUpdater(): void {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'gopeace88',
      repo: 'botaem',
    });

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    // Event listeners
    autoUpdater.on('update-available', (info) => {
      console.log('[AutoUpdate] Update available:', info);
      this.updateAvailable = true;
      this.updateInfo = info;
      this.emit('update-available', info);
      this.sendToRenderer('update-available', info);
    });

    autoUpdater.on('update-not-available', (info) => {
      console.log('[AutoUpdate] No update available:', info);
      this.emit('update-not-available', info);
      this.sendToRenderer('update-not-available', info);
    });

    autoUpdater.on('error', (error) => {
      console.error('[AutoUpdate] Error:', error);
      this.emit('update-error', error);
      this.sendToRenderer('update-error', error.message);
    });

    autoUpdater.on('download-progress', (progress) => {
      console.log('[AutoUpdate] Download progress:', progress);
      this.emit('download-progress', progress);
      this.sendToRenderer('download-progress', progress);
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('[AutoUpdate] Update downloaded:', info);
      this.updateDownloaded = true;
      this.emit('update-downloaded', info);
      this.sendToRenderer('update-downloaded', info);
    });
  }

  /**
   * Check for updates
   */
  async checkForUpdates(): Promise<{ success: boolean; message: string; updateAvailable?: boolean }> {
    try {
      console.log('[AutoUpdate] Checking for updates...');
      await autoUpdater.checkForUpdates();
      return {
        success: true,
        message: '업데이트 확인 완료',
        updateAvailable: this.updateAvailable,
      };
    } catch (error) {
      console.error('[AutoUpdate] Check failed:', error);
      return {
        success: false,
        message: `업데이트 확인 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
      };
    }
  }

  /**
   * Download update
   */
  async downloadUpdate(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('[AutoUpdate] Downloading update...');
      await autoUpdater.downloadUpdate();
      return {
        success: true,
        message: '업데이트 다운로드 완료',
      };
    } catch (error) {
      console.error('[AutoUpdate] Download failed:', error);
      return {
        success: false,
        message: `다운로드 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
      };
    }
  }

  /**
   * Install update and restart
   */
  installAndRestart(): void {
    console.log('[AutoUpdate] Installing update and restarting...');
    autoUpdater.quitAndInstall();
  }

  /**
   * Get current update info
   */
  getUpdateInfo(): UpdateInfo | null {
    return this.updateInfo;
  }

  /**
   * Check if update is available
   */
  isUpdateAvailable(): boolean {
    return this.updateAvailable;
  }

  /**
   * Check if update is downloaded
   */
  isUpdateDownloaded(): boolean {
    return this.updateDownloaded;
  }

  /**
   * Send event to renderer process
   */
  private sendToRenderer(channel: string, ...args: unknown[]): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(`autoupdate:${channel}`, ...args);
    }
  }
}

// Singleton instance
let autoUpdateServiceInstance: AutoUpdateService | null = null;

export function getAutoUpdateService(): AutoUpdateService {
  if (!autoUpdateServiceInstance) {
    autoUpdateServiceInstance = new AutoUpdateService();
  }
  return autoUpdateServiceInstance;
}
