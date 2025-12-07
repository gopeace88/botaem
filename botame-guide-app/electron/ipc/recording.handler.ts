/**
 * Recording IPC Handler
 * Handles recording mode IPC communication
 */

import { ipcMain, IpcMainInvokeEvent, BrowserWindow, app } from 'electron';
import { RecordingService, RecordingState, RecordingOptions, RecordedAction } from '../services/recording.service';
import { BotameAutomation } from '../services/botame.automation';
import { PlaybookStep, Playbook, Category, Difficulty } from '../playbook/types';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

export interface RecordingResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: unknown;
}

export class RecordingHandler {
  private recordingService: RecordingService;
  private mainWindow: BrowserWindow | null = null;

  constructor(automation: BotameAutomation) {
    this.recordingService = new RecordingService(automation);
    this.setupEventForwarding();
  }

  /**
   * Set main window for event forwarding
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Setup event forwarding to renderer
   */
  private setupEventForwarding(): void {
    this.recordingService.onEvent((event) => {
      if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

      switch (event.type) {
        case 'started':
          this.mainWindow.webContents.send('recording:started');
          break;
        case 'stopped':
          this.mainWindow.webContents.send('recording:stopped', event.steps);
          break;
        case 'paused':
          this.mainWindow.webContents.send('recording:paused');
          break;
        case 'resumed':
          this.mainWindow.webContents.send('recording:resumed');
          break;
        case 'action_recorded':
          this.mainWindow.webContents.send('recording:action', event.action, event.step);
          break;
        case 'error':
          this.mainWindow.webContents.send('recording:error', event.error);
          break;
      }
    });
  }

  /**
   * Register IPC handlers
   */
  register(): void {
    ipcMain.handle('recording:start', this.handleStart.bind(this));
    ipcMain.handle('recording:stop', this.handleStop.bind(this));
    ipcMain.handle('recording:pause', this.handlePause.bind(this));
    ipcMain.handle('recording:resume', this.handleResume.bind(this));
    ipcMain.handle('recording:getState', this.handleGetState.bind(this));
    ipcMain.handle('recording:getSteps', this.handleGetSteps.bind(this));
    ipcMain.handle('recording:getActions', this.handleGetActions.bind(this));
    ipcMain.handle('recording:clear', this.handleClear.bind(this));
    ipcMain.handle('recording:deleteStep', this.handleDeleteStep.bind(this));
    ipcMain.handle('recording:updateStep', this.handleUpdateStep.bind(this));
    ipcMain.handle('recording:generatePlaybook', this.handleGeneratePlaybook.bind(this));
    ipcMain.handle('recording:savePlaybook', this.handleSavePlaybook.bind(this));
  }

  /**
   * Unregister IPC handlers
   */
  unregister(): void {
    ipcMain.removeHandler('recording:start');
    ipcMain.removeHandler('recording:stop');
    ipcMain.removeHandler('recording:pause');
    ipcMain.removeHandler('recording:resume');
    ipcMain.removeHandler('recording:getState');
    ipcMain.removeHandler('recording:getSteps');
    ipcMain.removeHandler('recording:getActions');
    ipcMain.removeHandler('recording:clear');
    ipcMain.removeHandler('recording:deleteStep');
    ipcMain.removeHandler('recording:updateStep');
    ipcMain.removeHandler('recording:generatePlaybook');
    ipcMain.removeHandler('recording:savePlaybook');
  }

  // IPC Handlers

  private async handleStart(
    _event: IpcMainInvokeEvent,
    options?: RecordingOptions
  ): Promise<RecordingResult> {
    const success = await this.recordingService.startRecording(options);
    if (success) {
      return { success: true, message: '녹화가 시작되었습니다.' };
    }
    return { success: false, error: '녹화를 시작할 수 없습니다.' };
  }

  private async handleStop(): Promise<RecordingResult> {
    const steps = await this.recordingService.stopRecording();
    return {
      success: true,
      message: `녹화가 완료되었습니다. ${steps.length}개의 단계가 기록되었습니다.`,
      data: steps,
    };
  }

  private async handlePause(): Promise<RecordingResult> {
    this.recordingService.pauseRecording();
    return { success: true, message: '녹화가 일시정지되었습니다.' };
  }

  private async handleResume(): Promise<RecordingResult> {
    this.recordingService.resumeRecording();
    return { success: true, message: '녹화가 재개되었습니다.' };
  }

  private async handleGetState(): Promise<{
    success: boolean;
    state: RecordingState;
  }> {
    return {
      success: true,
      state: this.recordingService.getState(),
    };
  }

  private async handleGetSteps(): Promise<{
    success: boolean;
    steps: PlaybookStep[];
  }> {
    return {
      success: true,
      steps: this.recordingService.getRecordedSteps(),
    };
  }

  private async handleGetActions(): Promise<{
    success: boolean;
    actions: RecordedAction[];
  }> {
    return {
      success: true,
      actions: this.recordingService.getRecordedActions(),
    };
  }

  private async handleClear(): Promise<RecordingResult> {
    this.recordingService.clearRecording();
    return { success: true, message: '녹화 내용이 삭제되었습니다.' };
  }

  private async handleDeleteStep(
    _event: IpcMainInvokeEvent,
    stepIndex: number
  ): Promise<RecordingResult> {
    this.recordingService.deleteStep(stepIndex);
    return { success: true, message: `${stepIndex + 1}번째 단계가 삭제되었습니다.` };
  }

  private async handleUpdateStep(
    _event: IpcMainInvokeEvent,
    stepIndex: number,
    updates: Partial<PlaybookStep>
  ): Promise<RecordingResult> {
    this.recordingService.updateStep(stepIndex, updates);
    return { success: true, message: `${stepIndex + 1}번째 단계가 수정되었습니다.` };
  }

  private async handleGeneratePlaybook(
    _event: IpcMainInvokeEvent,
    metadata: {
      id: string;
      name: string;
      description?: string;
      category?: Category;
      difficulty?: Difficulty;
    }
  ): Promise<{
    success: boolean;
    playbook?: Playbook;
    error?: string;
  }> {
    try {
      const playbook = this.recordingService.generatePlaybook(metadata);
      return { success: true, playbook };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '플레이북 생성 실패',
      };
    }
  }

  private async handleSavePlaybook(
    _event: IpcMainInvokeEvent,
    playbook: Playbook
  ): Promise<RecordingResult> {
    try {
      // Get playbooks directory
      const playbooksDir = path.join(app.getPath('userData'), 'playbooks');

      // Ensure directory exists
      if (!fs.existsSync(playbooksDir)) {
        fs.mkdirSync(playbooksDir, { recursive: true });
      }

      // Convert playbook to YAML with custom formatting
      const yamlContent = yaml.dump(playbook, {
        indent: 2,
        lineWidth: 120,
        noRefs: true,
        quotingType: '"',
        forceQuotes: false,
      });

      // Add header comment
      const header = `# ${playbook.metadata.name}\n# 자동 생성됨: ${new Date().toISOString()}\n# 생성 방법: Recording Mode\n\n`;
      const finalContent = header + yamlContent;

      // Save to file
      const filePath = path.join(playbooksDir, `${playbook.metadata.id}.yaml`);
      fs.writeFileSync(filePath, finalContent, 'utf-8');

      console.log(`[RecordingHandler] Playbook saved to: ${filePath}`);

      return {
        success: true,
        message: `플레이북이 저장되었습니다: ${playbook.metadata.name}`,
        data: { filePath },
      };
    } catch (error) {
      console.error('[RecordingHandler] Failed to save playbook:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '플레이북 저장 실패',
      };
    }
  }

  /**
   * Get recording service for direct access
   */
  getRecordingService(): RecordingService {
    return this.recordingService;
  }
}
