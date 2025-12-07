/**
 * Window IPC Handler
 * Handles window-related IPC communication
 */

import { ipcMain, BrowserWindow } from 'electron';

export class WindowHandler {
  private mainWindow: BrowserWindow | null = null;

  /**
   * Set main window reference
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Register IPC handlers
   */
  register(): void {
    ipcMain.handle('window:minimize', this.handleMinimize.bind(this));
    ipcMain.handle('window:maximize', this.handleMaximize.bind(this));
    ipcMain.handle('window:close', this.handleClose.bind(this));
  }

  /**
   * Unregister IPC handlers
   */
  unregister(): void {
    ipcMain.removeHandler('window:minimize');
    ipcMain.removeHandler('window:maximize');
    ipcMain.removeHandler('window:close');
  }

  private async handleMinimize(): Promise<void> {
    this.mainWindow?.minimize();
  }

  private async handleMaximize(): Promise<void> {
    if (this.mainWindow?.isMaximized()) {
      this.mainWindow.unmaximize();
    } else {
      this.mainWindow?.maximize();
    }
  }

  private async handleClose(): Promise<void> {
    this.mainWindow?.close();
  }
}
