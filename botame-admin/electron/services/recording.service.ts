/**
 * Recording Service - Captures browser actions using Playwright
 * v2: 스마트 셀렉터 통합
 */

import { Page } from "playwright";
import {
  RecordingState,
  RecordedAction,
  PlaybookStep,
  Playbook,
  PlaybookMetadata,
  IpcResult,
  SmartSelector,
  ElementSnapshot,
  ElementIdentity,
  SemanticStepV3,
  SemanticStepV4,
  BoundingBox,
  EnhancedFallbacks,
  TextBasedSelector,
  ParentChainSelector,
  NearbyLabelSelector,
  StructuralPosition,
  ParentInfo,
  TextPatterns,
  TextVariation,
} from "../../shared/types";
import { BrowserService } from "./browser.service";
import { SnapshotService } from "../core/snapshot.service";
import { SmartSelectorGenerator, generateSelectors } from "@botame/recorder";
import {
  SemanticSelectorGenerator,
  SemanticSelectorResult,
} from "../core/semantic-selector";
import { AccessibilityService } from "../core/accessibility.service";
import { SiteCacheService } from "./site-cache.service";
import { AISelectorService, getAISelectorService } from "./ai-selector.service";
import { configLoader } from "../../shared/config";

type RecordingEventType =
  | "started"
  | "stopped"
  | "paused"
  | "resumed"
  | "action_recorded"
  | "error";

interface RecordingEvent {
  type: RecordingEventType;
  action?: RecordedAction;
  step?: PlaybookStep;
  steps?: PlaybookStep[];
  error?: string;
}

type EventCallback = (event: RecordingEvent) => void;

export class RecordingService {
  private browserService: BrowserService | null = null;
  private snapshotService: SnapshotService;
  private selectorGenerator: SmartSelectorGenerator;
  private semanticSelectorGenerator: SemanticSelectorGenerator;
  private accessibilityService: AccessibilityService; // v3: Accessibility 서비스 추가
  private siteCacheService: SiteCacheService;
  private aiSelectorService: AISelectorService; // AI 폴백 셀렉터 생성
  private state: RecordingState = "idle";
  private recordedActions: RecordedAction[] = [];
  private recordedSteps: SemanticStepV3[] = []; // v3: SemanticStepV3로 변경
  private stepCounter = 0;
  private eventListeners: EventCallback[] = [];
  private recordingStartUrl: string | null = null; // 녹화 시작 시점의 URL

  constructor() {
    this.snapshotService = new SnapshotService();
    this.selectorGenerator = new SmartSelectorGenerator();
    this.semanticSelectorGenerator = new SemanticSelectorGenerator();
    this.accessibilityService = new AccessibilityService(); // v3
    this.siteCacheService = new SiteCacheService();
    this.aiSelectorService = getAISelectorService(); // AI 셀렉터 서비스 초기화
  }

  /**
   * Set the site cache service (with Supabase client)
   */
  setSiteCacheService(siteCacheService: SiteCacheService): void {
    this.siteCacheService = siteCacheService;
  }

  /**
   * Set the browser service (called from main.ts after initialization)
   */
  setBrowserService(browserService: BrowserService): void {
    this.browserService = browserService;
  }

  /**
   * Subscribe to recording events
   */
  onEvent(callback: EventCallback): void {
    this.eventListeners.push(callback);
  }

  private emit(event: RecordingEvent): void {
    this.eventListeners.forEach((cb) => cb(event));
  }

  /**
   * Start recording
   */
  async startRecording(targetUrl?: string): Promise<IpcResult> {
    if (this.state !== "idle") {
      return { success: false, error: "이미 녹화 중입니다." };
    }

    if (!this.browserService) {
      return {
        success: false,
        error: "브라우저 서비스가 설정되지 않았습니다.",
      };
    }

    try {
      // Get page from shared browser service
      let page = this.browserService.getPage();
      if (!page) {
        // Browser not initialized, try to initialize
        const initResult = await this.browserService.initialize();
        if (!initResult.success) {
          return {
            success: false,
            error: initResult.error || "브라우저를 시작할 수 없습니다.",
          };
        }
        page = this.browserService.getPage();
      }

      if (!page) {
        return {
          success: false,
          error: "브라우저 페이지를 가져올 수 없습니다.",
        };
      }

      // 스냅샷 서비스 초기화
      await this.snapshotService.initialize(page);
      console.log("[RecordingService] Snapshot service initialized");

      // v3: Accessibility 서비스 초기화
      await this.accessibilityService.initialize(page);
      console.log("[RecordingService] Accessibility service initialized");

      // Expose recording function
      await page
        .exposeFunction(
          "__botameRecordAction",
          async (action: RecordedAction) => {
            if (this.state === "recording") {
              await this.handleRecordedAction(action);
            }
          },
        )
        .catch(() => {
          // Function might already be exposed, ignore
        });

      // Inject recording script
      await this.injectRecordingScript(page);

      // Navigate if URL provided
      if (targetUrl) {
        await page.goto(targetUrl);
      }

      // Reset state
      this.recordedActions = [];
      this.recordedSteps = [];
      this.stepCounter = 0;
      this.state = "recording";

      // 녹화 시작 시점의 URL 저장 (재생 시 이 URL로 이동)
      this.recordingStartUrl = page.url();
      console.log(
        "[RecordingService] Recording start URL:",
        this.recordingStartUrl,
      );

      // Add initial guide step
      this.addGuideStep("녹화를 시작합니다.");

      this.emit({ type: "started" });

      console.log("[RecordingService] Started");

      return { success: true, message: "녹화가 시작되었습니다." };
    } catch (error) {
      console.error("[RecordingService] Failed to start:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "녹화 시작 실패",
      };
    }
  }

  /**
   * Stop recording
   */
  async stopRecording(): Promise<IpcResult<PlaybookStep[]>> {
    if (this.state === "idle") {
      return { success: false, error: "녹화 중이 아닙니다." };
    }

    // Add final guide step
    this.addGuideStep("녹화가 완료되었습니다.");

    this.state = "idle";
    const steps = [...this.recordedSteps];

    // Close browser
    await this.cleanup();

    this.emit({ type: "stopped", steps });

    console.log(`[RecordingService] Stopped. Total steps: ${steps.length}`);

    return {
      success: true,
      message: `녹화가 완료되었습니다. ${steps.length}개의 단계가 기록되었습니다.`,
      data: steps,
    };
  }

  /**
   * Pause recording
   */
  pauseRecording(): void {
    if (this.state === "recording") {
      this.state = "paused";
      this.emit({ type: "paused" });
      console.log("[RecordingService] Paused");
    }
  }

  /**
   * Resume recording
   */
  resumeRecording(): void {
    if (this.state === "paused") {
      this.state = "recording";
      this.emit({ type: "resumed" });
      console.log("[RecordingService] Resumed");
    }
  }

  /**
   * Get current state
   */
  getState(): RecordingState {
    return this.state;
  }

  /**
   * Get recorded steps
   */
  getRecordedSteps(): SemanticStepV3[] {
    return [...this.recordedSteps];
  }

  /**
   * Get recorded actions (raw)
   */
  getRecordedActions(): RecordedAction[] {
    return [...this.recordedActions];
  }

  /**
   * Clear recording
   */
  clearRecording(): void {
    this.fullReset();
  }

  /**
   * Delete a specific step
   */
  deleteStep(index: number): void {
    if (index >= 0 && index < this.recordedSteps.length) {
      this.recordedSteps.splice(index, 1);
      console.log(`[RecordingService] Deleted step ${index}`);
    }
  }

  /**
   * Generate playbook from recorded steps
   */
  generatePlaybook(metadata: Partial<PlaybookMetadata>): IpcResult<Playbook> {
    if (this.recordedSteps.length === 0) {
      return { success: false, error: "녹화된 단계가 없습니다." };
    }

    // startUrl 결정: 1) 메타데이터에서 전달된 값 2) 녹화 시작 시점 URL 3) 첫 번째 navigate 액션 4) 기본 URL
    let startUrl = metadata.startUrl || this.recordingStartUrl;
    if (!startUrl) {
      // 첫 번째 navigate 액션에서 URL 추출 시도
      const firstNavigate = this.recordedSteps.find(
        (step) => step.action === "navigate",
      );
      if (firstNavigate?.value) {
        startUrl = firstNavigate.value;
      } else {
        // 기본 시작 URL 사용 (설정에서 로드)
        startUrl = configLoader.getUrl("home");
      }
    }

    const playbook: Playbook = {
      metadata: {
        id: metadata.id || `playbook-${Date.now()}`,
        name: metadata.name || "새 플레이북",
        version: "1.0.0",
        description: metadata.description,
        category: metadata.category || "기타",
        difficulty: metadata.difficulty || "보통",
        keywords: metadata.keywords || [metadata.name || ""],
        createdAt: new Date().toISOString(),
        startUrl: startUrl || undefined, // 녹화 시작 URL 포함
      },
      steps: this.recordedSteps.map((step, index) => ({
        ...step,
        id: `step${index + 1}`,
      })),
    };

    console.log(
      "[RecordingService] Generated playbook with startUrl:",
      startUrl,
    );

    return { success: true, data: playbook };
  }

  /**
   * Cleanup recording state (does not close browser - browser is shared)
   * Note: Does not clear recordedSteps - they are needed for generatePlaybook()
   */
  async cleanup(): Promise<void> {
    // Only reset state - keep steps for generatePlaybook()
    // Browser is managed by BrowserService
    this.state = "idle";
    console.log(
      "[RecordingService] Recording state cleaned up (steps preserved)",
    );
  }

  /**
   * Full reset - clears all recording data
   */
  fullReset(): void {
    this.recordedActions = [];
    this.recordedSteps = [];
    this.stepCounter = 0;
    this.state = "idle";
    this.recordingStartUrl = null;
    console.log("[RecordingService] Full reset");
  }

  // Private methods

  private async handleRecordedAction(action: RecordedAction): Promise<void> {
    this.recordedActions.push(action);
    const step = await this.convertActionToStep(action);
    this.recordedSteps.push(step);

    console.log(
      `[RecordingService] Action recorded: ${action.type} -> ${step.action}`,
    );

    this.emit({ type: "action_recorded", action, step });
  }

  private async convertActionToStep(
    action: RecordedAction,
  ): Promise<SemanticStepV4> {
    this.stepCounter++;

    const step: SemanticStepV4 = {
      id: `step${this.stepCounter}`,
      action: action.type,
      timeout: 5000,
      onFailure: "heal", // 기본적으로 자가 치유 활성화
    };

    // ========================================
    // v3: CDP-First Semantic Recording
    // 1순위: Accessibility 정보 기반 ElementIdentity 생성
    // ========================================
    const identity = await this.captureElementIdentity(action);
    if (identity) {
      step.identity = identity;
      console.log(
        `[RecordingService] v3 Identity captured: role="${identity.axRole}", name="${identity.axName}"`,
      );

      // v3에서도 selector 필드 설정 (하위 호환)
      step.selector = this.generateSelectorFromIdentity(identity);
    }

    // ========================================
    // v2 호환: 시맨틱 선택자 생성 (기존 로직 유지)
    // ========================================
    const { result: semanticResult, snapshot: capturedSnapshot } =
      await this.generateSemanticSelectorWithSnapshot(action);
    if (semanticResult) {
      // v3 identity가 없으면 semanticResult에서 selector 사용
      if (!step.selector) {
        step.selector = semanticResult.selector;
      }

      // Fallback 선택자들 저장
      if (semanticResult.fallbacks.length > 0) {
        step.selectors = semanticResult.fallbacks.map((f, idx) => ({
          strategy: f.strategy,
          value: f.selector,
          priority: idx + 1,
        }));
      }

      // 스마트 셀렉터 호환성 유지 (AI 폴백 포함)
      step.smartSelector = await this.convertToSmartSelector(
        semanticResult,
        action,
        capturedSnapshot,
      );

      console.log(
        `[RecordingService] Semantic selector: ${semanticResult.selector} (${semanticResult.strategy}, unique: ${semanticResult.isUnique})`,
      );
    } else {
      // 폴백: 기존 방식
      if (!step.selector && action.selector) {
        step.selector = action.selector;
      }

      // 스마트 셀렉터 생성
      if (action.elementInfo) {
        step.smartSelector = await this.generateSmartSelector(action);
      }

      // 레거시 다중 선택자
      if (action.selectors && action.selectors.length > 0) {
        step.selectors = action.selectors;
      } else if (action.elementInfo) {
        // Use @botame/recorder's generateSelectors function
        step.selectors = generateSelectors({
          tagName: action.elementInfo.tagName,
          id: action.elementInfo.id,
          className: action.elementInfo.className,
          text: action.elementInfo.text,
          placeholder: action.elementInfo.placeholder,
          type: action.elementInfo.type,
          role: action.elementInfo.role,
          ariaLabel: action.elementInfo.ariaLabel,
          name: action.elementInfo.name,
          dataTestId: action.elementInfo.dataTestId,
        });
      }
    }

    if (action.value) {
      step.value = action.value;
    }

    step.message = this.generateStepMessage(action, identity);

    // ========================================
    // v4: Enhanced Self-Healing 정보 캡처
    // 녹화 시 한 번만 계산하여 저장, 실행 시 AI 없이 로컬에서 활용
    // ========================================
    const page = this.browserService?.getPage();
    if (page && capturedSnapshot) {
      try {
        // 병렬로 확장 정보 캡처 (성능 최적화)
        const [enhancedFallbacks, structuralPosition] = await Promise.all([
          this.captureEnhancedFallbacks(capturedSnapshot, page),
          this.captureStructuralPosition(capturedSnapshot, page),
        ]);

        step.enhancedFallbacks = enhancedFallbacks;
        step.structuralPosition = structuralPosition;
        step.textPatterns = this.generateTextPatterns(capturedSnapshot);

        const fallbackCount =
          enhancedFallbacks.textSelectors.length +
          enhancedFallbacks.parentChainSelectors.length +
          enhancedFallbacks.nearbyLabelSelectors.length;

        if (fallbackCount > 0) {
          console.log(
            `[RecordingService] v4 Enhanced fallbacks: ${fallbackCount} selectors captured`,
          );
        }
      } catch (error) {
        // v4 캡처 실패는 무시 (핵심 기능 아님)
        console.warn("[RecordingService] v4 enhanced capture failed:", error);
      }
    }

    return step;
  }

  /**
   * v3: CDP Accessibility 기반 ElementIdentity 캡처
   * 클릭 좌표에서 정확한 요소의 role + name 획득
   */
  private async captureElementIdentity(
    action: RecordedAction,
  ): Promise<ElementIdentity | null> {
    // 클릭 좌표가 없으면 캡처 불가
    if (
      action.clickX === undefined ||
      action.clickY === undefined ||
      action.clickX <= 0 ||
      action.clickY <= 0
    ) {
      return null;
    }

    try {
      // 1. Accessibility 정보 가져오기 (핵심!)
      const axInfo =
        await this.accessibilityService.getAccessibilityInfoAtPoint(
          action.clickX,
          action.clickY,
        );

      if (!axInfo) {
        console.log("[RecordingService] No accessibility info at point");
        return null;
      }

      // 2. DOM 속성도 가져오기 (보완 정보)
      const snapshot = await this.snapshotService.getElementAtPoint(
        action.clickX,
        action.clickY,
      );

      // 3. ElementIdentity 구성
      const identity: ElementIdentity = {
        // 1순위: Accessibility 기반
        axRole: axInfo.role !== "generic" ? axInfo.role : undefined,
        axName: axInfo.name || undefined,

        // 2순위: 시맨틱 속성
        ariaLabel: snapshot?.attributes["aria-label"],
        dataTestId:
          snapshot?.attributes["data-testid"] ||
          snapshot?.attributes["data-test-id"],
        name: snapshot?.attributes["name"],

        // 3순위: 구조적 속성
        tagName: snapshot?.tagName || "unknown",
        id: this.isStableId(snapshot?.attributes["id"])
          ? snapshot?.attributes["id"]
          : undefined,
        type: snapshot?.attributes["type"],
        placeholder: snapshot?.attributes["placeholder"],

        // 4순위: 시각적 특성
        boundingBox: axInfo.boundingBox,
        visualHash: this.generateVisualHash(axInfo.boundingBox, snapshot),

        // 메타데이터
        backendNodeId: axInfo.backendNodeId,
        textContent: snapshot?.textContent?.slice(0, 50),
        capturedAt: Date.now(),

        // 부모 정보
        parentRole: axInfo.parentRole,
        parentName: axInfo.parentName,
      };

      return identity;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      if (
        !msg.includes("context was destroyed") &&
        !msg.includes("navigation")
      ) {
        console.error("[RecordingService] Identity capture error:", error);
      }
      return null;
    }
  }

  /**
   * v3: ElementIdentity에서 최선의 선택자 생성
   */
  private generateSelectorFromIdentity(identity: ElementIdentity): string {
    // 1순위: role + name (Playwright getByRole 형식)
    if (identity.axRole && identity.axName) {
      // CSS 호환 형식으로 저장 (재생 시 getByRole로 변환)
      return `[role="${identity.axRole}"][aria-label="${this.escapeAttr(identity.axName)}"]`;
    }

    // 2순위: aria-label
    if (identity.ariaLabel) {
      return `${identity.tagName.toLowerCase()}[aria-label="${this.escapeAttr(identity.ariaLabel)}"]`;
    }

    // 3순위: name 속성 (form elements)
    if (identity.name && this.isFormElement(identity.tagName)) {
      return `${identity.tagName.toLowerCase()}[name="${this.escapeAttr(identity.name)}"]`;
    }

    // 4순위: data-testid
    if (identity.dataTestId) {
      return `[data-testid="${this.escapeAttr(identity.dataTestId)}"]`;
    }

    // 5순위: type (unique types)
    if (identity.tagName.toLowerCase() === "input" && identity.type) {
      const uniqueTypes = ["password", "email", "tel", "search", "file"];
      if (uniqueTypes.includes(identity.type)) {
        return `input[type="${identity.type}"]`;
      }
    }

    // 6순위: placeholder
    if (identity.placeholder) {
      return `${identity.tagName.toLowerCase()}[placeholder="${this.escapeAttr(identity.placeholder)}"]`;
    }

    // 7순위: stable ID
    if (identity.id) {
      return `#${identity.id}`;
    }

    // 폴백: 태그명
    return identity.tagName.toLowerCase();
  }

  /**
   * v3: 시각적 해시 생성 (레이아웃 변경 대응)
   */
  private generateVisualHash(
    box: BoundingBox,
    snapshot: ElementSnapshot | null,
  ): string {
    // 상대적 위치와 크기 기반 해시
    const hashParts = [
      Math.round(box.width),
      Math.round(box.height),
      // 화면 분할 위치 (9분할)
      Math.floor(box.x / 400), // 대략적인 x 위치
      Math.floor(box.y / 300), // 대략적인 y 위치
      snapshot?.tagName || "",
    ];
    return hashParts.join("|");
  }

  /**
   * 안정적인 ID인지 확인
   */
  private isStableId(id: string | undefined): boolean {
    if (!id) return false;

    const dynamicPatterns = [
      /^[a-f0-9]{8}-[a-f0-9]{4}/i, // UUID
      /^\d{10,}/, // 타임스탬프
      /_\d+$/, // 숫자 접미사
      /^react-/i, // React 생성 ID
      /^ember/i, // Ember 생성 ID
      /^ng-/i, // Angular 생성 ID
      /^:r[0-9a-z]+:/i, // React 18+ ID
    ];
    return !dynamicPatterns.some((p) => p.test(id));
  }

  /**
   * 폼 요소인지 확인
   */
  private isFormElement(tagName: string): boolean {
    return ["input", "select", "textarea", "button"].includes(
      tagName.toLowerCase(),
    );
  }

  /**
   * 속성값 이스케이프
   */
  private escapeAttr(value: string): string {
    return value.replace(/"/g, '\\"').replace(/'/g, "\\'");
  }

  /**
   * v3: 시맨틱 선택자 생성 (페이지에서 고유성 검증)
   * CDP를 통해 정확한 요소 정보를 가져옴
   * @returns 선택자 결과와 스냅샷을 함께 반환 (AI 셀렉터 생성용)
   */
  private async generateSemanticSelectorWithSnapshot(
    action: RecordedAction,
  ): Promise<{
    result: SemanticSelectorResult | null;
    snapshot: ElementSnapshot | null;
  }> {
    const page = this.browserService?.getPage();
    if (!page) return { result: null, snapshot: null };

    try {
      let snapshot: ElementSnapshot | null = null;

      // 클릭 좌표가 있으면 CDP로 정확한 요소 조회
      if (
        action.clickX !== undefined &&
        action.clickY !== undefined &&
        action.clickX > 0 &&
        action.clickY > 0
      ) {
        console.log(
          `[RecordingService] Using CDP to get element at (${action.clickX}, ${action.clickY})`,
        );
        snapshot = await this.snapshotService.getElementAtPoint(
          action.clickX,
          action.clickY,
        );

        if (snapshot) {
          console.log(
            `[RecordingService] CDP element: ${snapshot.tagName}, aria-label: ${snapshot.attributes["aria-label"]}, role: ${snapshot.attributes["role"]}`,
          );
        }
      }

      // CDP 실패 시 elementInfo에서 생성 (폴백)
      if (!snapshot && action.elementInfo) {
        snapshot = this.createSnapshotFromElementInfo(action);
      }

      if (!snapshot) return { result: null, snapshot: null };

      // 시맨틱 선택자 생성 (고유성 검증 포함)
      const result = await this.semanticSelectorGenerator.generateBestSelector(
        snapshot,
        page,
      );

      // 클라우드 캐시에 저장 (고유한 선택자만)
      if (result.isUnique && this.siteCacheService) {
        try {
          const url = new URL(page.url());
          const pageHash = await this.siteCacheService.generatePageHash(page);

          await this.siteCacheService.cacheSelector(
            url.hostname,
            url.pathname,
            pageHash,
            snapshot,
            result,
          );
        } catch (cacheError) {
          // 캐싱 실패는 무시 (핵심 기능 아님)
          console.error("[RecordingService] Cache error:", cacheError);
        }
      }

      return { result, snapshot };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "";
      // 페이지 이동 중 오류는 조용히 처리
      if (
        !errorMsg.includes("context was destroyed") &&
        !errorMsg.includes("navigation")
      ) {
        console.error("[RecordingService] Semantic selector error:", error);
      }
      return { result: null, snapshot: null };
    }
  }

  /**
   * SemanticSelectorResult를 SmartSelector로 변환 (하위 호환)
   * AI 폴백 셀렉터도 함께 생성 (API 키가 설정된 경우)
   */
  private async convertToSmartSelector(
    result: SemanticSelectorResult,
    action: RecordedAction,
    snapshot?: ElementSnapshot | null,
  ): Promise<SmartSelector> {
    const smartSelector: SmartSelector = {
      primary: {
        strategy: result.strategy,
        value: result.selector,
        confidence: result.confidence,
      },
      fallbacks: result.fallbacks.map((f) => ({
        strategy: f.strategy,
        value: f.selector,
        confidence: f.confidence,
      })),
      coordinates: { x: 0, y: 0, width: 0, height: 0 },
      elementHash: result.elementHash,
    };

    // AI 폴백 셀렉터 생성 (비동기, API 키 있을 때만)
    if (this.aiSelectorService.isEnabled() && snapshot) {
      try {
        const page = this.browserService?.getPage();
        if (page && result.selector) {
          const elementInfo =
            this.aiSelectorService.extractElementInfo(snapshot);
          const message = this.generateStepMessage(action, null);

          // AI 셀렉터 생성 (DOM 컨텍스트 포함)
          const aiSelectors =
            await this.aiSelectorService.generateSelectorsForAction(
              page,
              elementInfo,
              result.selector,
              message,
            );

          if (aiSelectors) {
            smartSelector.aiGenerated = aiSelectors;
            console.log(
              `[RecordingService] AI generated ${aiSelectors.selectors.length} fallback selectors (confidence: ${aiSelectors.confidence})`,
            );
          }
        }
      } catch (error) {
        // AI 셀렉터 생성 실패는 무시 (핵심 기능 아님)
        console.warn(
          "[RecordingService] AI selector generation failed:",
          error,
        );
      }
    }

    return smartSelector;
  }

  /**
   * 스마트 셀렉터 생성 (스냅샷 기반)
   * 네비게이션 중에는 elementInfo 기반으로 폴백
   */
  private async generateSmartSelector(
    action: RecordedAction,
  ): Promise<SmartSelector | undefined> {
    if (!action.elementInfo) return undefined;

    try {
      // 현재 페이지에서 요소의 스냅샷 캡처 시도
      const page = this.browserService?.getPage();
      if (!page) {
        // 페이지 없으면 elementInfo에서 생성
        const snapshot = this.createSnapshotFromElementInfo(action);
        return snapshot
          ? this.selectorGenerator.generateFromSnapshot(snapshot)
          : undefined;
      }

      let elementSnapshot: ElementSnapshot | null = null;

      // 기존 선택자로 요소 찾기 (네비게이션 오류 무시)
      if (action.selector) {
        try {
          const locator = page.locator(action.selector);
          const boundingBox = await locator.boundingBox({ timeout: 1000 });

          if (boundingBox) {
            // 좌표로 요소 스냅샷 가져오기
            elementSnapshot = await this.snapshotService.getElementAtPoint(
              boundingBox.x + boundingBox.width / 2,
              boundingBox.y + boundingBox.height / 2,
            );
          }
        } catch (e) {
          // 네비게이션/타임아웃 - elementInfo 폴백
          const errorMsg = e instanceof Error ? e.message : "";
          if (
            errorMsg.includes("context was destroyed") ||
            errorMsg.includes("navigation")
          ) {
            console.log(
              "[RecordingService] Page navigated, using elementInfo fallback",
            );
          }
        }
      }

      // 스냅샷이 없으면 elementInfo에서 생성
      if (!elementSnapshot) {
        elementSnapshot = this.createSnapshotFromElementInfo(action);
      }

      if (elementSnapshot) {
        return this.selectorGenerator.generateFromSnapshot(elementSnapshot);
      }
    } catch (error) {
      // 최종 폴백: elementInfo에서 스냅샷 생성
      const errorMsg = error instanceof Error ? error.message : "";
      if (!errorMsg.includes("context was destroyed")) {
        console.error(
          "[RecordingService] Failed to generate smart selector:",
          error,
        );
      }
      const snapshot = this.createSnapshotFromElementInfo(action);
      return snapshot
        ? this.selectorGenerator.generateFromSnapshot(snapshot)
        : undefined;
    }

    return undefined;
  }

  /**
   * elementInfo에서 가상 스냅샷 생성
   */
  private createSnapshotFromElementInfo(
    action: RecordedAction,
  ): ElementSnapshot | null {
    const info = action.elementInfo;
    if (!info) return null;

    return {
      nodeId: 0,
      backendNodeId: 0,
      tagName: info.tagName,
      attributes: {
        id: info.id || "",
        class: info.className || "",
        name: info.name || "",
        "aria-label": info.ariaLabel || "",
        "data-testid": info.dataTestId || "",
        placeholder: info.placeholder || "",
        role: info.role || "",
        type: info.type || "",
      },
      textContent: info.text,
      boundingBox: { x: 0, y: 0, width: 0, height: 0 },
      isVisible: true,
      isInViewport: true,
      xpath: "",
      cssPath: action.selector || "",
      role: info.role,
      name: info.ariaLabel || info.name,
    };
  }

  private generateStepMessage(
    action: RecordedAction,
    identity?: ElementIdentity | null,
  ): string {
    // v3: identity 우선 사용
    if (identity) {
      switch (action.type) {
        case "click":
          if (identity.axName) return `${identity.axName} 클릭`;
          if (identity.ariaLabel) return `${identity.ariaLabel} 클릭`;
          if (identity.textContent)
            return `${identity.textContent.slice(0, 30)} 클릭`;
          if (identity.placeholder) return `${identity.placeholder} 필드 클릭`;
          return `${identity.tagName || "요소"} 클릭`;

        case "type":
          if (identity.placeholder) return `${identity.placeholder} 입력`;
          if (identity.axName) return `${identity.axName} 입력`;
          if (identity.ariaLabel) return `${identity.ariaLabel} 입력`;
          return "텍스트 입력";

        case "select":
          return `${action.value || "옵션"} 선택`;

        case "navigate":
          return `${action.value?.slice(0, 50) || "URL"}로 이동`;

        default:
          return `${action.type} 액션`;
      }
    }

    // 폴백: 기존 elementInfo 사용
    const info = action.elementInfo;

    switch (action.type) {
      case "click":
        if (info?.ariaLabel) return `${info.ariaLabel} 클릭`;
        if (info?.text) return `${info.text.slice(0, 30)} 클릭`;
        if (info?.placeholder) return `${info.placeholder} 필드 클릭`;
        return `${info?.tagName || "요소"} 클릭`;

      case "type":
        if (info?.placeholder) return `${info.placeholder} 입력`;
        if (info?.ariaLabel) return `${info.ariaLabel} 입력`;
        return "텍스트 입력";

      case "select":
        return `${action.value || "옵션"} 선택`;

      case "navigate":
        return `${action.value?.slice(0, 50) || "URL"}로 이동`;

      default:
        return `${action.type} 액션`;
    }
  }

  private addGuideStep(message: string): void {
    this.stepCounter++;
    const step: PlaybookStep = {
      id: `step${this.stepCounter}`,
      action: "guide",
      message,
    };
    this.recordedSteps.push(step);
    this.emit({ type: "action_recorded", step });
  }

  private async injectRecordingScript(page: Page): Promise<void> {
    const script = `
      (function() {
        if (window.__botameRecordingActive) return;
        window.__botameRecordingActive = true;

        let inputDebounceTimers = {};

        // 동적 ID 패턴 감지
        function isDynamicId(id) {
          const dynamicPatterns = [
            /^[a-f0-9]{8}-[a-f0-9]{4}/i,  // UUID
            /^\\d{10,}/,                    // 타임스탬프
            /_\\d+$/,                       // 숫자 접미사
            /^react-/i,                    // React 생성 ID
            /^ember/i,                     // Ember 생성 ID
            /^ng-/i,                       // Angular 생성 ID
            /^:r[0-9a-z]+:/i,             // React 18+ ID
          ];
          return dynamicPatterns.some(p => p.test(id));
        }

        function generateSelector(el) {
          const tagName = el.tagName.toLowerCase();

          // 0. 시맨틱 속성 최우선 체크 (모든 요소)
          const ariaLabel = el.getAttribute('aria-label');
          const role = el.getAttribute('role');
          const dataTestId = el.getAttribute('data-testid') || el.getAttribute('data-test-id');

          // aria-label이 있으면 최우선 사용
          if (ariaLabel) {
            if (role) {
              // role과 aria-label 조합 (가장 정확)
              return '[role="' + role + '"][aria-label="' + CSS.escape(ariaLabel) + '"]';
            }
            return tagName + '[aria-label="' + CSS.escape(ariaLabel) + '"]';
          }

          // data-testid가 있으면 사용
          if (dataTestId) {
            return '[data-testid="' + CSS.escape(dataTestId) + '"]';
          }

          // 1. INPUT, TEXTAREA, SELECT - 정확한 속성 기반 선택자
          if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
            const type = el.getAttribute('type');
            const name = el.getAttribute('name');
            const placeholder = el.getAttribute('placeholder');
            const ariaLabel = el.getAttribute('aria-label');

            // name 속성이 있으면 가장 정확
            if (name) {
              return tagName + '[name="' + CSS.escape(name) + '"]';
            }

            // aria-label이 있으면 매우 유용 (로그인 ID, 비밀번호 등)
            if (ariaLabel) {
              return tagName + '[aria-label="' + CSS.escape(ariaLabel) + '"]';
            }

            // type 속성이 있으면 (password, email 등 고유한 것들)
            if (type && ['password', 'email', 'tel', 'search', 'url', 'number', 'date', 'file'].includes(type)) {
              // form 내부면 더 구체적으로
              const form = el.closest('form');
              if (form) {
                const formSelector = form.id ? '#' + CSS.escape(form.id) : 'form';
                return formSelector + ' ' + tagName + '[type="' + type + '"]';
              }
              return tagName + '[type="' + type + '"]';
            }

            // placeholder가 있으면
            if (placeholder) {
              return tagName + '[placeholder="' + CSS.escape(placeholder) + '"]';
            }

            // ID가 안정적이면 사용
            if (el.id && !isDynamicId(el.id)) {
              return '#' + CSS.escape(el.id);
            }

            // 최후: form 내 순서로
            const form = el.closest('form');
            if (form) {
              const inputs = form.querySelectorAll(tagName);
              const index = Array.from(inputs).indexOf(el);
              if (index >= 0) {
                const formSelector = form.id ? '#' + CSS.escape(form.id) : 'form';
                return formSelector + ' ' + tagName + ':nth-of-type(' + (index + 1) + ')';
              }
            }
          }

          // 2. BUTTON - submit 타입, 클래스 기반
          if (el.tagName === 'BUTTON') {
            const type = el.getAttribute('type');
            const form = el.closest('form');

            // submit 버튼
            if (type === 'submit') {
              if (form && form.id) {
                return '#' + CSS.escape(form.id) + ' button[type="submit"]';
              }
              return 'button[type="submit"]';
            }

            // 로그인/제출 관련 클래스
            if (el.className) {
              const loginClasses = el.className.split(' ').filter(c =>
                /login|submit|btn-primary|btn-main|signin/i.test(c)
              );
              if (loginClasses.length) {
                return 'button.' + CSS.escape(loginClasses[0]);
              }
            }
          }

          // 3. A 태그 - href 기반
          if (el.tagName === 'A') {
            const href = el.getAttribute('href');
            if (href && href !== '#' && !href.startsWith('javascript:')) {
              // 상대 경로면 그대로, 절대 경로면 pathname만
              const path = href.startsWith('http') ? new URL(href).pathname : href;
              if (path && path !== '/') {
                return 'a[href*="' + CSS.escape(path.slice(0, 30)) + '"]';
              }
            }
          }

          // 4. 안정적인 ID
          if (el.id && !isDynamicId(el.id)) {
            return '#' + CSS.escape(el.id);
          }

          // 5. data-testid
          const testId = el.getAttribute('data-testid') || el.getAttribute('data-test-id');
          if (testId) {
            return '[data-testid="' + CSS.escape(testId) + '"]';
          }

          // 6. role + name 조합
          if (el.getAttribute('role') && el.getAttribute('name')) {
            return '[role="' + el.getAttribute('role') + '"][name="' + el.getAttribute('name') + '"]';
          }

          // 7. 최후: CSS 경로 (짧게)
          const path = [];
          let current = el;
          let depth = 0;
          while (current && current !== document.body && depth < 3) {
            let selector = current.tagName.toLowerCase();
            if (current.id && !isDynamicId(current.id)) {
              path.unshift('#' + CSS.escape(current.id));
              break;
            }
            if (current.className) {
              const stableClasses = current.className.split(' ')
                .filter(c => c.trim() && !/^(css-|sc-|_[a-z0-9]{5,}|emotion-)/i.test(c))
                .slice(0, 2);
              if (stableClasses.length) selector += '.' + stableClasses.map(c => CSS.escape(c)).join('.');
            }
            path.unshift(selector);
            current = current.parentElement;
            depth++;
          }
          return path.join(' > ');
        }

        function getElementInfo(el) {
          return {
            tagName: el.tagName,
            id: el.id || undefined,
            className: el.className || undefined,
            text: el.textContent?.trim().slice(0, 50) || undefined,
            placeholder: el.placeholder || undefined,
            type: el.type || undefined,
            role: el.getAttribute('role') || undefined,
            ariaLabel: el.getAttribute('aria-label') || undefined,
            name: el.getAttribute('name') || undefined,
            dataTestId: el.getAttribute('data-testid') || el.getAttribute('data-test-id') || undefined,
          };
        }

        // 부모 체인에서 시맨틱 속성을 가진 요소 찾기
        function findSemanticParent(el, maxDepth = 5) {
          let current = el;
          let depth = 0;

          while (current && current !== document.body && depth < maxDepth) {
            // aria-label, role, data-testid 등 시맨틱 속성이 있으면 반환
            const ariaLabel = current.getAttribute('aria-label');
            const role = current.getAttribute('role');
            const testId = current.getAttribute('data-testid');

            // 클릭 가능한 시맨틱 요소인지 확인
            const isClickableRole = role && ['button', 'tab', 'link', 'menuitem', 'option'].includes(role);
            const hasAriaLabel = ariaLabel && ariaLabel.length > 0;
            const hasTestId = testId && testId.length > 0;

            if (isClickableRole || hasAriaLabel || hasTestId) {
              console.log('[Botame Recording] Found semantic parent:', current.tagName, 'aria-label:', ariaLabel, 'role:', role);
              return current;
            }

            // A, BUTTON 태그면 바로 사용
            if (current.tagName === 'A' || current.tagName === 'BUTTON') {
              return current;
            }

            current = current.parentElement;
            depth++;
          }

          // 시맨틱 부모를 못 찾으면 원래 요소 반환
          return el;
        }

        // Click handler
        document.addEventListener('click', (e) => {
          let el = e.target;
          if (!el || el.tagName === 'HTML' || el.tagName === 'BODY') return;

          // INPUT, TEXTAREA, SELECT는 그대로 사용
          if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) {
            // 다른 요소는 시맨틱 부모 찾기
            el = findSemanticParent(el);
          }

          const action = {
            type: 'click',
            selector: generateSelector(el),
            timestamp: Date.now(),
            elementInfo: getElementInfo(el),
            // 클릭 좌표 캡처 (CDP로 정확한 요소 조회용)
            clickX: e.clientX,
            clickY: e.clientY,
          };

          console.log('[Botame Recording] Click at (' + e.clientX + ',' + e.clientY + '):', action.selector);
          window.__botameRecordAction?.(action);
        }, true);

        // Input handler with debounce
        // 한/영 변환키 입력 필터링을 위한 상태
        let lastInputValue = {};
        let lastInputTime = {};

        document.addEventListener('input', (e) => {
          const el = e.target;
          if (!el || !['INPUT', 'TEXTAREA'].includes(el.tagName)) return;

          const key = generateSelector(el);
          const currentValue = el.value;
          const currentTime = Date.now();

          // 한/영 변환키 필터링:
          // - 이전 값과 동일하면 무시 (한/영 키만 눌렀을 때)
          // - 빈 문자열이면 무시 (한/영 키로 인한 초기화)
          if (lastInputValue[key] === currentValue) {
            console.log('[Botame Recording] Skipping duplicate input (possible IME key)');
            return;
          }

          // 매우 짧은 시간 내 동일 길이 입력은 무시 (한/영 변환)
          if (lastInputTime[key] && currentTime - lastInputTime[key] < 50 &&
              lastInputValue[key]?.length === currentValue.length) {
            console.log('[Botame Recording] Skipping quick same-length input (possible IME switch)');
            return;
          }

          lastInputValue[key] = currentValue;
          lastInputTime[key] = currentTime;

          clearTimeout(inputDebounceTimers[key]);

          inputDebounceTimers[key] = setTimeout(() => {
            // 최종 값이 마지막 저장된 값과 같은지 확인
            if (el.value !== lastInputValue[key]) {
              lastInputValue[key] = el.value;
            }

            const action = {
              type: 'type',
              selector: key,
              value: el.value,
              timestamp: Date.now(),
              elementInfo: getElementInfo(el),
            };

            console.log('[Botame Recording] Type:', key, el.value);
            window.__botameRecordAction?.(action);
          }, 500);
        }, true);

        // Select handler
        document.addEventListener('change', (e) => {
          const el = e.target;
          if (!el || el.tagName !== 'SELECT') return;

          const action = {
            type: 'select',
            selector: generateSelector(el),
            value: el.value,
            timestamp: Date.now(),
            elementInfo: getElementInfo(el),
          };

          console.log('[Botame Recording] Select:', action.value);
          window.__botameRecordAction?.(action);
        }, true);

        console.log('[Botame Recording] Activated');
      })();
    `;

    // Inject on all pages
    await page.addInitScript(script);

    // Also inject on current page
    await page.evaluate(script);
  }

  // ============================================
  // v4: Enhanced Self-Healing 정보 수집
  // ============================================

  /**
   * 확장된 폴백 정보 캡처 (v4)
   * 참고: 한글/영문 변환 맵은 이제 configLoader.getSelectorConfig().translationMap에서 로드
   */
  private async captureEnhancedFallbacks(
    snapshot: ElementSnapshot,
    page: Page,
  ): Promise<EnhancedFallbacks> {
    const [textSelectors, parentChainSelectors, nearbyLabelSelectors] =
      await Promise.all([
        this.generateTextSelectors(snapshot, page),
        this.generateParentChainSelectors(snapshot, page),
        this.generateNearbyLabelSelectors(snapshot, page),
      ]);

    return {
      textSelectors,
      parentChainSelectors,
      nearbyLabelSelectors,
    };
  }

  /**
   * 텍스트 기반 셀렉터 생성
   */
  private async generateTextSelectors(
    snapshot: ElementSnapshot,
    page: Page,
  ): Promise<TextBasedSelector[]> {
    const selectors: TextBasedSelector[] = [];
    const text = snapshot.textContent?.trim();

    // 텍스트가 없거나 너무 짧거나 길면 건너뜀
    if (!text || text.length < 2 || text.length > 100) return selectors;

    const tagName = snapshot.tagName.toLowerCase();

    // INPUT 요소는 텍스트 셀렉터 사용 안함
    if (["input", "textarea", "select"].includes(tagName)) return selectors;

    try {
      // 1. 정확한 텍스트 매칭
      const exactSelector = `${tagName}:text("${this.escapeTextForSelector(text)}")`;
      if (await this.isUniqueSelector(page, exactSelector)) {
        selectors.push({
          type: "exact",
          value: text,
          selector: exactSelector,
          confidence: 85,
        });
      }

      // 2. has-text 매칭
      const hasTextSelector = `${tagName}:has-text("${this.escapeTextForSelector(text)}")`;
      if (await this.isUniqueSelector(page, hasTextSelector)) {
        selectors.push({
          type: "contains",
          value: text,
          selector: hasTextSelector,
          confidence: 80,
        });
      }

      // 3. 정규식 패턴 (공백 유연하게)
      const regexPattern = this.textToFlexibleRegex(text);
      selectors.push({
        type: "regex",
        value: text,
        pattern: regexPattern,
        selector: `${tagName}:text-matches("${regexPattern}", "i")`,
        confidence: 70,
      });
    } catch (error) {
      // 페이지 이동 등으로 인한 에러 무시
    }

    return selectors;
  }

  /**
   * 부모 체인 기반 셀렉터 생성
   */
  private async generateParentChainSelectors(
    snapshot: ElementSnapshot,
    page: Page,
  ): Promise<ParentChainSelector[]> {
    const selectors: ParentChainSelector[] = [];

    try {
      // 부모 체인 정보 가져오기
      const parentChain = await page.evaluate((cssPath: string) => {
        const el = document.querySelector(cssPath);
        if (!el) return [];

        const chain: Array<{
          tagName: string;
          id?: string;
          role?: string;
          ariaLabel?: string;
          isLandmark: boolean;
          isForm: boolean;
        }> = [];

        let current = el.parentElement;
        let depth = 0;

        while (current && current !== document.body && depth < 5) {
          depth++;
          chain.push({
            tagName: current.tagName.toLowerCase(),
            id: current.id || undefined,
            role: current.getAttribute("role") || undefined,
            ariaLabel: current.getAttribute("aria-label") || undefined,
            isLandmark: [
              "HEADER",
              "NAV",
              "MAIN",
              "ASIDE",
              "FOOTER",
              "SECTION",
              "ARTICLE",
            ].includes(current.tagName),
            isForm: current.tagName === "FORM",
          });
          current = current.parentElement;
        }

        return chain;
      }, snapshot.cssPath);

      // 부모 셀렉터 조합 생성
      const childSelector = this.generateRelativeChildSelector(snapshot);

      for (let i = 0; i < parentChain.length; i++) {
        const parent = parentChain[i];
        let parentSelector = "";

        // 유용한 부모 셀렉터 생성
        // Local helper: check if ID is dynamic
        const isDynamicId = (id: string) => {
          const dynamicPatterns = [
            /^[a-f0-9]{8}-[a-f0-9]{4}/i, // UUID
            /^\d{10,}/, // 타임스탬프
            /_\d+$/, // 숫자 접미사
            /^react-/i, // React 생성 ID
            /^ember/i, // Ember 생성 ID
            /^ng-/i, // Angular 생성 ID
            /^:r[0-9a-z]+:/i, // React 18+ ID
          ];
          return dynamicPatterns.some((p) => p.test(id));
        };

        if (parent.id && !isDynamicId(parent.id)) {
          parentSelector = `#${parent.id}`;
        } else if (parent.role) {
          parentSelector = `[role="${parent.role}"]`;
        } else if (parent.isForm) {
          parentSelector = "form";
        } else if (parent.isLandmark) {
          parentSelector = parent.tagName;
        } else {
          continue; // 유용한 부모가 아니면 스킵
        }

        const fullSelector = `${parentSelector} >> ${childSelector}`;

        if (await this.isUniqueSelector(page, fullSelector)) {
          selectors.push({
            parentSelector,
            childSelector,
            fullSelector,
            depth: i + 1,
            confidence: 90 - i * 5, // 깊이가 깊을수록 낮은 신뢰도
          });
        }
      }
    } catch (error) {
      // 페이지 이동 등으로 인한 에러 무시
    }

    return selectors;
  }

  /**
   * 근처 라벨 기반 셀렉터 생성
   */
  private async generateNearbyLabelSelectors(
    snapshot: ElementSnapshot,
    page: Page,
  ): Promise<NearbyLabelSelector[]> {
    const selectors: NearbyLabelSelector[] = [];
    const tagName = snapshot.tagName.toLowerCase();

    // INPUT/TEXTAREA/SELECT 요소만 라벨 기반 셀렉터 생성
    if (!["input", "textarea", "select"].includes(tagName)) {
      return selectors;
    }

    try {
      const nearbyLabels = await page.evaluate((cssPath: string) => {
        const el = document.querySelector(cssPath);
        if (!el) return [];

        const labels: Array<{
          text: string;
          relationship:
          | "for"
          | "sibling"
          | "preceding"
          | "following"
          | "parent";
        }> = [];

        // 1. for 속성으로 연결된 label
        if (el.id) {
          const label = document.querySelector(`label[for="${el.id}"]`);
          if (label && label.textContent) {
            labels.push({
              text: label.textContent.trim(),
              relationship: "for",
            });
          }
        }

        // 2. 이전 형제 중 label 또는 span
        let prev = el.previousElementSibling;
        while (prev) {
          if (
            prev.tagName === "LABEL" ||
            (prev.tagName === "SPAN" &&
              prev.textContent &&
              prev.textContent.trim().length < 30)
          ) {
            labels.push({
              text: prev.textContent?.trim() || "",
              relationship: "preceding",
            });
            break;
          }
          prev = prev.previousElementSibling;
        }

        // 3. 부모 label
        const parentLabel = el.closest("label");
        if (parentLabel && parentLabel !== el) {
          const labelText = parentLabel.textContent
            ?.trim()
            .replace(el.textContent || "", "")
            .trim();
          if (labelText) {
            labels.push({
              text: labelText,
              relationship: "parent",
            });
          }
        }

        return labels;
      }, snapshot.cssPath);

      for (const label of nearbyLabels) {
        if (!label.text || label.text.length < 2) continue;

        const escapedText = this.escapeTextForSelector(label.text);
        let targetSelector = "";

        if (label.relationship === "for") {
          // label[for] + input 또는 label[for] ~ input
          targetSelector = `label:has-text("${escapedText}") + ${tagName}, label:has-text("${escapedText}") ~ ${tagName}`;
        } else if (label.relationship === "preceding") {
          // 이전 형제 텍스트 + 현재 요소
          targetSelector = `:text("${escapedText}") + ${tagName}`;
        } else if (label.relationship === "parent") {
          // 부모 라벨 내부의 요소
          targetSelector = `label:has-text("${escapedText}") >> ${tagName}`;
        }

        if (
          targetSelector &&
          (await this.isUniqueSelector(page, targetSelector))
        ) {
          selectors.push({
            labelText: label.text,
            relationship: label.relationship,
            targetSelector,
            confidence: 85,
          });
        }
      }
    } catch (error) {
      // 페이지 이동 등으로 인한 에러 무시
    }

    return selectors;
  }

  /**
   * 구조적 위치 정보 캡처
   */
  private async captureStructuralPosition(
    snapshot: ElementSnapshot,
    page: Page,
  ): Promise<StructuralPosition | undefined> {
    try {
      const positionInfo = await page.evaluate((cssPath: string) => {
        const el = document.querySelector(cssPath);
        if (!el) return null;

        // 부모 체인
        const parentChain: ParentInfo[] = [];
        let current = el.parentElement;
        let depth = 0;

        while (current && current !== document.body && depth < 5) {
          const tagName = current.tagName.toLowerCase();
          const id =
            current.id &&
              !/^[a-f0-9]{8}-|^\d{10,}|_\d+$|^react-|^ember|^ng-|^:r[0-9a-z]+:/i.test(
                current.id,
              )
              ? current.id
              : undefined;

          // 안정적인 클래스만 추출
          const stableClasses = current.className
            ? current.className
              .split(" ")
              .filter(
                (c: string) =>
                  c.trim() && !/^(css-|sc-|_[a-z0-9]{5,}|emotion-)/i.test(c),
              )
              .slice(0, 2)
              .join(" ")
            : undefined;

          // 셀렉터 생성
          let selector = tagName;
          if (id) {
            selector = `#${id}`;
          } else if (current.getAttribute("role")) {
            selector = `[role="${current.getAttribute("role")}"]`;
          } else if (stableClasses) {
            selector = `${tagName}.${stableClasses.split(" ").join(".")}`;
          }

          parentChain.push({
            tagName,
            id,
            role: current.getAttribute("role") || undefined,
            ariaLabel: current.getAttribute("aria-label") || undefined,
            className: stableClasses,
            selector,
            isLandmark: ["header", "nav", "main", "aside", "footer"].includes(
              tagName,
            ),
            isForm: tagName === "form",
          });

          current = current.parentElement;
          depth++;
        }

        // 형제 정보
        const parent = el.parentElement;
        const siblings = parent ? Array.from(parent.children) : [];
        const position = siblings.indexOf(el);

        const prevSibling = el.previousElementSibling;
        const nextSibling = el.nextElementSibling;

        // nthChild, nthOfType 계산
        const nthChild = position + 1;
        const sameTagSiblings = siblings.filter(
          (s) => s.tagName === el.tagName,
        );
        const nthOfType = sameTagSiblings.indexOf(el) + 1;

        // 폼 요소 인덱스
        let formElementIndex: number | undefined;
        const form = el.closest("form");
        if (form && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) {
          const formElements = form.querySelectorAll("input, textarea, select");
          formElementIndex = Array.from(formElements).indexOf(el) + 1;
        }

        return {
          parentChain,
          siblingInfo: {
            prevSiblingText: prevSibling?.textContent?.trim().slice(0, 50),
            nextSiblingText: nextSibling?.textContent?.trim().slice(0, 50),
            prevSiblingTag: prevSibling?.tagName.toLowerCase(),
            nextSiblingTag: nextSibling?.tagName.toLowerCase(),
            totalSiblings: siblings.length,
            position,
          },
          nthChild,
          nthOfType,
          formElementIndex,
        };
      }, snapshot.cssPath);

      return positionInfo || undefined;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * 텍스트 패턴 생성
   */
  private generateTextPatterns(
    snapshot: ElementSnapshot,
  ): TextPatterns | undefined {
    const text = snapshot.textContent?.trim();
    if (!text || text.length < 2 || text.length > 100) return undefined;

    // INPUT 요소는 텍스트 패턴 사용 안함
    if (["INPUT", "TEXTAREA", "SELECT"].includes(snapshot.tagName))
      return undefined;

    // 정규화
    const normalized = text.replace(/\s+/g, " ").trim();

    // 변형 생성
    const variations = this.generateTextVariations(text);

    // 정규식 패턴
    const regexPattern = this.textToFlexibleRegex(text);

    // 키워드 추출
    const keywords = this.extractKeywordsFromText(text);

    return {
      original: text,
      normalized,
      variations,
      regexPattern,
      keywords,
    };
  }

  /**
   * 텍스트 변형 생성 (한글/영문 변환)
   */
  private generateTextVariations(text: string): TextVariation[] {
    const variations: TextVariation[] = [];

    // 원본 한글
    variations.push({
      type: "korean",
      value: text,
      pattern: this.escapeRegex(text),
    });

    // 영문 변형 찾기 (프로필 설정에서 번역 맵 로드)
    const translationMap =
      configLoader.getSelectorConfig().translationMap || {};
    for (const [korean, englishList] of Object.entries(translationMap)) {
      if (text.includes(korean)) {
        for (const english of englishList) {
          variations.push({
            type: "english",
            value: english,
            pattern: english.replace(/\s+/g, ".?"),
          });
        }
      }
    }

    // 공백 유연성 (공백 있으면 공백 없는 버전도 추가)
    if (text.includes(" ")) {
      variations.push({
        type: "mixed",
        value: text.replace(/\s+/g, ""),
        pattern: text.replace(/\s+/g, ".?"),
      });
    }

    return variations;
  }

  /**
   * 키워드 추출 (stopword 제외)
   */
  private extractKeywordsFromText(text: string): string[] {
    const stopWords = [
      "을",
      "를",
      "이",
      "가",
      "은",
      "는",
      "의",
      "에",
      "에서",
      "으로",
      "로",
      "와",
      "과",
      "하다",
      "하기",
      "클릭",
      "입력",
      "선택",
    ];

    return text
      .split(/\s+/)
      .filter((word) => word.length >= 2 && !stopWords.includes(word))
      .slice(0, 5); // 최대 5개
  }

  /**
   * 텍스트를 유연한 정규식으로 변환
   */
  private textToFlexibleRegex(text: string): string {
    // 공백을 .?로 변환하고, 특수문자 이스케이프
    return text
      .split("")
      .map((char) => {
        if (/\s/.test(char)) return ".?";
        if (/[.*+?^${}()|[\]\\]/.test(char)) return "\\" + char;
        return char;
      })
      .join("");
  }

  /**
   * 정규식 특수문자 이스케이프
   */
  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * 셀렉터용 텍스트 이스케이프
   */
  private escapeTextForSelector(text: string): string {
    return text.replace(/"/g, '\\"').replace(/'/g, "\\'");
  }

  /**
   * 상대 자식 셀렉터 생성
   */
  private generateRelativeChildSelector(snapshot: ElementSnapshot): string {
    const tagName = snapshot.tagName.toLowerCase();
    const attrs = snapshot.attributes;

    // 우선순위: name > aria-label > type > placeholder > tagName
    if (attrs["name"]) {
      return `${tagName}[name="${attrs["name"]}"]`;
    }
    if (attrs["aria-label"]) {
      return `${tagName}[aria-label="${this.escapeTextForSelector(attrs["aria-label"])}"]`;
    }
    if (
      attrs["type"] &&
      ["password", "email", "tel", "search", "file"].includes(attrs["type"])
    ) {
      return `${tagName}[type="${attrs["type"]}"]`;
    }
    if (attrs["placeholder"]) {
      return `${tagName}[placeholder="${this.escapeTextForSelector(attrs["placeholder"])}"]`;
    }
    return tagName;
  }

  /**
   * 셀렉터가 고유한지 확인
   */
  private async isUniqueSelector(
    page: Page,
    selector: string,
  ): Promise<boolean> {
    try {
      const count = await page.locator(selector).count();
      return count === 1;
    } catch {
      return false;
    }
  }
}
