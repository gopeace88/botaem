/**
 * Chat IPC Handler
 * Handles chat-related IPC communication
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { ClaudeService } from '../services/claude.service';
import { RecommendationService } from '../services/recommendation.service';
import { ChatRequest, ChatResponse, APIConfig } from '../services/api.types';
import { Playbook } from '../playbook/types';

export class ChatHandler {
  private claudeService: ClaudeService | null = null;
  private recommendationService: RecommendationService;

  constructor(playbooks: Playbook[] = []) {
    this.recommendationService = new RecommendationService(playbooks);
  }

  /**
   * Initialize Claude service with API configuration
   */
  initializeClaudeService(config: APIConfig): void {
    this.claudeService = new ClaudeService(config);
  }

  /**
   * Update playbooks for recommendation
   */
  updatePlaybooks(playbooks: Playbook[]): void {
    this.recommendationService.updatePlaybooks(playbooks);
  }

  /**
   * Register IPC handlers
   */
  register(): void {
    ipcMain.handle('chat:send', this.handleChatSend.bind(this));
  }

  /**
   * Unregister IPC handlers
   */
  unregister(): void {
    ipcMain.removeHandler('chat:send');
  }

  /**
   * Handle chat:send IPC call
   */
  private async handleChatSend(
    _event: IpcMainInvokeEvent,
    request: ChatRequest
  ): Promise<ChatResponse> {
    // If Claude service is available, use AI response
    if (this.claudeService) {
      const result = await this.claudeService.chat(request);

      if (result.success) {
        return result.data;
      }

      // Fallback to offline response on error
      return this.generateOfflineResponse(request);
    }

    // Offline mode - use local recommendation
    return this.generateOfflineResponse(request);
  }

  /**
   * Generate offline response using local recommendation
   */
  private generateOfflineResponse(request: ChatRequest): ChatResponse {
    const { message } = request;
    const lowerMessage = message.toLowerCase();

    // Get recommendations
    const recommendResult = this.recommendationService.recommend({
      query: message,
      limit: 3,
    });

    if (recommendResult.recommendations.length > 0) {
      return {
        message: '다음 플레이북을 추천합니다:',
        intent: 'ask_help',
        suggestions: recommendResult.recommendations,
      };
    }

    // Keyword-based responses for common queries
    if (lowerMessage.includes('예산') || lowerMessage.includes('budget')) {
      return {
        message: '예산 관련 업무를 도와드리겠습니다. 예산 등록, 예산 조회, 예산 변경 중 어떤 작업을 원하시나요?',
        intent: 'ask_help',
      };
    }

    if (lowerMessage.includes('지출') || lowerMessage.includes('결의')) {
      return {
        message: '지출 결의 업무를 도와드리겠습니다. 지출 결의서 작성을 시작하시겠습니까?',
        intent: 'ask_help',
      };
    }

    if (lowerMessage.includes('정산') || lowerMessage.includes('보고')) {
      return {
        message: '정산 및 보고 업무를 도와드리겠습니다. 어떤 유형의 정산이 필요하신가요?',
        intent: 'ask_help',
      };
    }

    if (lowerMessage.includes('회원') || lowerMessage.includes('가입자') || lowerMessage.includes('사용자') || lowerMessage.includes('내정보') || lowerMessage.includes('정보조회')) {
      return {
        message: '회원정보 조회를 도와드리겠습니다. "회원정보 조회" 플레이북을 실행하시겠습니까?',
        intent: 'ask_help',
        suggestions: [{
          playbookId: 'member-info',
          title: '회원정보 조회',
          description: '로그인한 사용자의 회원정보를 조회합니다',
          category: '사용자지원',
          confidence: 0.9
        }]
      };
    }

    if (lowerMessage.includes('테스트') || lowerMessage.includes('간단한')) {
      return {
        message: '간단한 테스트를 시작하시겠습니까?',
        intent: 'ask_help',
        suggestions: [{
          playbookId: 'simple-test',
          title: '간단한 테스트',
          description: '사용자 입력을 받아 검증하는 간단한 테스트입니다',
          category: '테스트',
          confidence: 0.9
        }]
      };
    }

    if (lowerMessage.includes('도움') || lowerMessage.includes('help') || lowerMessage.includes('안녕')) {
      return {
        message: '안녕하세요! 보탬e 가이드입니다. 예산 등록, 지출 결의, 정산 보고 등의 업무를 도와드립니다. 어떤 업무를 도와드릴까요?',
        intent: 'greeting',
      };
    }

    // Default response
    return {
      message: `"${message}"에 대해 이해했습니다. 보탬e에서 해당 업무를 찾고 있습니다. 더 구체적인 업무명이나 키워드를 입력해 주시면 더 정확한 안내가 가능합니다.`,
      intent: 'unknown',
    };
  }
}
