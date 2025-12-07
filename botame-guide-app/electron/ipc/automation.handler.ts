/**
 * Automation IPC Handler
 * Handles browser automation IPC communication
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { BotameAutomation, LoginCredentials, AutomationResult, PageState } from '../services/botame.automation';

export class AutomationHandler {
  private automation: BotameAutomation;

  constructor(baseUrl?: string) {
    this.automation = new BotameAutomation(baseUrl);
  }

  /**
   * Register IPC handlers
   */
  register(): void {
    ipcMain.handle('automation:initialize', this.handleInitialize.bind(this));
    ipcMain.handle('automation:close', this.handleClose.bind(this));
    ipcMain.handle('automation:navigate', this.handleNavigate.bind(this));
    ipcMain.handle('automation:login', this.handleLogin.bind(this));
    ipcMain.handle('automation:navigateMenu', this.handleNavigateMenu.bind(this));
    ipcMain.handle('automation:click', this.handleClick.bind(this));
    ipcMain.handle('automation:fill', this.handleFill.bind(this));
    ipcMain.handle('automation:select', this.handleSelect.bind(this));
    ipcMain.handle('automation:getPageState', this.handleGetPageState.bind(this));
    ipcMain.handle('automation:screenshot', this.handleScreenshot.bind(this));
    ipcMain.handle('automation:waitForElement', this.handleWaitForElement.bind(this));
    ipcMain.handle('automation:evaluate', this.handleEvaluate.bind(this));
  }

  /**
   * Unregister IPC handlers
   */
  unregister(): void {
    ipcMain.removeHandler('automation:initialize');
    ipcMain.removeHandler('automation:close');
    ipcMain.removeHandler('automation:navigate');
    ipcMain.removeHandler('automation:login');
    ipcMain.removeHandler('automation:navigateMenu');
    ipcMain.removeHandler('automation:click');
    ipcMain.removeHandler('automation:fill');
    ipcMain.removeHandler('automation:select');
    ipcMain.removeHandler('automation:getPageState');
    ipcMain.removeHandler('automation:screenshot');
    ipcMain.removeHandler('automation:waitForElement');
    ipcMain.removeHandler('automation:evaluate');
  }

  // IPC Handlers

  private async handleInitialize(): Promise<AutomationResult> {
    return this.automation.initialize();
  }

  private async handleClose(): Promise<AutomationResult> {
    await this.automation.close();
    return { success: true, message: '브라우저가 종료되었습니다.' };
  }

  private async handleNavigate(
    _event: IpcMainInvokeEvent,
    url?: string
  ): Promise<AutomationResult> {
    if (url) {
      // 특정 URL로 이동
      return this.automation.clickElement(`goto:${url}`);
    }
    return this.automation.navigateToMain();
  }

  private async handleLogin(
    _event: IpcMainInvokeEvent,
    credentials: LoginCredentials
  ): Promise<AutomationResult> {
    return this.automation.login(credentials);
  }

  private async handleNavigateMenu(
    _event: IpcMainInvokeEvent,
    menuPath: string[]
  ): Promise<AutomationResult> {
    return this.automation.navigateToMenu(menuPath);
  }

  private async handleClick(
    _event: IpcMainInvokeEvent,
    selector: string
  ): Promise<AutomationResult> {
    return this.automation.clickElement(selector);
  }

  private async handleFill(
    _event: IpcMainInvokeEvent,
    selector: string,
    value: string
  ): Promise<AutomationResult> {
    return this.automation.fillInput(selector, value);
  }

  private async handleSelect(
    _event: IpcMainInvokeEvent,
    selector: string,
    value: string
  ): Promise<AutomationResult> {
    return this.automation.selectOption(selector, value);
  }

  private async handleGetPageState(): Promise<{
    success: boolean;
    pageState?: PageState;
    error?: string;
  }> {
    const pageState = await this.automation.getPageState();
    if (pageState) {
      return { success: true, pageState };
    }
    return { success: false, error: '페이지 상태를 가져올 수 없습니다.' };
  }

  private async handleScreenshot(
    _event: IpcMainInvokeEvent,
    filename?: string
  ): Promise<AutomationResult> {
    return this.automation.captureScreenshot(filename);
  }

  private async handleWaitForElement(
    _event: IpcMainInvokeEvent,
    selector: string,
    timeout?: number
  ): Promise<AutomationResult> {
    return this.automation.waitForElement(selector, timeout);
  }

  private async handleEvaluate(
    _event: IpcMainInvokeEvent,
    script: string
  ): Promise<AutomationResult> {
    return this.automation.evaluateScript(script);
  }

  /**
   * Get automation instance for direct access
   */
  getAutomation(): BotameAutomation {
    return this.automation;
  }
}
