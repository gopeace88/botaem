/**
 * Playbook Runner Service - Executes and validates playbooks using Playwright
 * v2: 자가 치유 엔진 통합
 * v3: @botame/player PlaybookEngine 통합
 *
 * This service now uses PlaybookEngine from @botame/player for execution flow,
 * while preserving admin-specific features (self-healing, highlighting, picking).
 */

import { Page } from "playwright";
import {
  Playbook,
  PlaybookStep,
  IpcResult,
  SemanticStep,
} from "../../shared/types";
import { BrowserService } from "./browser.service";
import { PlaybookEngine, StepExecutor, EngineEvent } from "@botame/player";
import { ExecutionContext, PlaybookIssue } from "@botame/types";
import { SelfHealingAdapter } from "../core/self-healing-adapter";
import { Highlighter } from "../core/highlighter";
import { configLoader } from "../../shared/config";
import { getSupabaseService } from "./supabase.service";
import { randomUUID } from "crypto";

export type StepStatus =
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "skipped";

export interface StepResult {
  stepId: string;
  stepIndex: number;
  status: StepStatus;
  message?: string;
  error?: string;
  duration?: number;
  screenshot?: string;
  // 자동 고침 결과
  healed?: boolean;
  healedSelector?: string;
  originalSelector?: string;
  healMethod?: "fallback" | "text" | "aria" | "dynamic" | "manual";
}

export interface RunnerState {
  isRunning: boolean;
  currentStepIndex: number;
  totalSteps: number;
  results: StepResult[];
  startTime?: number;
  endTime?: number;
}

type RunnerEventType =
  | "started"
  | "step_started"
  | "step_completed"
  | "completed"
  | "error"
  | "paused"
  | "resumed";

interface RunnerEvent {
  type: RunnerEventType;
  state: RunnerState;
  stepResult?: StepResult;
  error?: string;
}

type EventCallback = (event: RunnerEvent) => void;

export class PlaybookRunnerService {
  private browserService: BrowserService;
  private selfHealingAdapter: SelfHealingAdapter;
  private highlighter: Highlighter;
  // PlaybookEngine from @botame/player handles execution flow
  private engine: PlaybookEngine;
  private state: RunnerState = {
    isRunning: false,
    currentStepIndex: -1,
    totalSteps: 0,
    results: [],
  };
  private eventListeners: EventCallback[] = [];

  constructor(browserService: BrowserService) {
    this.browserService = browserService;
    this.selfHealingAdapter = new SelfHealingAdapter();
    this.highlighter = new Highlighter();
    this.engine = new PlaybookEngine();

    // Set up step executor with admin-specific self-healing logic
    this.engine.setStepExecutor(this.createStepExecutor());

    // Wire up engine events to runner events
    this.setupEngineEventHandlers();
  }

  /**
   * Create step executor that uses admin's self-healing logic
   * This is called by PlaybookEngine for each step
   */
  private createStepExecutor(): StepExecutor {
    return async (step: PlaybookStep, context: ExecutionContext) => {
      const startTime = Date.now();
      const page = this.browserService.getPage();

      const result: StepResult = {
        stepId: step.id,
        stepIndex: context.currentStepIndex,
        status: "running",
      };

      try {
        if (!page) {
          throw new Error("페이지가 없습니다.");
        }

        // Show status bar
        await this.highlighter.showStatusBar(
          `Step ${context.currentStepIndex + 1}: ${step.message || step.action}`,
          "info",
        );

        // Execute step with self-healing
        await this.executeStepAction(step, page);

        result.status = "success";
        result.duration = Date.now() - startTime;

        // Add healing info if applicable
        if (this.lastHealingInfo?.healed) {
          result.healed = true;
          result.healedSelector = this.lastHealingInfo.healedSelector;
          result.originalSelector = this.lastHealingInfo.originalSelector;
          result.healMethod = this.lastHealingInfo.healMethod;
        }

        // Success highlight
        await this.highlighter.showSuccess(result.message || "완료");

        console.log(
          `[PlaybookRunner] Step ${context.currentStepIndex + 1} success: ${result.message}${result.healed ? " (healed)" : ""}`,
        );

        // Return in format expected by PlaybookEngine
        return {
          success: true,
          duration: result.duration,
        };
      } catch (error) {
        result.status = step.optional ? "skipped" : "failed";
        result.error =
          error instanceof Error ? error.message : "알 수 없는 오류";
        result.duration = Date.now() - startTime;

        // Failure highlight
        await this.highlighter.showError(result.error);

        console.error(
          `[PlaybookRunner] Step ${context.currentStepIndex + 1} failed:`,
          result.error,
        );

        // Capture screenshot on failure
        try {
          if (page) {
            const screenshot = await page.screenshot({
              type: "png",
              fullPage: false,
            });
            result.screenshot = screenshot.toString("base64");
          }
        } catch {
          // Screenshot error is not critical
        }

        // [Remote Repair] Report failure
        if (page && !step.optional) {
          await this.captureAndReportFailure(
            step as SemanticStep,
            page,
            error instanceof Error ? error : new Error(String(error))
          );
        }

        // Return in format expected by PlaybookEngine
        return {
          success: false,
          error: result.error,
        };
      }
    };
  }

  /**
   * Execute a step action with self-healing
   */
  private async executeStepAction(
    step: PlaybookStep,
    page: Page,
  ): Promise<void> {
    switch (step.action) {
      case "navigate":
        if (!step.value) throw new Error("URL이 필요합니다.");
        await page.goto(step.value, {
          waitUntil: "networkidle",
          timeout: step.timeout || 30000,
        });
        this.lastStepMessage = `${step.value}로 이동`;
        break;

      case "click":
        await this.executeClickWithHealing(step as SemanticStep, page);
        this.lastStepMessage = step.message || "클릭 완료";
        break;

      case "type":
        if (step.value === undefined) throw new Error("입력 값이 필요합니다.");
        await this.executeTypeWithHealing(
          step as SemanticStep,
          step.value,
          page,
        );
        this.lastStepMessage = step.message || `"${step.value}" 입력`;
        break;

      case "select":
        if (!step.value) throw new Error("선택 값이 필요합니다.");
        await this.executeSelectWithHealing(
          step as SemanticStep,
          step.value,
          page,
        );
        this.lastStepMessage = step.message || `${step.value} 선택`;
        break;

      case "wait":
        const waitTime = step.timeout || 1000;
        await this.sleep(waitTime);
        this.lastStepMessage = `${waitTime}ms 대기`;
        break;

      case "scroll":
        if (step.selector || (step as SemanticStep).smartSelector) {
          const healingResult = await this.selfHealingAdapter.findElement(
            step as SemanticStep,
          );
          if (healingResult.success && healingResult.locator) {
            await healingResult.locator.scrollIntoViewIfNeeded({
              timeout: step.timeout || 5000,
            });
          }
        } else {
          await page.evaluate(() => window.scrollBy(0, 300));
        }
        this.lastStepMessage = "스크롤 완료";
        break;

      case "hover":
        const hoverResult = await this.selfHealingAdapter.findElement(
          step as SemanticStep,
        );
        if (hoverResult.success && hoverResult.locator) {
          await hoverResult.locator.hover({ timeout: step.timeout || 5000 });
        }
        this.lastStepMessage = step.message || "호버 완료";
        break;

      case "guide":
        this.lastStepMessage = step.message || "가이드 단계";
        break;

      default:
        throw new Error(`알 수 없는 액션: ${step.action}`);
    }
  }

  /**
   * Set up event handlers to bridge PlaybookEngine events to RunnerEvents
   */
  private setupEngineEventHandlers(): void {
    this.engine.on("started", () => {
      this.emit({ type: "started", state: this.state });
    });

    this.engine.on("step_started", (data) => {
      // Convert engine event to runner event
      const stepStartedEvent = data as Extract<
        EngineEvent,
        { type: "step_started" }
      >;
      const result: StepResult = {
        stepId: stepStartedEvent.step.id,
        stepIndex: stepStartedEvent.stepIndex,
        status: "running",
      };
      this.emit({
        type: "step_started",
        state: this.state,
        stepResult: result,
      });
    });

    this.engine.on("step_completed", (data) => {
      // Map engine result to runner result
      const stepCompletedEvent = data as Extract<
        EngineEvent,
        { type: "step_completed" }
      >;
      const result: StepResult = {
        stepId: stepCompletedEvent.result.stepId || "unknown",
        stepIndex: stepCompletedEvent.stepIndex,
        status: stepCompletedEvent.result.success ? "success" : "failed",
        message: this.lastStepMessage,
        error: stepCompletedEvent.result.error,
        duration: stepCompletedEvent.result.duration,
        healed: this.lastHealingInfo?.healed,
        healedSelector: this.lastHealingInfo?.healedSelector,
        originalSelector: this.lastHealingInfo?.originalSelector,
        healMethod: this.lastHealingInfo?.healMethod,
      };

      this.state.results.push(result);
      this.emit({
        type: "step_completed",
        state: this.state,
        stepResult: result,
      });
    });

    this.engine.on("completed", () => {
      this.state.isRunning = false;
      this.state.endTime = Date.now();
      this.emit({ type: "completed", state: this.state });
    });

    this.engine.on("error", (data) => {
      const errorEvent = data as Extract<EngineEvent, { type: "error" }>;
      this.state.isRunning = false;
      this.emit({
        type: "error",
        state: this.state,
        error: errorEvent.error.message || "실행 오류",
      });
    });

    this.engine.on("paused", () => {
      this.emit({ type: "paused", state: this.state });
    });

    this.engine.on("resumed", () => {
      this.emit({ type: "resumed", state: this.state });
    });
  }

  /**
   * Subscribe to runner events
   */
  onEvent(callback: EventCallback): void {
    this.eventListeners.push(callback);
  }

  private emit(event: RunnerEvent): void {
    this.eventListeners.forEach((cb) => cb(event));
  }

  /**
   * Get current state
   */
  getState(): RunnerState {
    return { ...this.state };
  }

  /**
   * Run a playbook using PlaybookEngine
   */
  async runPlaybook(
    playbook: Playbook,
    startUrl?: string,
  ): Promise<IpcResult<StepResult[]>> {
    if (this.state.isRunning) {
      return { success: false, error: "이미 실행 중입니다." };
    }

    // Verify browser connection first
    const connectionCheck = await this.browserService.verifyConnection();
    console.log(
      `[PlaybookRunner] Connection check: ${connectionCheck.details}`,
    );

    if (!connectionCheck.connected) {
      console.log("[PlaybookRunner] Browser not connected, reinitializing...");
      await this.browserService.cleanup();
      const initResult = await this.browserService.initialize();
      if (!initResult.success) {
        return {
          success: false,
          error: initResult.error || "브라우저를 시작할 수 없습니다.",
        };
      }
    }

    // Get page from shared browser service
    let page = this.browserService.getPage();
    const browser = this.browserService.getBrowser();

    if (!page) {
      return { success: false, error: "브라우저 페이지를 가져올 수 없습니다." };
    }

    try {
      // Log detailed diagnostics
      console.log(
        `[PlaybookRunner] Browser connected: ${browser?.isConnected()}`,
      );
      console.log(`[PlaybookRunner] Page URL: ${page.url()}`);
      console.log(`[PlaybookRunner] Page isClosed: ${page.isClosed()}`);

      // Verify browser connection by executing a simple script
      try {
        const testResult = await page.evaluate(() => {
          // Add a prominent visual indicator to confirm we're connected
          let indicator = document.getElementById("botame-status-indicator");
          if (!indicator) {
            indicator = document.createElement("div");
            indicator.id = "botame-status-indicator";
            document.body.appendChild(indicator);
          }
          indicator.style.cssText =
            "position:fixed;top:0;left:0;right:0;background:rgba(34,197,94,0.95);color:white;padding:15px;z-index:2147483647;font-size:16px;font-weight:bold;text-align:center;box-shadow:0 4px 6px rgba(0,0,0,0.3);";
          indicator.textContent = "🤖 Botame 플레이북 실행 중...";
          console.log("[Botame] PlaybookRunner connection test - PASSED");
          return {
            connected: true,
            url: window.location.href,
            title: document.title,
          };
        });
        console.log(
          `[PlaybookRunner] Browser connection verified:`,
          testResult,
        );
      } catch (evalError) {
        console.error(`[PlaybookRunner] Browser connection FAILED:`, evalError);
        // Try to reinitialize browser
        await this.browserService.cleanup();
        const reinitResult = await this.browserService.initialize();
        if (!reinitResult.success) {
          return {
            success: false,
            error: "브라우저 연결이 끊어졌습니다. 재연결 실패.",
          };
        }
        page = this.browserService.getPage();
        if (!page) {
          return {
            success: false,
            error: "브라우저를 다시 시작할 수 없습니다.",
          };
        }
      }

      // Bring page to front to ensure visibility
      await page.bringToFront();

      // Give a moment for the window to be visible
      await this.sleep(500);

      await this.selfHealingAdapter.initialize(page);
      this.highlighter.setPage(page);
      console.log("[PlaybookRunner] Self-healing adapter initialized");

      // Initialize state
      this.state = {
        isRunning: true,
        currentStepIndex: -1,
        totalSteps: playbook.steps.length,
        results: [],
        startTime: Date.now(),
      };

      console.log(`[PlaybookRunner] Started: ${playbook.metadata.name}`);

      const runnerPage = this.browserService.getPage();
      if (!runnerPage || runnerPage.isClosed()) {
        throw new Error("브라우저 페이지가 닫혔습니다.");
      }

      // Navigate to start URL if provided
      if (startUrl) {
        console.log(`[PlaybookRunner] Navigating to start URL: ${startUrl}`);
        await runnerPage.goto(startUrl, { waitUntil: "networkidle" });
      }

      // Load playbook into engine and start execution
      this.engine.load(playbook);

      // Start execution (this will use the step executor we set up)
      await this.engine.start();

      // Show completion in browser
      await runnerPage
        .evaluate(() => {
          const indicator = document.getElementById("botame-status-indicator");
          if (indicator) {
            indicator.style.background = "rgba(34,197,94,0.95)";
            indicator.textContent = "✅ 플레이북 실행 완료!";
            setTimeout(() => indicator.remove(), 3000);
          }
        })
        .catch(() => { });

      const successCount = this.state.results.filter(
        (r) => r.status === "success",
      ).length;
      const failedCount = this.state.results.filter(
        (r) => r.status === "failed",
      ).length;

      console.log(
        `[PlaybookRunner] Completed: ${successCount} success, ${failedCount} failed`,
      );

      return {
        success: failedCount === 0,
        message: `실행 완료: ${successCount}/${this.state.totalSteps} 성공`,
        data: this.state.results,
      };
    } catch (error) {
      console.error("[PlaybookRunner] Error:", error);
      this.state.isRunning = false;

      this.emit({
        type: "error",
        state: this.state,
        error: error instanceof Error ? error.message : "실행 오류",
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "플레이북 실행 오류",
      };
    } finally {
      // Don't close browser automatically - let user review
    }
  }

  /**
   * 자가 치유 결과 정보
   */
  private lastHealingInfo: {
    healed: boolean;
    healedSelector?: string;
    originalSelector?: string;
    healMethod?: "fallback" | "text" | "aria" | "dynamic" | "manual";
  } | null = null;

  /**
   * Last step message (for event reporting)
   */
  private lastStepMessage: string = "";

  /**
   * 자가 치유를 적용한 클릭 실행
   */
  private async executeClickWithHealing(
    step: SemanticStep,
    page: Page,
  ): Promise<void> {
    this.lastHealingInfo = null;
    const originalSelector =
      step.selector || step.smartSelector?.primary?.value;

    const healingResult = await this.selfHealingAdapter.findElement(step, true);

    if (!healingResult.success) {
      // 동적 텍스트 탐색 시도 (step.message 기반)
      const dynamicResult = await this.tryDynamicTextSearch(step, page);
      if (dynamicResult.success && dynamicResult.locator) {
        await dynamicResult.locator.click({ timeout: step.timeout || 5000 });
        this.lastHealingInfo = {
          healed: true,
          healedSelector: dynamicResult.selector,
          originalSelector,
          healMethod: "dynamic",
        };
        await this.waitForNetworkIdle(page);
        return;
      }
      throw new Error(`요소를 찾을 수 없습니다: ${healingResult.error}`);
    }

    if (
      healingResult.usedStrategy === "coordinates" &&
      step.smartSelector?.coordinates
    ) {
      await this.selfHealingAdapter.clickByCoordinates(
        step.smartSelector.coordinates,
      );
      console.log(`[PlaybookRunner] Clicked by coordinates`);
    } else if (healingResult.locator) {
      // 로케이터 기반 클릭
      await healingResult.locator.waitFor({
        state: "visible",
        timeout: step.timeout || 5000,
      });

      try {
        await healingResult.locator.click({ timeout: step.timeout || 5000 });
      } catch {
        // force 클릭 시도
        await healingResult.locator.click({
          force: true,
          timeout: step.timeout || 5000,
        });
      }

      console.log(
        `[PlaybookRunner] Clicked with ${healingResult.usedStrategy}: ${healingResult.usedSelector?.value}`,
      );
    }

    // 치유가 발생했으면 기록
    if (healingResult.healingRecord) {
      console.log(
        `[PlaybookRunner] Healing applied: ${healingResult.healingRecord.originalSelector} -> ${healingResult.healingRecord.healedSelector}`,
      );
      this.lastHealingInfo = {
        healed: true,
        healedSelector: healingResult.healingRecord.healedSelector,
        originalSelector: healingResult.healingRecord.originalSelector,
        healMethod: "fallback",
      };
    }

    // 클릭 후 네트워크 안정화 대기
    await this.waitForNetworkIdle(page);
  }

  /**
   * 동적 텍스트 탐색 (step.message 기반)
   */
  private async tryDynamicTextSearch(
    step: PlaybookStep,
    page: Page,
  ): Promise<{
    success: boolean;
    locator?: import("playwright").Locator;
    selector?: string;
  }> {
    if (!step.message) return { success: false };

    // 메시지에서 키워드 추출 ("교부관리 클릭" -> "교부관리")
    const keywords = this.extractKeywords(step.message);

    for (const keyword of keywords) {
      // 1. 정확한 텍스트 매칭
      try {
        const exactSelector = `text="${keyword}"`;
        const exactLocator = page.locator(exactSelector);
        if (
          (await exactLocator.count()) === 1 &&
          (await exactLocator.isVisible())
        ) {
          console.log(`[PlaybookRunner] Dynamic text match: ${exactSelector}`);
          return {
            success: true,
            locator: exactLocator,
            selector: exactSelector,
          };
        }
      } catch { }

      // 2. 부분 텍스트 매칭
      try {
        const partialSelector = `text=${keyword}`;
        const partialLocator = page.locator(partialSelector).first();
        if (
          (await partialLocator.count()) >= 1 &&
          (await partialLocator.isVisible())
        ) {
          console.log(
            `[PlaybookRunner] Dynamic partial text match: ${partialSelector}`,
          );
          return {
            success: true,
            locator: partialLocator,
            selector: partialSelector,
          };
        }
      } catch { }

      // 3. aria-label 부분 매칭
      try {
        const ariaSelector = `[aria-label*="${keyword}"]`;
        const ariaLocator = page.locator(ariaSelector).first();
        if (
          (await ariaLocator.count()) >= 1 &&
          (await ariaLocator.isVisible())
        ) {
          console.log(`[PlaybookRunner] Dynamic aria match: ${ariaSelector}`);
          return {
            success: true,
            locator: ariaLocator,
            selector: ariaSelector,
          };
        }
      } catch { }
    }

    return { success: false };
  }

  /**
   * 메시지에서 키워드 추출
   */
  private extractKeywords(message: string): string[] {
    // "교부관리 메뉴 클릭" -> ["교부관리"]
    // "로그인 버튼 클릭" -> ["로그인"]
    // 정확히 일치하는 stopword만 제거 (부분 일치 X)
    const selectorConfig = configLoader.getSelectorConfig();
    const exactStopWords = selectorConfig.stopWords;
    const suffixStopWords = selectorConfig.keywordSuffixes;

    const words = message.split(/\s+/).filter((word) => {
      const cleaned = word.trim();
      if (cleaned.length < 2) return false;

      // 정확히 stopword와 일치하면 제외
      if (exactStopWords.includes(cleaned)) return false;

      // 접미사 stopword로 끝나면 접미사 제거 후 반환하도록 처리 (여기서는 일단 제외)
      // 향후 개선: "홈으로" -> "홈" 추출
      for (const suffix of suffixStopWords) {
        if (cleaned.endsWith(suffix) && cleaned.length > suffix.length) {
          return false; // 일단 제외 (나중에 접미사 제거 로직 추가 가능)
        }
      }

      return true;
    });

    return words;
  }

  /**
   * 자가 치유를 적용한 입력 실행
   * 한글 입력을 위해 JavaScript evaluate 사용
   */
  private async executeTypeWithHealing(
    step: SemanticStep,
    value: string,
    _page: Page,
  ): Promise<void> {
    const healingResult = await this.selfHealingAdapter.findElement(step, true);

    if (!healingResult.success || !healingResult.locator) {
      throw new Error(`요소를 찾을 수 없습니다: ${healingResult.error}`);
    }

    const locator = healingResult.locator;

    // 요소에 포커스
    await locator.click({ timeout: step.timeout || 5000 });

    // JavaScript를 통해 직접 값 설정 (한글 입력 지원)
    await locator.evaluate((el, val) => {
      const input = el as HTMLInputElement;
      input.value = val;
      // 이벤트 발생시켜 프레임워크가 감지하도록
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);

    // fill() 방식도 시도 (일부 사이트에서 필요)
    try {
      await locator.fill(value, { timeout: 1000 });
    } catch {
      // JavaScript 방식이 성공했으면 무시
    }

    console.log(
      `[PlaybookRunner] Typed with ${healingResult.usedStrategy}: ${value}`,
    );
  }

  /**
   * 자가 치유를 적용한 선택 실행
   */
  private async executeSelectWithHealing(
    step: SemanticStep,
    value: string,
    _page: Page,
  ): Promise<void> {
    const healingResult = await this.selfHealingAdapter.findElement(step, true);

    if (!healingResult.success || !healingResult.locator) {
      throw new Error(`요소를 찾을 수 없습니다: ${healingResult.error}`);
    }

    await healingResult.locator.selectOption(value, {
      timeout: step.timeout || 5000,
    });

    console.log(`[PlaybookRunner] Selected with ${healingResult.usedStrategy}`);
  }

  /**
   * 네트워크 안정화 대기
   */
  private async waitForNetworkIdle(
    page: Page,
    timeout: number = 3000,
  ): Promise<void> {
    try {
      await page.waitForLoadState("networkidle", { timeout });
    } catch {
      // 타임아웃은 무시 (이미 안정화되었거나 오래 걸리는 요청)
    }
  }

  /**
   * Pause execution
   */
  pause(): void {
    this.engine.pause();
    console.log("[PlaybookRunner] Paused");
  }

  /**
   * Resume execution
   */
  resume(): void {
    this.engine.resume();
    console.log("[PlaybookRunner] Resumed");
  }

  /**
   * Stop execution
   */
  stop(): void {
    this.engine.stop();
    console.log("[PlaybookRunner] Stop requested");
  }

  /**
   * Navigate back to main page after playbook completion
   */
  async navigateToMain(): Promise<void> {
    try {
      await this.browserService.navigateToMain();
      console.log("[PlaybookRunner] Navigated back to main page");
    } catch (error) {
      console.error("[PlaybookRunner] Navigate to main error:", error);
    }
    this.state.isRunning = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Run a single step (for step-by-step execution/testing)
   */
  async runSingleStep(
    step: PlaybookStep,
    stepIndex: number,
  ): Promise<StepResult> {
    // Verify browser connection first
    const connectionCheck = await this.browserService.verifyConnection();
    if (!connectionCheck.connected) {
      console.log("[PlaybookRunner] Browser not connected, reinitializing...");
      await this.browserService.cleanup();
      const initResult = await this.browserService.initialize();
      if (!initResult.success) {
        return {
          stepId: step.id,
          stepIndex,
          status: "failed",
          error: "브라우저를 시작할 수 없습니다.",
        };
      }
    }

    const page = this.browserService.getPage();
    if (!page) {
      return {
        stepId: step.id,
        stepIndex,
        status: "failed",
        error: "브라우저 페이지를 가져올 수 없습니다.",
      };
    }

    await this.selfHealingAdapter.initialize(page);
    this.highlighter.setPage(page);

    // Execute the step directly
    const startTime = Date.now();
    const result: StepResult = {
      stepId: step.id,
      stepIndex,
      status: "running",
    };

    try {
      await this.executeStepAction(step, page);
      result.status = "success";
      result.duration = Date.now() - startTime;

      if (this.lastHealingInfo?.healed) {
        result.healed = true;
        result.healedSelector = this.lastHealingInfo.healedSelector;
        result.originalSelector = this.lastHealingInfo.originalSelector;
        result.healMethod = this.lastHealingInfo.healMethod;
      }

      return result;
    } catch (error) {
      result.status = step.optional ? "skipped" : "failed";
      result.error = error instanceof Error ? error.message : "알 수 없는 오류";
      result.duration = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Start element picking mode - user can click on an element to capture its selector
   * Returns the captured element info when user clicks
   */
  async startPickingMode(): Promise<
    IpcResult<{
      selector: string;
      elementInfo: {
        tagName: string;
        id?: string;
        className?: string;
        text?: string;
        ariaLabel?: string;
        name?: string;
        placeholder?: string;
        type?: string;
      };
    }>
  > {
    const page = this.browserService.getPage();
    if (!page) {
      return { success: false, error: "브라우저가 열려있지 않습니다." };
    }

    try {
      // Inject picking script
      const result = await page.evaluate(() => {
        return new Promise<{
          selector: string;
          elementInfo: {
            tagName: string;
            id?: string;
            className?: string;
            text?: string;
            ariaLabel?: string;
            name?: string;
            placeholder?: string;
            type?: string;
          };
        }>((resolve) => {
          // 피킹 오버레이 추가
          const overlay = document.createElement("div");
          overlay.id = "botame-picking-overlay";
          overlay.style.cssText =
            "position:fixed;top:0;left:0;right:0;background:rgba(59,130,246,0.95);color:white;padding:15px;z-index:2147483647;font-size:14px;text-align:center;";
          overlay.innerHTML = "🎯 수정할 요소를 클릭하세요 (ESC로 취소)";
          document.body.appendChild(overlay);

          let highlightBox: HTMLDivElement | null = null;
          let currentElement: HTMLElement | null = null;

          // 호버 하이라이트
          const handleMouseMove = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target === overlay || target === highlightBox) return;

            currentElement = target;

            if (!highlightBox) {
              highlightBox = document.createElement("div");
              highlightBox.id = "botame-highlight-box";
              highlightBox.style.cssText =
                "position:fixed;border:3px solid #3b82f6;background:rgba(59,130,246,0.2);pointer-events:none;z-index:2147483646;transition:all 0.1s;";
              document.body.appendChild(highlightBox);
            }

            const rect = target.getBoundingClientRect();
            highlightBox.style.left = rect.left + "px";
            highlightBox.style.top = rect.top + "px";
            highlightBox.style.width = rect.width + "px";
            highlightBox.style.height = rect.height + "px";
          };

          // 클릭 캡처
          const handleClick = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();

            const target = currentElement || (e.target as HTMLElement);
            if (target === overlay || target === highlightBox) return;

            // 정리
            cleanup();

            // 셀렉터 생성
            const selector = generateSelector(target);
            const elementInfo = {
              tagName: target.tagName,
              id: target.id || undefined,
              className: target.className || undefined,
              text: target.textContent?.trim().slice(0, 50) || undefined,
              ariaLabel: target.getAttribute("aria-label") || undefined,
              name: target.getAttribute("name") || undefined,
              placeholder:
                (target as HTMLInputElement).placeholder || undefined,
              type: (target as HTMLInputElement).type || undefined,
            };

            resolve({ selector, elementInfo });
          };

          // ESC 취소
          const handleKeydown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
              cleanup();
              resolve({ selector: "", elementInfo: { tagName: "" } });
            }
          };

          function cleanup() {
            overlay.remove();
            highlightBox?.remove();
            document.removeEventListener("mousemove", handleMouseMove, true);
            document.removeEventListener("click", handleClick, true);
            document.removeEventListener("keydown", handleKeydown, true);
          }

          function generateSelector(el: HTMLElement): string {
            const tagName = el.tagName.toLowerCase();

            // aria-label
            const ariaLabel = el.getAttribute("aria-label");
            if (ariaLabel) {
              return `${tagName}[aria-label="${CSS.escape(ariaLabel)}"]`;
            }

            // name 속성
            const name = el.getAttribute("name");
            if (name) {
              return `${tagName}[name="${CSS.escape(name)}"]`;
            }

            // data-testid
            const testId = el.getAttribute("data-testid");
            if (testId) {
              return `[data-testid="${CSS.escape(testId)}"]`;
            }

            // ID
            if (el.id && !/^\d|^[a-f0-9-]{36}$/i.test(el.id)) {
              return `#${CSS.escape(el.id)}`;
            }

            // placeholder
            const placeholder = (el as HTMLInputElement).placeholder;
            if (placeholder) {
              return `${tagName}[placeholder="${CSS.escape(placeholder)}"]`;
            }

            // type (for inputs)
            const type = (el as HTMLInputElement).type;
            if (
              tagName === "input" &&
              type &&
              ["password", "email", "tel", "search"].includes(type)
            ) {
              return `input[type="${type}"]`;
            }

            // CSS path (짧게)
            const path = [];
            let current: HTMLElement | null = el;
            let depth = 0;
            while (current && current !== document.body && depth < 3) {
              let selector = current.tagName.toLowerCase();
              if (current.id) {
                path.unshift("#" + CSS.escape(current.id));
                break;
              }
              if (current.className) {
                const classes = current.className
                  .split(" ")
                  .filter((c: string) => c.trim() && !/^(css-|sc-|_)/.test(c))
                  .slice(0, 2);
                if (classes.length)
                  selector +=
                    "." + classes.map((c: string) => CSS.escape(c)).join(".");
              }
              path.unshift(selector);
              current = current.parentElement;
              depth++;
            }
            return path.join(" > ");
          }

          document.addEventListener("mousemove", handleMouseMove, true);
          document.addEventListener("click", handleClick, true);
          document.addEventListener("keydown", handleKeydown, true);
        });
      });

      if (!result.selector) {
        return { success: false, error: "요소 선택이 취소되었습니다." };
      }

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "피킹 모드 오류",
      };
    }
  }

  /**
   * Cancel picking mode
   */
  async cancelPickingMode(): Promise<void> {
    const page = this.browserService.getPage();
    if (!page) return;

    await page
      .evaluate(() => {
        const overlay = document.getElementById("botame-picking-overlay");
        const highlightBox = document.getElementById("botame-highlight-box");
        overlay?.remove();
        highlightBox?.remove();
      })
      .catch(() => { });
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    // Remove all event listeners to prevent memory leaks
    this.engine.removeAllListeners();
    this.engine.dispose();
    this.eventListeners = [];
  }

  /**
   * [Remote Repair] 실패 및 컨텍스트 캡처
   */
  private async captureAndReportFailure(
    step: SemanticStep,
    page: Page,
    error: Error
  ): Promise<void> {
    try {
      console.log('[PlaybookRunner] Capturing failure context for Remote Repair...');
      const supabaseService = getSupabaseService();

      // 1. Capture DOM Snapshot (surrounding only)
      const domSnapshot = await page.evaluate(() => {
        return document.body.outerHTML.slice(0, 10000);
      });

      // 2. Create Issue
      // Note: SemanticStep and PlaybookStep types might differ in this codebase.
      // We cast step to any to access properties safely or use SemanticStep intersection
      const smartStep = step as SemanticStep;

      const issue: PlaybookIssue = {
        id: randomUUID(),
        title: `Step Failed: ${step.action} (Index: ${this.state.currentStepIndex})`,
        description: error.message,
        status: 'open',
        playbookId: this.engine.getPlaybook()?.metadata.id || 'unknown',
        stepIndex: this.state.currentStepIndex,
        errorType: 'NotFound',
        timestamp: Date.now(),
        elementInfo: {
          tagName: smartStep.smartSelector?.snapshot?.tagName || 'UNKNOWN',
          text: smartStep.smartSelector?.snapshot?.textContent,
          id: smartStep.smartSelector?.snapshot?.attributes?.id,
          className: smartStep.smartSelector?.snapshot?.attributes?.class,
          role: smartStep.smartSelector?.snapshot?.role
        } as any,
        domSnapshot,
        environment: {
          os: process.platform,
          browser: 'chrome',
          version: 'unknown'
        }
      };

      // 3. Report
      await supabaseService.submitFailureReport(issue);

    } catch (captureError) {
      console.error('[PlaybookRunner] Failed to capture failure context:', captureError);
    }
  }

}
