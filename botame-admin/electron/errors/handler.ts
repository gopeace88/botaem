import { BrowserWindow } from 'electron';
import { BaseError } from './base';
import fs from 'fs/promises';
import path from 'path';

/**
 * Error Handler Service
 * Centralized error handling with logging and user notification
 */
export class ErrorHandler {
  private mainWindow: BrowserWindow | null = null;
  private logFilePath: string;

  constructor(logFilePath?: string) {
    this.logFilePath = logFilePath || this.getDefaultLogPath();
  }

  /**
   * Set the main window for sending notifications
   */
  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  /**
   * Handle an error
   */
  async handle(error: Error | BaseError): Promise<void> {
    // Log to file
    await this.logToFile(error);

    // Log to console (development only)
    if (process.env.NODE_ENV === 'development') {
      console.error('[ErrorHandler]', error);
    }

    // Notify user
    this.notifyUser(error);

    // Send to server (optional, for monitoring)
    // await this.sendToServer(error);
  }

  /**
   * Log error to file
   */
  private async logToFile(error: Error): Promise<void> {
    try {
      const logEntry = this.formatLogEntry(error);
      await fs.appendFile(this.logFilePath, logEntry + '\n');
    } catch (logError) {
      console.error('[ErrorHandler] Failed to write to log file:', logError);
    }
  }

  /**
   * Format error as log entry
   */
  private formatLogEntry(error: Error): string {
    const timestamp = new Date().toISOString();
    
    if (error instanceof BaseError) {
      return JSON.stringify({
        timestamp,
        level: error.recoverable ? 'WARN' : 'ERROR',
        code: error.code,
        message: error.message,
        context: error.context,
        stack: error.stack,
      });
    }

    return JSON.stringify({
      timestamp,
      level: 'ERROR',
      message: error.message,
      stack: error.stack,
    });
  }

  /**
   * Notify user about error
   */
  private notifyUser(error: Error): void {
    const userMessage = this.getUserMessage(error);

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('error:occurred', {
        message: userMessage,
        recoverable: error instanceof BaseError ? error.recoverable : false,
        code: error instanceof BaseError ? error.code : 'UNKNOWN_ERROR',
      });
    }
  }

  /**
   * Get user-friendly error message
   */
  private getUserMessage(error: Error): string {
    if (error instanceof BaseError) {
      return error.message;
    }

    // Generic error message
    return '오류가 발생했습니다. 다시 시도해주세요.';
  }

  /**
   * Get default log file path
   */
  private getDefaultLogPath(): string {
    const { app } = require('electron');
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'error.log');
  }

  /**
   * Get recent error logs
   */
  async getRecentLogs(count = 50): Promise<string[]> {
    try {
      const content = await fs.readFile(this.logFilePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim().length > 0);
      return lines.slice(-count);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('[ErrorHandler] Failed to read log file:', error);
      }
      return [];
    }
  }

  /**
   * Clear error logs
   */
  async clearLogs(): Promise<void> {
    try {
      await fs.writeFile(this.logFilePath, '');
    } catch (error) {
      console.error('[ErrorHandler] Failed to clear log file:', error);
    }
  }
}

// Singleton instance
let errorHandlerInstance: ErrorHandler | null = null;

export function getErrorHandler(): ErrorHandler {
  if (!errorHandlerInstance) {
    errorHandlerInstance = new ErrorHandler();
  }
  return errorHandlerInstance;
}
