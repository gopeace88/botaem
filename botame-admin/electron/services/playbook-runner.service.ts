/**
 * Playbook Runner Service - Executes and validates playbooks using Playwright
 * v2: 자가 치유 엔진 통합
 */

import { Page } from 'playwright';
import { Playbook, PlaybookStep, IpcResult, SemanticStep } from '../../shared/types';
import { BrowserService } from './browser.service';
import { SelfHealingEngine } from '../core/self-healing';
import { Highlighter } from '../core/highlighter';

export type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export interface StepResult {
  stepId: string;
  stepIndex: number;
  status: StepStatus;
  message?: string;
  error?: string;
  duration?: number;
  screenshot?: string;
}

export interface RunnerState {
  isRunning: boolean;
  currentStepIndex: number;
  totalSteps: number;
  results: StepResult[];
  startTime?: number;
  endTime?: number;
}

type RunnerEventType = 'started' | 'step_started' | 'step_completed' | 'completed' | 'error' | 'paused' | 'resumed';

interface RunnerEvent {
  type: RunnerEventType;
  state: RunnerState;
  stepResult?: StepResult;
  error?: string;
}

type EventCallback = (event: RunnerEvent) => void;

export class PlaybookRunnerService {
  private browserService: BrowserService;
  private selfHealingEngine: SelfHealingEngine;
  private highlighter: Highlighter;
  private state: RunnerState = {
    isRunning: false,
    currentStepIndex: -1,
    totalSteps: 0,
    results: [],
  };
  private isPaused = false;
  private shouldStop = false;
  private eventListeners: EventCallback[] = [];

  constructor(browserService: BrowserService) {
    this.browserService = browserService;
    this.selfHealingEngine = new SelfHealingEngine();
    this.highlighter = new Highlighter();
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
   * Run a playbook
   */
  async runPlaybook(playbook: Playbook, startUrl?: string): Promise<IpcResult<StepResult[]>> {
    if (this.state.isRunning) {
      return { success: false, error: '이미 실행 중입니다.' };
    }

    // Verify browser connection first
    const connectionCheck = await this.browserService.verifyConnection();
    console.log(`[PlaybookRunner] Connection check: ${connectionCheck.details}`);

    if (!connectionCheck.connected) {
      console.log('[PlaybookRunner] Browser not connected, reinitializing...');
      await this.browserService.cleanup();
      const initResult = await this.browserService.initialize();
      if (!initResult.success) {
        return { success: false, error: initResult.error || '브라우저를 시작할 수 없습니다.' };
      }
    }

    // Get page from shared browser service
    let page = this.browserService.getPage();
    const browser = this.browserService.getBrowser();

    if (!page) {
      return { success: false, error: '브라우저 페이지를 가져올 수 없습니다.' };
    }

    try {
      // Log detailed diagnostics
      console.log(`[PlaybookRunner] Browser connected: ${browser?.isConnected()}`);
      console.log(`[PlaybookRunner] Page URL: ${page.url()}`);
      console.log(`[PlaybookRunner] Page isClosed: ${page.isClosed()}`);

      // Verify browser connection by executing a simple script
      try {
        const testResult = await page.evaluate(() => {
          // Add a prominent visual indicator to confirm we're connected
          let indicator = document.getElementById('botame-status-indicator');
          if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'botame-status-indicator';
            document.body.appendChild(indicator);
          }
          indicator.style.cssText = 'position:fixed;top:0;left:0;right:0;background:rgba(34,197,94,0.95);color:white;padding:15px;z-index:2147483647;font-size:16px;font-weight:bold;text-align:center;box-shadow:0 4px 6px rgba(0,0,0,0.3);';
          indicator.textContent = '🤖 Botame 플레이북 실행 중...';
          console.log('[Botame] PlaybookRunner connection test - PASSED');
          return { connected: true, url: window.location.href, title: document.title };
        });
        console.log(`[PlaybookRunner] Browser connection verified:`, testResult);
      } catch (evalError) {
        console.error(`[PlaybookRunner] Browser connection FAILED:`, evalError);
        // Try to reinitialize browser
        await this.browserService.cleanup();
        const reinitResult = await this.browserService.initialize();
        if (!reinitResult.success) {
          return { success: false, error: '브라우저 연결이 끊어졌습니다. 재연결 실패.' };
        }
        page = this.browserService.getPage();
        if (!page) {
          return { success: false, error: '브라우저를 다시 시작할 수 없습니다.' };
        }
      }

      // Bring page to front to ensure visibility
      await page.bringToFront();

      // Give a moment for the window to be visible
      await this.sleep(500);

      // 자가 치유 엔진 초기화
      await this.selfHealingEngine.initialize(page);
      this.highlighter.setPage(page);
      console.log('[PlaybookRunner] Self-healing engine initialized');

      // Initialize state
      this.state = {
        isRunning: true,
        currentStepIndex: -1,
        totalSteps: playbook.steps.length,
        results: [],
        startTime: Date.now(),
      };
      this.isPaused = false;
      this.shouldStop = false;

      this.emit({ type: 'started', state: this.state });

      console.log(`[PlaybookRunner] Started: ${playbook.metadata.name}`);

      const runnerPage = this.browserService.getPage();
      if (!runnerPage || runnerPage.isClosed()) {
        throw new Error('브라우저 페이지가 닫혔습니다.');
      }

      // Navigate to start URL if provided
      if (startUrl) {
        console.log(`[PlaybookRunner] Navigating to start URL: ${startUrl}`);
        await runnerPage.goto(startUrl, { waitUntil: 'networkidle' });
      }

      // Execute each step
      for (let i = 0; i < playbook.steps.length; i++) {
        if (this.shouldStop) {
          break;
        }

        // Wait if paused
        while (this.isPaused && !this.shouldStop) {
          await this.sleep(100);
        }

        if (this.shouldStop) {
          break;
        }

        const step = playbook.steps[i];
        this.state.currentStepIndex = i;

        const result = await this.executeStep(step, i);
        this.state.results.push(result);

        this.emit({ type: 'step_completed', state: this.state, stepResult: result });

        // If step failed and not optional, stop execution
        if (result.status === 'failed' && !step.optional) {
          console.log(`[PlaybookRunner] Step ${i + 1} failed, stopping execution`);
          break;
        }

        // Wait after step if specified (default 300ms for visibility)
        const waitTime = step.waitAfter || 300;
        await this.sleep(waitTime);
      }

      // Show completion in browser
      await runnerPage.evaluate(() => {
        const indicator = document.getElementById('botame-status-indicator');
        if (indicator) {
          indicator.style.background = 'rgba(34,197,94,0.95)';
          indicator.textContent = '✅ 플레이북 실행 완료!';
          setTimeout(() => indicator.remove(), 3000);
        }
      }).catch(() => {});

      // Complete
      this.state.isRunning = false;
      this.state.endTime = Date.now();

      this.emit({ type: 'completed', state: this.state });

      const successCount = this.state.results.filter((r) => r.status === 'success').length;
      const failedCount = this.state.results.filter((r) => r.status === 'failed').length;

      console.log(`[PlaybookRunner] Completed: ${successCount} success, ${failedCount} failed`);

      return {
        success: failedCount === 0,
        message: `실행 완료: ${successCount}/${this.state.totalSteps} 성공`,
        data: this.state.results,
      };
    } catch (error) {
      console.error('[PlaybookRunner] Error:', error);
      this.state.isRunning = false;

      this.emit({
        type: 'error',
        state: this.state,
        error: error instanceof Error ? error.message : '실행 오류',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : '플레이북 실행 오류',
      };
    } finally {
      // Don't close browser automatically - let user review
    }
  }

  /**
   * Execute a single step (v2: 자가 치유 적용)
   */
  private async executeStep(step: PlaybookStep, index: number): Promise<StepResult> {
    const startTime = Date.now();
    const page = this.browserService.getPage();

    const result: StepResult = {
      stepId: step.id,
      stepIndex: index,
      status: 'running',
    };

    this.emit({ type: 'step_started', state: this.state, stepResult: result });

    try {
      if (!page) {
        throw new Error('페이지가 없습니다.');
      }

      // 상태 표시
      await this.highlighter.showStatusBar(
        `Step ${index + 1}: ${step.message || step.action}`,
        'info'
      );

      switch (step.action) {
        case 'navigate':
          if (!step.value) throw new Error('URL이 필요합니다.');
          await page.goto(step.value, {
            waitUntil: 'networkidle',
            timeout: step.timeout || 30000,
          });
          result.message = `${step.value}로 이동`;
          break;

        case 'click':
          await this.executeClickWithHealing(step as SemanticStep, page);
          result.message = step.message || '클릭 완료';
          break;

        case 'type':
          if (step.value === undefined) throw new Error('입력 값이 필요합니다.');
          await this.executeTypeWithHealing(step as SemanticStep, step.value, page);
          result.message = step.message || `"${step.value}" 입력`;
          break;

        case 'select':
          if (!step.value) throw new Error('선택 값이 필요합니다.');
          await this.executeSelectWithHealing(step as SemanticStep, step.value, page);
          result.message = step.message || `${step.value} 선택`;
          break;

        case 'wait':
          const waitTime = step.timeout || 1000;
          await this.sleep(waitTime);
          result.message = `${waitTime}ms 대기`;
          break;

        case 'scroll':
          if (step.selector || (step as SemanticStep).smartSelector) {
            const healingResult = await this.selfHealingEngine.findElement(step as SemanticStep);
            if (healingResult.success && healingResult.locator) {
              await healingResult.locator.scrollIntoViewIfNeeded({ timeout: step.timeout || 5000 });
            }
          } else {
            await page.evaluate(() => window.scrollBy(0, 300));
          }
          result.message = '스크롤 완료';
          break;

        case 'hover':
          const hoverResult = await this.selfHealingEngine.findElement(step as SemanticStep);
          if (hoverResult.success && hoverResult.locator) {
            await hoverResult.locator.hover({ timeout: step.timeout || 5000 });
          }
          result.message = step.message || '호버 완료';
          break;

        case 'guide':
          result.message = step.message || '가이드 단계';
          break;

        default:
          throw new Error(`알 수 없는 액션: ${step.action}`);
      }

      result.status = 'success';
      result.duration = Date.now() - startTime;

      // 성공 하이라이트
      await this.highlighter.showSuccess(result.message || '완료');

      console.log(`[PlaybookRunner] Step ${index + 1} success: ${result.message}`);
    } catch (error) {
      result.status = step.optional ? 'skipped' : 'failed';
      result.error = error instanceof Error ? error.message : '알 수 없는 오류';
      result.duration = Date.now() - startTime;

      // 실패 하이라이트
      await this.highlighter.showError(result.error);

      console.error(`[PlaybookRunner] Step ${index + 1} failed:`, result.error);

      // 스크린샷 캡처
      try {
        if (page) {
          const screenshot = await page.screenshot({ type: 'png', fullPage: false });
          result.screenshot = screenshot.toString('base64');
        }
      } catch {
        // 스크린샷 오류 무시
      }
    }

    return result;
  }

  /**
   * 자가 치유를 적용한 클릭 실행
   */
  private async executeClickWithHealing(step: SemanticStep, page: Page): Promise<void> {
    const healingResult = await this.selfHealingEngine.findElement(step, true);

    if (!healingResult.success) {
      throw new Error(`요소를 찾을 수 없습니다: ${healingResult.error}`);
    }

    if (healingResult.usedStrategy === 'coordinates' && step.smartSelector?.coordinates) {
      // 좌표 기반 클릭
      await this.selfHealingEngine.clickByCoordinates(step.smartSelector.coordinates);
      console.log(`[PlaybookRunner] Clicked by coordinates`);
    } else if (healingResult.locator) {
      // 로케이터 기반 클릭
      await healingResult.locator.waitFor({ state: 'visible', timeout: step.timeout || 5000 });

      try {
        await healingResult.locator.click({ timeout: step.timeout || 5000 });
      } catch {
        // force 클릭 시도
        await healingResult.locator.click({ force: true, timeout: step.timeout || 5000 });
      }

      console.log(`[PlaybookRunner] Clicked with ${healingResult.usedStrategy}: ${healingResult.usedSelector?.value}`);
    }

    // 치유가 발생했으면 기록
    if (healingResult.healingRecord) {
      console.log(`[PlaybookRunner] Healing applied: ${healingResult.healingRecord.originalSelector} -> ${healingResult.healingRecord.healedSelector}`);
    }

    // 클릭 후 네트워크 안정화 대기
    await this.waitForNetworkIdle(page);
  }

  /**
   * 자가 치유를 적용한 입력 실행
   * 한글 입력을 위해 JavaScript evaluate 사용
   */
  private async executeTypeWithHealing(step: SemanticStep, value: string, page: Page): Promise<void> {
    const healingResult = await this.selfHealingEngine.findElement(step, true);

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
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);

    // fill() 방식도 시도 (일부 사이트에서 필요)
    try {
      await locator.fill(value, { timeout: 1000 });
    } catch {
      // JavaScript 방식이 성공했으면 무시
    }

    console.log(`[PlaybookRunner] Typed with ${healingResult.usedStrategy}: ${value}`);
  }

  /**
   * 자가 치유를 적용한 선택 실행
   */
  private async executeSelectWithHealing(step: SemanticStep, value: string, _page: Page): Promise<void> {
    const healingResult = await this.selfHealingEngine.findElement(step, true);

    if (!healingResult.success || !healingResult.locator) {
      throw new Error(`요소를 찾을 수 없습니다: ${healingResult.error}`);
    }

    await healingResult.locator.selectOption(value, { timeout: step.timeout || 5000 });

    console.log(`[PlaybookRunner] Selected with ${healingResult.usedStrategy}`);
  }

  /**
   * 네트워크 안정화 대기
   */
  private async waitForNetworkIdle(page: Page, timeout: number = 3000): Promise<void> {
    try {
      await page.waitForLoadState('networkidle', { timeout });
    } catch {
      // 타임아웃은 무시 (이미 안정화되었거나 오래 걸리는 요청)
    }
  }

  /**
   * Pause execution
   */
  pause(): void {
    if (this.state.isRunning && !this.isPaused) {
      this.isPaused = true;
      this.emit({ type: 'paused', state: this.state });
      console.log('[PlaybookRunner] Paused');
    }
  }

  /**
   * Resume execution
   */
  resume(): void {
    if (this.state.isRunning && this.isPaused) {
      this.isPaused = false;
      this.emit({ type: 'resumed', state: this.state });
      console.log('[PlaybookRunner] Resumed');
    }
  }

  /**
   * Stop execution
   */
  stop(): void {
    this.shouldStop = true;
    this.isPaused = false;
    console.log('[PlaybookRunner] Stop requested');
  }

  /**
   * Navigate back to main page after playbook completion
   */
  async navigateToMain(): Promise<void> {
    try {
      await this.browserService.navigateToMain();
      console.log('[PlaybookRunner] Navigated back to main page');
    } catch (error) {
      console.error('[PlaybookRunner] Navigate to main error:', error);
    }
    this.state.isRunning = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
