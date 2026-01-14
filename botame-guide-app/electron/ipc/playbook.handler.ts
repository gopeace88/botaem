/**
 * Playbook IPC Handler
 * Handles playbook-related IPC communication
 *
 * v2: DB 동기화 지원
 * - 플레이북은 DB(Supabase)에 원본 저장
 * - 사용자는 DB에서 동기화하여 로컬 캐시 사용
 */

import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from "electron";
import { Page } from "playwright";
import { PlaybookEngine, StepExecutor } from "../playbook/engine";
import { PlaybookParser } from "../playbook/parser";
import { Playbook } from "../playbook/types";
import {
  playbookSyncService,
  SyncStatus,
  SyncResult,
  BulkSyncResult,
} from "../services/playbook-sync.service";
import * as fs from "fs";
import * as path from "path";

export class PlaybookHandler {
  private engine: PlaybookEngine;
  private parser: PlaybookParser;
  private playbooks: Map<string, Playbook> = new Map();
  private playbooksDir: string;
  private mainWindow: BrowserWindow | null = null;

  constructor(playbooksDir: string) {
    this.playbooksDir = playbooksDir;
    this.parser = new PlaybookParser();

    // Create engine
    this.engine = new PlaybookEngine();

    // Set up engine event forwarding
    this.setupEngineEvents();
  }

  /**
   * Set main window for event forwarding
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Set step executor function
   */
  setStepExecutor(executor: StepExecutor): void {
    this.engine.setStepExecutor(executor);
  }

  /**
   * Set Playwright page for step verification
   */
  setPage(page: Page): void {
    this.engine.setPage(page);
  }

  /**
   * Get engine for direct access (used for skip verification)
   */
  getEngine(): PlaybookEngine {
    return this.engine;
  }

  /**
   * Load all playbooks from directory
   */
  async loadPlaybooksFromDir(): Promise<Playbook[]> {
    this.playbooks.clear();

    if (!fs.existsSync(this.playbooksDir)) {
      return [];
    }

    const files = fs.readdirSync(this.playbooksDir);
    const yamlFiles = files.filter(
      (f) => f.endsWith(".yaml") || f.endsWith(".yml"),
    );

    for (const file of yamlFiles) {
      try {
        const content = fs.readFileSync(
          path.join(this.playbooksDir, file),
          "utf-8",
        );
        const playbook = this.parser.parse(content);
        this.playbooks.set(playbook.metadata.id, playbook);
      } catch (error) {
        console.error(`Failed to load playbook ${file}:`, error);
      }
    }

    return Array.from(this.playbooks.values());
  }

  /**
   * Get all loaded playbooks
   */
  getPlaybooks(): Playbook[] {
    return Array.from(this.playbooks.values());
  }

  /**
   * Register IPC handlers
   */
  register(): void {
    // 기존 핸들러
    ipcMain.handle("playbook:list", this.handleList.bind(this));
    ipcMain.handle("playbook:load", this.handleLoad.bind(this));
    ipcMain.handle("playbook:execute", this.handleExecute.bind(this));
    ipcMain.handle("playbook:pause", this.handlePause.bind(this));
    ipcMain.handle("playbook:resume", this.handleResume.bind(this));
    ipcMain.handle("playbook:stop", this.handleStop.bind(this));
    ipcMain.handle("playbook:userAction", this.handleUserAction.bind(this));
    ipcMain.handle(
      "playbook:skipVerification",
      this.handleSkipVerification.bind(this),
    );

    // v2: DB 동기화 핸들러
    ipcMain.handle("playbook:sync:list", this.handleSyncList.bind(this));
    ipcMain.handle("playbook:sync:one", this.handleSyncOne.bind(this));
    ipcMain.handle("playbook:sync:all", this.handleSyncAll.bind(this));
    ipcMain.handle("playbook:sync:updated", this.handleSyncUpdated.bind(this));
    ipcMain.handle("playbook:sync:status", this.handleSyncStatus.bind(this));
    ipcMain.handle("playbook:sync:cached", this.handleGetCached.bind(this));
    ipcMain.handle("playbook:sync:load", this.handleSyncLoad.bind(this));
  }

  /**
   * Unregister IPC handlers
   */
  unregister(): void {
    ipcMain.removeHandler("playbook:list");
    ipcMain.removeHandler("playbook:load");
    ipcMain.removeHandler("playbook:execute");
    ipcMain.removeHandler("playbook:pause");
    ipcMain.removeHandler("playbook:resume");
    ipcMain.removeHandler("playbook:stop");
    ipcMain.removeHandler("playbook:userAction");
    ipcMain.removeHandler("playbook:skipVerification");

    // v2: DB 동기화 핸들러
    ipcMain.removeHandler("playbook:sync:list");
    ipcMain.removeHandler("playbook:sync:one");
    ipcMain.removeHandler("playbook:sync:all");
    ipcMain.removeHandler("playbook:sync:updated");
    ipcMain.removeHandler("playbook:sync:status");
    ipcMain.removeHandler("playbook:sync:cached");
    ipcMain.removeHandler("playbook:sync:load");
  }

  /**
   * Setup engine event forwarding to renderer
   */
  private setupEngineEvents(): void {
    this.engine.on("step_started", (data) => {
      this.sendToRenderer("playbook:step-changed", data);
    });

    this.engine.on("step_completed", (data) => {
      this.sendToRenderer("playbook:step-changed", data);
    });

    this.engine.on("waiting_user", (data) => {
      this.sendToRenderer("playbook:waiting-user", data);
    });

    // Verification events (Interactive Watch & Guide)
    this.engine.on("verifying", (data) => {
      this.sendToRenderer("playbook:verifying", data);
      this.sendToRenderer("playbook:status-changed", { status: "verifying" });
    });

    this.engine.on("verify_success", (data) => {
      this.sendToRenderer("playbook:verify-result", {
        ...data,
        success: true,
      });
    });

    this.engine.on("verify_failed", (data) => {
      this.sendToRenderer("playbook:verify-result", {
        ...data,
        success: false,
      });
      // Also send back to waiting_user status
      this.sendToRenderer("playbook:status-changed", {
        status: "waiting_user",
      });
    });

    this.engine.on("completed", () => {
      this.sendToRenderer("playbook:completed", {});
    });

    this.engine.on("error", (data) => {
      this.sendToRenderer("playbook:error", data);
    });

    this.engine.on("started", () => {
      this.sendToRenderer("playbook:status-changed", { status: "executing" });
    });

    this.engine.on("paused", () => {
      this.sendToRenderer("playbook:status-changed", { status: "paused" });
    });

    this.engine.on("resumed", () => {
      this.sendToRenderer("playbook:status-changed", { status: "executing" });
    });

    this.engine.on("stopped", () => {
      this.sendToRenderer("playbook:status-changed", { status: "idle" });
    });
  }

  /**
   * Send event to renderer process
   */
  private sendToRenderer(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  // IPC Handlers

  private async handleList(): Promise<{ playbooks: Playbook[] }> {
    const playbooks = Array.from(this.playbooks.values());
    return { playbooks };
  }

  private async handleLoad(
    _event: IpcMainInvokeEvent,
    playbookId: string,
  ): Promise<{ success: boolean; playbook?: Playbook; error?: string }> {
    console.log(
      "[PlaybookHandler] handleLoad called with playbookId:",
      playbookId,
    );
    console.log(
      "[PlaybookHandler] Available playbooks:",
      Array.from(this.playbooks.keys()),
    );

    const playbook = this.playbooks.get(playbookId);

    if (!playbook) {
      console.error("[PlaybookHandler] Playbook not found:", playbookId);
      return { success: false, error: `Playbook not found: ${playbookId}` };
    }

    console.log("[PlaybookHandler] Loading playbook:", playbook.metadata.name);
    this.engine.load(playbook);
    console.log("[PlaybookHandler] Playbook loaded successfully");
    return { success: true, playbook };
  }

  private async handleExecute(
    _event: IpcMainInvokeEvent,
    variables?: Record<string, unknown>,
  ): Promise<{ success: boolean; error?: string }> {
    console.log("[PlaybookHandler] handleExecute called");
    console.log(
      "[PlaybookHandler] Current playbook:",
      this.engine.getPlaybook()?.metadata?.id,
    );
    try {
      if (variables) {
        console.log("[PlaybookHandler] Setting variables:", variables);
        this.engine.setVariables(variables);
      }
      console.log("[PlaybookHandler] Starting engine...");
      await this.engine.start();
      console.log("[PlaybookHandler] Engine started successfully");
      return { success: true };
    } catch (error) {
      console.error("[PlaybookHandler] Execute error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async handlePause(): Promise<{ success: boolean }> {
    this.engine.pause();
    return { success: true };
  }

  private async handleResume(): Promise<{ success: boolean }> {
    this.engine.resume();
    return { success: true };
  }

  private async handleStop(): Promise<{ success: boolean }> {
    this.engine.stop();
    return { success: true };
  }

  private async handleUserAction(
    _event: IpcMainInvokeEvent,
    data?: unknown,
  ): Promise<{ success: boolean }> {
    await this.engine.userAction(data);
    return { success: true };
  }

  private async handleSkipVerification(): Promise<{ success: boolean }> {
    this.engine.skipVerification();
    return { success: true };
  }

  // ===== v2: DB 동기화 핸들러 =====

  /**
   * DB에서 공개된 플레이북 목록 조회
   */
  private async handleSyncList(): Promise<{
    success: boolean;
    playbooks?: Array<{
      id: string;
      playbook_id: string;
      name: string;
      description?: string;
      category: string;
      difficulty: string;
      version: string;
      keywords?: string[];
      success_rate: number;
    }>;
    error?: string;
  }> {
    console.log("[PlaybookHandler] Fetching published playbooks from DB");
    return await playbookSyncService.getPublishedPlaybooks();
  }

  /**
   * 단일 플레이북 동기화
   */
  private async handleSyncOne(
    _event: IpcMainInvokeEvent,
    playbookId: string,
  ): Promise<SyncResult> {
    console.log("[PlaybookHandler] Syncing playbook:", playbookId);
    const result = await playbookSyncService.syncPlaybook(playbookId);

    // 동기화된 플레이북을 메모리에도 로드
    if (result.success && result.playbook) {
      this.playbooks.set(result.playbook.metadata.id, result.playbook);
    }

    return result;
  }

  /**
   * 모든 플레이북 동기화
   */
  private async handleSyncAll(): Promise<BulkSyncResult> {
    console.log("[PlaybookHandler] Syncing all playbooks from DB");
    const result = await playbookSyncService.syncAllPlaybooks();

    // 캐시된 플레이북을 메모리에 로드
    if (result.success || result.synced > 0) {
      const cachedPlaybooks = await playbookSyncService.getAllCachedPlaybooks();
      for (const playbook of cachedPlaybooks) {
        this.playbooks.set(playbook.metadata.id, playbook);
      }
      console.log(
        `[PlaybookHandler] Loaded ${cachedPlaybooks.length} playbooks from cache`,
      );
    }

    return result;
  }

  /**
   * 동기화 상태 확인
   */
  private async handleSyncStatus(): Promise<{
    success: boolean;
    statuses?: SyncStatus[];
    error?: string;
  }> {
    try {
      const statuses = await playbookSyncService.checkSyncStatus();
      return { success: true, statuses };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "알 수 없는 오류";
      return { success: false, error: message };
    }
  }

  /**
   * 캐시된 플레이북 조회
   */
  private async handleGetCached(): Promise<{
    success: boolean;
    playbooks?: Playbook[];
    error?: string;
  }> {
    try {
      const playbooks = await playbookSyncService.getAllCachedPlaybooks();

      // 메모리에도 로드
      for (const playbook of playbooks) {
        this.playbooks.set(playbook.metadata.id, playbook);
      }

      return { success: true, playbooks };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "알 수 없는 오류";
      return { success: false, error: message };
    }
  }

  /**
   * 변경된 플레이북만 동기화 (Partial Sync)
   */
  private async handleSyncUpdated(): Promise<BulkSyncResult> {
    console.log("[PlaybookHandler] Syncing only updated playbooks");
    const result = await playbookSyncService.syncUpdatedPlaybooks();

    // 캐시된 플레이북을 메모리에 로드
    if (result.synced > 0) {
      const cachedPlaybooks = await playbookSyncService.getAllCachedPlaybooks();
      for (const playbook of cachedPlaybooks) {
        this.playbooks.set(playbook.metadata.id, playbook);
      }
    }

    return result;
  }

  /**
   * 플레이북 로드 (Lazy Sync)
   * - 캐시가 최신이면 캐시에서 로드
   * - 업데이트 필요하면 DB에서 동기화 후 로드
   */
  private async handleSyncLoad(
    _event: IpcMainInvokeEvent,
    playbookId: string,
    forceSync = false,
  ): Promise<SyncResult> {
    console.log(
      `[PlaybookHandler] Loading playbook with lazy sync: ${playbookId}, force=${forceSync}`,
    );
    const result = await playbookSyncService.loadPlaybook(
      playbookId,
      forceSync,
    );

    // 메모리에도 로드
    if (result.success && result.playbook) {
      this.playbooks.set(result.playbook.metadata.id, result.playbook);
    }

    return result;
  }
}
