/**
 * AI 셀렉터 생성 서비스
 *
 * 녹화 시 DOM 컨텍스트를 분석하여 안정적인 폴백 셀렉터를 생성합니다.
 * Claude Agent SDK와 MCP를 사용하여 MCP 서버의 heal_selector 도구를 호출합니다.
 *
 * TODO: 향후 개선 사항
 * - MCP 서버에서 생성된 셀렉터의 신뢰도 점수를 AIGeneratedSelectors 형식에 맞게 변환
 * - AI 모델 파라미터(model, max_tokens 등)를 설정에서 주입 가능하도록 개선
 * - 병렬 처리를 위한 배치 셀렉터 생성 API 추가
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import {
  SelectorWithScore,
  SelectorStrategy,
  AIGeneratedSelectors,
  ElementSnapshot,
  PlaybookIssue,
  ElementInfo,
} from "../../shared/types";
import { configLoader } from "../../shared/config";
import { createBotameMcpServer } from "../mcp/botame-mcp.server";
import { PlaybookRunnerService } from "./playbook-runner.service";
import { BrowserService } from "./browser.service";

// AI 모델 설정 (기본값)
const DEFAULT_MODEL = "claude-3-5-haiku-20241022";
const MAX_TOKENS = 4000;

export class AISelectorService {
  private enabled: boolean = false;
  private mcpServer: ReturnType<typeof createBotameMcpServer> | null = null;
  private model: string;

  constructor(
    private playbookRunner?: PlaybookRunnerService,
    private browserService?: BrowserService,
  ) {
    this.model = process.env.AI_MODEL || DEFAULT_MODEL;
    this.initializeMCP();
  }

  /**
   * MCP 서버 초기화
   */
  private initializeMCP(): void {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn(
        "[AISelectorService] No API key found, AI selector generation disabled",
      );
      this.enabled = false;
      return;
    }

    if (!this.playbookRunner || !this.browserService) {
      console.warn(
        "[AISelectorService] PlaybookRunner or BrowserService not provided, MCP initialization deferred",
      );
      this.enabled = false;
      return;
    }

    try {
      this.mcpServer = createBotameMcpServer({
        playbookRunner: this.playbookRunner,
        browserService: this.browserService,
      });
      this.enabled = true;
      console.log("[AISelectorService] Initialized with MCP server");
    } catch (error) {
      console.error(
        "[AISelectorService] Failed to initialize MCP server:",
        error,
      );
      this.enabled = false;
    }
  }

  /**
   * AI 기능 활성화 여부
   */
  isEnabled(): boolean {
    return this.enabled && this.mcpServer !== null;
  }

  /**
   * MCP 서버 설정 (나중에 주입 가능)
   */
  setServices(
    playbookRunner: PlaybookRunnerService,
    browserService: BrowserService,
  ): void {
    this.playbookRunner = playbookRunner;
    this.browserService = browserService;
    this.initializeMCP();
  }

  /**
   * [Remote Repair] 이슈 상황을 분석하여 복구 셀렉터 제안
   * 오프라인 스냅샷(PlaybookIssue)만으로 동작
   */
  async repairIssue(
    issue: PlaybookIssue,
  ): Promise<AIGeneratedSelectors | null> {
    if (!this.isEnabled()) return null;

    console.log(
      `[AISelectorService] Repairing issue: ${issue.title} (${issue.id})`,
    );

    // DOM 컨텍스트가 너무 길면 자름 (토큰 비용 절약)
    const truncatedDom =
      issue.domSnapshot.length > 5000
        ? issue.domSnapshot.slice(0, 5000) + "... (truncated)"
        : issue.domSnapshot;

    return this.generateSelectors(
      issue.elementInfo,
      truncatedDom,
      `Error: ${issue.title}. Description: ${issue.description}`,
    );
  }

  /**
   * 요소에 대한 AI 폴백 셀렉터 생성
   *
   * Claude Agent SDK와 MCP 서버의 heal_selector 도구를 사용하여
   * 안정적인 폴백 셀렉터를 생성합니다.
   */
  async generateSelectors(
    element: ElementInfo,
    domContext: string,
    message?: string,
  ): Promise<AIGeneratedSelectors | null> {
    if (!this.isEnabled()) {
      console.log(
        "[AISelectorService] AI disabled, skipping selector generation",
      );
      return null;
    }

    if (!this.mcpServer) {
      console.error("[AISelectorService] MCP server not initialized");
      return null;
    }

    try {
      // MCP 서버의 heal_selector 도구를 사용하여 셀렉터 생성
      const prompt = this.buildPrompt(element, domContext, message);

      // TODO: SDK의 query 함수 시그니처에 맞춰서 수정 필요
      // 현재는 SDK가 완전히 설치되지 않았으므로 any 타입으로 처리
      const response: any = await (query as any)({
        prompt,
        mcpServers: [this.mcpServer],
        model: this.model,
        maxTokens: MAX_TOKENS,
      });

      // 응답에서 툴 사용 결과를 파싱
      const toolResults = this.extractToolResults(response);

      if (!toolResults || toolResults.length === 0) {
        console.warn("[AISelectorService] No tool results from MCP server");
        return null;
      }

      // 툴 결과를 AIGeneratedSelectors 형식으로 변환
      const selectors = this.parseMCPResponse(toolResults);

      if (!selectors) {
        console.warn("[AISelectorService] Failed to parse MCP response");
        return null;
      }

      return {
        selectors: selectors.selectors,
        generatedAt: new Date().toISOString(),
        model: this.model,
        confidence: selectors.confidence,
        reasoning: selectors.reasoning,
        domContext: domContext.slice(0, 500), // 디버깅용으로 일부만 저장
      };
    } catch (error) {
      console.error("[AISelectorService] Error generating selectors:", error);
      return null;
    }
  }

  /**
   * AI 프롬프트 생성
   */
  private buildPrompt(
    element: ElementInfo,
    domContext: string,
    message?: string,
  ): string {
    return `당신은 웹 자동화 전문가입니다. 아래 요소에 대해 안정적인 CSS 셀렉터를 생성하세요.

## 요소 정보
- tagName: ${element.tagName}
- id: ${element.id || "없음"}
- className: ${element.className || "없음"}
- text: ${element.text || "없음"}
- aria-label: ${element.ariaLabel || "없음"}
- placeholder: ${element.placeholder || "없음"}
- name: ${element.name || "없음"}
- type: ${element.type || "없음"}
- role: ${element.role || "없음"}
- data-testid: ${element.dataTestId || "없음"}
${message ? `- 사용자 액션/에러: ${message}` : ""}

## DOM 컨텍스트 (주변 HTML)
\`\`\`html
${domContext.slice(0, 2000)}
\`\`\`

## 요구사항
MCP 서버의 heal_selector 도구를 사용하여 안정적인 폴백 셀렉터를 생성하세요.

## 셀렉터 우선순위 원칙 (안정성 순)
1. data-testid 속성 - 테스트용으로 가장 안정적
2. aria-label 속성 - 접근성 속성은 잘 변경되지 않음
3. name 속성 - 폼 요소에서 안정적
4. placeholder 속성 - 입력 필드에서 유용
5. role + 텍스트 조합 - 시맨틱 요소 식별
6. 텍스트 기반 (text=, :has-text) - 한국어 지원
7. 고유 ID - 동적 ID(숫자 포함)는 피할 것
8. 구조적 경로 - 부모 > 자식 조합

## 주의사항
- 동적으로 생성되는 ID(숫자 포함)는 사용하지 마세요
- 클래스명이 해시값처럼 보이면 사용하지 마세요
- 한국어 텍스트는 text= 셀렉터로 활용하세요
${configLoader.getAiPrompt()?.siteContext ? `- ${configLoader.getAiPrompt()?.siteContext}` : ""}

heal_selector 도구를 호출하여 셀렉터를 생성해주세요.`;
  }

  /**
   * SDK 응답에서 툴 결과 추출
   */
  private extractToolResults(response: any): string[] {
    // TODO: SDK 응답 구조에 맞게 구현 필요
    // 현재는 SDK에서 툴 사용 결과를 어떤 형식으로 반환하는지 확인 필요
    if (response?.toolResults) {
      return response.toolResults;
    }

    // 텍스트 응답에서 결과 추출 (fallback)
    if (response?.text) {
      return [response.text];
    }

    return [];
  }

  /**
   * MCP 서버 응답을 AIGeneratedSelectors로 파싱
   */
  private parseMCPResponse(toolResults: string[]): {
    selectors: SelectorWithScore[];
    confidence: number;
    reasoning: string;
  } | null {
    try {
      // 툴 결과에서 셀렉터 목록 추출
      const selectors: SelectorWithScore[] = [];
      let overallConfidence = 75;
      let reasoning = "Generated by MCP heal_selector tool";

      for (const result of toolResults) {
        // MCP 서버의 응답 형식: "1. [strategy] selector (confidence: X%)"
        const lines = result.split("\n");

        for (const line of lines) {
          const match = line.match(
            /\d+\.\s+\[([^\]]+)\]\s+([^\(]+)\s+\(confidence:\s*(\d+)\%/,
          );
          if (match) {
            const [, strategy, selector, confidence] = match;
            selectors.push({
              strategy: this.mapStrategy(strategy),
              value: selector.trim(),
              confidence: parseInt(confidence, 10),
            });
          }
        }
      }

      if (selectors.length === 0) {
        console.warn("[AISelectorService] No selectors found in MCP response");
        return null;
      }

      // 첫 번째 셀렉터를 primary로 사용
      overallConfidence = selectors[0].confidence;

      return {
        selectors,
        confidence: overallConfidence,
        reasoning,
      };
    } catch (error) {
      console.error("[AISelectorService] Failed to parse MCP response:", error);
      return null;
    }
  }

  /**
   * 전략 문자열을 SelectorStrategy로 매핑
   */
  private mapStrategy(strategy: string): SelectorStrategy {
    const strategyMap: Record<string, SelectorStrategy> = {
      css: "css",
      xpath: "xpath",
      text: "text",
      role: "role",
      testId: "testId",
      "data-testid": "testId",
      placeholder: "placeholder",
      label: "label",
      accessibility: "label",
      structural: "css",
      "aria-label": "label",
      name: "css", // name은 CSS 셀렉터로 처리
    };

    return strategyMap[strategy] || "css";
  }

  /**
   * ElementSnapshot에서 ElementInfo 추출
   */
  extractElementInfo(snapshot: ElementSnapshot): ElementInfo {
    return {
      tagName: snapshot.tagName,
      id: snapshot.attributes["id"],
      className: snapshot.attributes["class"],
      text: snapshot.textContent,
      ariaLabel: snapshot.attributes["aria-label"],
      placeholder: snapshot.attributes["placeholder"],
      name: snapshot.attributes["name"],
      type: snapshot.attributes["type"],
      role: snapshot.role || snapshot.attributes["role"],
      dataTestId: snapshot.attributes["data-testid"],
    };
  }

  /**
   * DOM 컨텍스트 추출 (요소 주변 HTML)
   */
  async extractDOMContext(page: any, selector: string): Promise<string> {
    try {
      const context = await page.evaluate((sel: string) => {
        const element = document.querySelector(sel);
        if (!element) return "";

        // 부모 2단계까지 포함
        let parent =
          element.parentElement?.parentElement ||
          element.parentElement ||
          element;

        // outerHTML 추출 (최대 3000자)
        const html = parent.outerHTML;
        if (html.length > 3000) {
          // 요소 주변만 추출
          const elementHtml = element.outerHTML;
          const idx = html.indexOf(elementHtml);
          if (idx !== -1) {
            const start = Math.max(0, idx - 500);
            const end = Math.min(html.length, idx + elementHtml.length + 500);
            return "..." + html.slice(start, end) + "...";
          }
        }
        return html;
      }, selector);

      return context || "";
    } catch (error) {
      console.error(
        "[AISelectorService] Failed to extract DOM context:",
        error,
      );
      return "";
    }
  }

  /**
   * 녹화된 액션에 대해 AI 셀렉터 생성 (배치)
   */
  async generateSelectorsForAction(
    page: any,
    elementInfo: ElementInfo,
    selector: string,
    message?: string,
  ): Promise<AIGeneratedSelectors | null> {
    const domContext = await this.extractDOMContext(page, selector);
    if (!domContext) {
      console.warn("[AISelectorService] No DOM context available");
      return null;
    }

    return this.generateSelectors(elementInfo, domContext, message);
  }
}

// 싱글톤 인스턴스
let instance: AISelectorService | null = null;

/**
 * AISelectorService 싱글톤 인스턴스를 가져옵니다.
 *
 * @param playbookRunner - (선택사항) PlaybookRunnerService 인스턴스
 * @param browserService - (선택사항) BrowserService 인스턴스
 * @returns AISelectorService 인스턴스
 *
 * @example
 * // 기본 사용 (나중에 setServices로 주입)
 * const service = getAISelectorService();
 * service.setServices(playbookRunner, browserService);
 *
 * @example
 * // 초기화 시 주입
 * const service = getAISelectorService(playbookRunner, browserService);
 */
export function getAISelectorService(
  playbookRunner?: PlaybookRunnerService,
  browserService?: BrowserService,
): AISelectorService {
  if (!instance) {
    instance = new AISelectorService(playbookRunner, browserService);
  } else if (playbookRunner && browserService) {
    // 이미 생성된 인스턴스에 서비스 주입
    instance.setServices(playbookRunner, browserService);
  }
  return instance;
}
