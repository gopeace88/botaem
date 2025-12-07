/**
 * Claude Service
 * Handles communication with Claude API for AI chat
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
} from './api.types';

const DEFAULT_MODEL = 'claude-3-haiku-20240307';
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TIMEOUT = 30000;

export class ClaudeService {
  private config: Required<APIConfig>;

  constructor(config: APIConfig) {
    this.config = {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model || DEFAULT_MODEL,
      maxTokens: config.maxTokens || DEFAULT_MAX_TOKENS,
      timeout: config.timeout || DEFAULT_TIMEOUT,
    };
  }

  /**
   * Send a chat request to Claude API
   */
  async chat(request: ChatRequest): Promise<APIResult<ChatResponse>> {
    try {
      const messages = this.buildMessages(request);
      const systemPrompt = this.buildSystemPrompt(request.context);

      const response = await fetch(`${this.config.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          system: systemPrompt,
          messages,
        }),
      });

      if (!response.ok) {
        return this.handleErrorResponse(response);
      }

      const data = await response.json();
      const messageText = this.extractMessageText(data);
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
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Build messages array from request
   */
  private buildMessages(request: ChatRequest): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];

    // Add history if present
    if (request.context?.history) {
      messages.push(...request.context.history);
    }

    // Add current message
    messages.push({ role: 'user', content: request.message });

    return messages;
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

## 사용 가능한 플레이북 목록 (정확히 이 ID를 사용해야 합니다)
- auto-login: 자동 로그인 - 아이디/비밀번호로 자동 로그인합니다 (키워드: 로그인, 자동로그인, 자동 로그인)
- budget-register: 예산 등록 - 신규 예산을 등록합니다
- expense-register: 지출 결의 - 지출 결의서를 작성합니다
- member-info: 회원정보 조회 - 로그인한 사용자의 회원정보를 조회합니다
- org-info: 단체정보관리 - 단체정보관리 화면으로 이동합니다 (키워드: 단체정보, 단체정보관리)
- simple-test: 간단한 테스트 - 사용자 입력을 받아 검증하는 간단한 테스트입니다

## 응답 형식
- 플레이북 추천시: [PLAYBOOK:아이디:제목:설명:신뢰도] (아이디는 반드시 위의 목록에서 선택)
- 액션 제안시: [ACTION:타입:파라미터]
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
      lowerMessage.includes('알려') ||
      lowerMessage.includes('어떻게') ||
      lowerMessage.includes('방법') ||
      lowerMessage.includes('도움')
    ) {
      return 'ask_help';
    }

    // Start playbook patterns
    if (
      lowerMessage.includes('시작') ||
      lowerMessage.includes('실행') ||
      lowerMessage.includes('진행')
    ) {
      return 'start_playbook';
    }

    // Confirm patterns
    if (
      lowerMessage.includes('네') ||
      lowerMessage.includes('예') ||
      lowerMessage.includes('맞') ||
      lowerMessage.includes('확인') ||
      lowerMessage.includes('좋')
    ) {
      return 'confirm';
    }

    // Reject patterns
    if (
      lowerMessage.includes('아니') ||
      lowerMessage.includes('취소') ||
      lowerMessage.includes('중지') ||
      lowerMessage.includes('멈')
    ) {
      return 'reject';
    }

    // Cancel playbook patterns
    if (lowerMessage.includes('취소') || lowerMessage.includes('그만')) {
      return 'cancel_playbook';
    }

    // Continue playbook patterns
    if (
      lowerMessage.includes('다음') ||
      lowerMessage.includes('계속')
    ) {
      return 'continue_playbook';
    }

    return 'unknown';
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
        category: '기타',
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

    const actionType = match[1] as SuggestedAction['type'];
    const params = match[2];

    switch (actionType) {
      case 'start_playbook':
        return {
          type: 'start_playbook',
          playbookId: params,
        };
      case 'input_required':
        return {
          type: 'input_required',
          requiredInput: params.split(','),
        };
      case 'continue':
        return {
          type: 'continue',
          stepIndex: parseInt(params, 10),
        };
      default:
        return {
          type: actionType,
        };
    }
  }

  /**
   * Extract message text from API response
   */
  private extractMessageText(data: { content: Array<{ type: string; text?: string }> }): string {
    const textContent = data.content.find((c) => c.type === 'text');
    return textContent?.text || '';
  }

  /**
   * Clean response text by removing markup
   */
  private cleanResponseText(text: string): string {
    return text
      .replace(/\[PLAYBOOK:[^\]]+\]/g, '')
      .replace(/\[ACTION:[^\]]+\]/g, '')
      .trim();
  }

  /**
   * Handle error response from API
   */
  private async handleErrorResponse(response: Response): Promise<APIResult<ChatResponse>> {
    let errorMessage = response.statusText;

    try {
      const errorData = await response.json();
      errorMessage = errorData.error?.message || errorMessage;
    } catch {
      // Use status text if JSON parsing fails
    }

    let errorCode: string;

    switch (response.status) {
      case 401:
        errorCode = 'AUTH_ERROR';
        break;
      case 429:
        errorCode = 'RATE_LIMIT';
        break;
      case 500:
      case 502:
      case 503:
        errorCode = 'SERVER_ERROR';
        break;
      default:
        errorCode = 'API_ERROR';
    }

    return {
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
        details: { status: response.status },
      },
    };
  }
}
