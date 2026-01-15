/**
 * Claude Service
 * Handles communication with Claude API using Claude Agent SDK with MCP
 */

import {
  ChatRequest,
  ChatResponse,
  ChatContext,
  APIConfig,
  APIResult,
  UserIntent,
  PlaybookRecommendation,
  SuggestedAction,
} from "./api.types";
import { query } from "@anthropic-ai/claude-agent-sdk";
import {
  createGuideMcpServer,
  GuideMcpServerInstance,
} from "../mcp/guide-mcp.server";
import { Playbook } from "@botame/types";

export class ClaudeService {
  private mcpServer: GuideMcpServerInstance | null = null;
  private playbooks: Playbook[] = [];

  constructor(_config: APIConfig) {
    // SDK gets API key from ANTHROPIC_API_KEY environment variable
    // Config is accepted for compatibility but not used directly
    // Future: could set environment variable from config if needed
  }

  /**
   * Set playbooks for MCP server
   */
  setPlaybooks(playbooks: Playbook[]): void {
    this.playbooks = playbooks;
  }

  /**
   * Initialize MCP server with playbooks
   */
  private initializeMcpServer() {
    if (this.mcpServer) {
      return;
    }

    // Import RecommendationService dynamically to avoid circular dependency
    const { RecommendationService } = require("./recommendation.service");
    const recommendationService = new RecommendationService(this.playbooks);

    this.mcpServer = createGuideMcpServer({
      recommendationService,
      playbooks: this.playbooks,
    });
  }

  /**
   * Send a chat request to Claude API using SDK with MCP
   */
  async chat(request: ChatRequest): Promise<APIResult<ChatResponse>> {
    try {
      this.initializeMcpServer();

      if (!this.mcpServer) {
        throw new Error("MCP server initialization failed");
      }

      // Build prompt with history and current message
      let prompt = "";

      // Add history if present
      if (request.context?.history) {
        for (const msg of request.context.history) {
          if (msg.role === "user") {
            prompt += `User: ${msg.content}\n`;
          } else {
            prompt += `Assistant: ${msg.content}\n`;
          }
        }
      }

      // Add current message
      prompt += `User: ${request.message}\n`;

      // Add assistant prompt to trigger response
      prompt += "Assistant:";

      // Call Claude with MCP server
      const response = query({
        prompt,
        options: {
          mcpServers: {
            guide: this.mcpServer,
          },
          systemPrompt: this.buildSystemPrompt(request.context),
        },
      });

      // Collect all messages from the async generator
      let messageText = "";
      for await (const msg of response) {
        if (msg.type === "assistant") {
          const content = msg.message.content;
          if (Array.isArray(content)) {
            const textBlock = content.find(
              (block: any) => block.type === "text",
            );
            if (textBlock) {
              messageText += textBlock.text;
            }
          }
        }
      }

      const intent = this.parseIntent(request.message);
      const suggestions = this.extractRecommendations(messageText);
      const action = this.extractAction(messageText);

      return {
        success: true,
        data: {
          message: this.cleanResponseText(messageText),
          intent,
          suggestions: suggestions.length > 0 ? suggestions : undefined,
          action: action || undefined,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "SDK_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  /**
   * Build system prompt with optional context
   */
  buildSystemPrompt(context?: ChatContext): string {
    let prompt = `당신은 보탬e 시스템의 AI 가이드 어시스턴트입니다.
사용자가 보탬e 시스템을 효과적으로 사용할 수 있도록 도움을 제공합니다.

## 역할
- 사용자의 질문에 친절하고 정확하게 답변합니다
- 적절한 플레이북(자동화 가이드)을 추천합니다
- 단계별 가이드를 제공합니다

## 사용 가능한 도구
- read_playbook: 플레이북의 상세 내용을 확인합니다
- list_playbooks: 사용 가능한 모든 플레이북을 나열합니다
- recommend_playbook: 사용자의 질문에 맞는 플레이북을 추천합니다
- get_browser_state: 브라우저 상태를 확인합니다

## 응답 방식
1. 사용자의 질문을 이해하기 위해 먼저 도구를 사용합니다
2. recommend_playbook 도구를 사용하여 관련 플레이북을 찾습니다
3. 필요한 경우 read_playbook 도구로 플레이북의 상세 내용을 확인합니다
4. 한국어로 친절하고 상세하게 답변합니다
`;

    if (context?.activePlaybookId) {
      prompt += `\n## 현재 컨텍스트
- 활성 플레이북: ${context.activePlaybookId}
- 현재 단계: ${context.currentStep || 0}
`;
    }

    if (context?.variables && Object.keys(context.variables).length > 0) {
      prompt += `\n## 변수
${JSON.stringify(context.variables, null, 2)}
`;
    }

    return prompt;
  }

  /**
   * Parse user intent from message
   */
  parseIntent(message: string): UserIntent {
    const lowerMessage = message.toLowerCase();

    // Ask for help patterns
    if (
      lowerMessage.includes("알려") ||
      lowerMessage.includes("어떻게") ||
      lowerMessage.includes("방법") ||
      lowerMessage.includes("도움")
    ) {
      return "ask_help";
    }

    // Start playbook patterns
    if (
      lowerMessage.includes("시작") ||
      lowerMessage.includes("실행") ||
      lowerMessage.includes("진행")
    ) {
      return "start_playbook";
    }

    // Confirm patterns
    if (
      lowerMessage.includes("네") ||
      lowerMessage.includes("예") ||
      lowerMessage.includes("맞") ||
      lowerMessage.includes("확인") ||
      lowerMessage.includes("좋")
    ) {
      return "confirm";
    }

    // Reject patterns
    if (
      lowerMessage.includes("아니") ||
      lowerMessage.includes("취소") ||
      lowerMessage.includes("중지") ||
      lowerMessage.includes("멈")
    ) {
      return "reject";
    }

    // Cancel playbook patterns
    if (lowerMessage.includes("취소") || lowerMessage.includes("그만")) {
      return "cancel_playbook";
    }

    // Continue playbook patterns
    if (lowerMessage.includes("다음") || lowerMessage.includes("계속")) {
      return "continue_playbook";
    }

    return "unknown";
  }

  /**
   * Extract playbook recommendations from response text
   */
  extractRecommendations(responseText: string): PlaybookRecommendation[] {
    const recommendations: PlaybookRecommendation[] = [];
    const regex = /\[PLAYBOOK:([^:]+):([^:]+):([^:]+):([^\]]+)\]/g;
    let match;

    while ((match = regex.exec(responseText)) !== null) {
      recommendations.push({
        playbookId: match[1],
        title: match[2],
        description: match[3],
        category: "기타",
        confidence: parseFloat(match[4]),
      });
    }

    return recommendations;
  }

  /**
   * Extract suggested action from response text
   */
  extractAction(responseText: string): SuggestedAction | null {
    const regex = /\[ACTION:([^:]+):([^\]]+)\]/;
    const match = responseText.match(regex);

    if (!match) {
      return null;
    }

    const actionType = match[1] as SuggestedAction["type"];
    const params = match[2];

    switch (actionType) {
      case "start_playbook":
        return {
          type: "start_playbook",
          playbookId: params,
        };
      case "input_required":
        return {
          type: "input_required",
          requiredInput: params.split(","),
        };
      case "continue":
        return {
          type: "continue",
          stepIndex: parseInt(params, 10),
        };
      default:
        return {
          type: actionType,
        };
    }
  }

  /**
   * Clean response text by removing markup
   */
  private cleanResponseText(text: string): string {
    return text
      .replace(/\[PLAYBOOK:[^\]]+\]/g, "")
      .replace(/\[ACTION:[^\]]+\]/g, "")
      .trim();
  }
}
