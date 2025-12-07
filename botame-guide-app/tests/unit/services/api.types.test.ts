import {
  ChatRequest,
  ChatResponse,
  ChatContext,
  UserIntent,
  SuggestedAction,
  PlaybookRecommendation,
  RecommendationRequest,
  RecommendationResponse,
  APIConfig,
  APIError,
  APIResult,
} from '@electron/services/api.types';

describe('API Types', () => {
  describe('ChatRequest', () => {
    test('should have required message field', () => {
      const request: ChatRequest = {
        message: '예산 등록 방법을 알려주세요',
      };

      expect(request.message).toBe('예산 등록 방법을 알려주세요');
    });

    test('should have optional context', () => {
      const context: ChatContext = {
        activePlaybookId: 'budget-001',
        currentStep: 2,
        variables: { amount: 1000000 },
        history: [
          { role: 'user', content: '예산 등록 시작' },
          { role: 'assistant', content: '예산 등록을 시작합니다' },
        ],
      };

      const request: ChatRequest = {
        message: '다음',
        context,
        sessionId: 'session-123',
      };

      expect(request.context).toBeDefined();
      expect(request.context?.activePlaybookId).toBe('budget-001');
      expect(request.sessionId).toBe('session-123');
    });
  });

  describe('ChatResponse', () => {
    test('should have required message field', () => {
      const response: ChatResponse = {
        message: '예산 등록을 도와드리겠습니다',
      };

      expect(response.message).toBe('예산 등록을 도와드리겠습니다');
    });

    test('should have optional intent', () => {
      const response: ChatResponse = {
        message: '이해했습니다',
        intent: 'start_playbook',
      };

      expect(response.intent).toBe('start_playbook');
    });

    test('should have optional suggestions', () => {
      const response: ChatResponse = {
        message: '다음 플레이북을 추천합니다',
        suggestions: [
          {
            playbookId: 'budget-001',
            title: '예산 등록',
            description: '예산을 등록합니다',
            category: '교부관리',
            confidence: 0.95,
          },
        ],
      };

      expect(response.suggestions).toHaveLength(1);
      expect(response.suggestions![0].confidence).toBe(0.95);
    });

    test('should have optional action', () => {
      const response: ChatResponse = {
        message: '플레이북을 시작합니다',
        action: {
          type: 'start_playbook',
          playbookId: 'budget-001',
        },
      };

      expect(response.action?.type).toBe('start_playbook');
    });
  });

  describe('UserIntent', () => {
    test('should support all intent types', () => {
      const intents: UserIntent[] = [
        'ask_help',
        'start_playbook',
        'continue_playbook',
        'cancel_playbook',
        'clarify',
        'confirm',
        'reject',
        'unknown',
      ];

      expect(intents).toHaveLength(8);
    });
  });

  describe('SuggestedAction', () => {
    test('should support start_playbook action', () => {
      const action: SuggestedAction = {
        type: 'start_playbook',
        playbookId: 'budget-001',
      };

      expect(action.type).toBe('start_playbook');
      expect(action.playbookId).toBe('budget-001');
    });

    test('should support input_required action', () => {
      const action: SuggestedAction = {
        type: 'input_required',
        requiredInput: ['예산명', '예산액'],
      };

      expect(action.type).toBe('input_required');
      expect(action.requiredInput).toEqual(['예산명', '예산액']);
    });
  });

  describe('PlaybookRecommendation', () => {
    test('should have required fields', () => {
      const recommendation: PlaybookRecommendation = {
        playbookId: 'budget-001',
        title: '예산 등록 가이드',
        description: '신규 예산을 등록하는 방법',
        category: '교부관리',
        confidence: 0.85,
      };

      expect(recommendation.playbookId).toBe('budget-001');
      expect(recommendation.confidence).toBe(0.85);
    });

    test('should have optional matchReason', () => {
      const recommendation: PlaybookRecommendation = {
        playbookId: 'budget-001',
        title: '예산 등록',
        description: '설명',
        category: '교부관리',
        confidence: 0.9,
        matchReason: '키워드 "예산", "등록" 매칭',
      };

      expect(recommendation.matchReason).toBe('키워드 "예산", "등록" 매칭');
    });
  });

  describe('RecommendationRequest', () => {
    test('should have required query', () => {
      const request: RecommendationRequest = {
        query: '예산 등록',
      };

      expect(request.query).toBe('예산 등록');
    });

    test('should have optional filters', () => {
      const request: RecommendationRequest = {
        query: '예산 등록',
        category: '교부관리',
        limit: 5,
      };

      expect(request.category).toBe('교부관리');
      expect(request.limit).toBe(5);
    });
  });

  describe('RecommendationResponse', () => {
    test('should have recommendations array', () => {
      const response: RecommendationResponse = {
        recommendations: [],
        query: '예산 등록',
        totalMatches: 0,
      };

      expect(response.recommendations).toEqual([]);
      expect(response.query).toBe('예산 등록');
    });
  });

  describe('APIConfig', () => {
    test('should have required fields', () => {
      const config: APIConfig = {
        baseUrl: 'https://api.anthropic.com',
        apiKey: 'sk-test-key',
      };

      expect(config.baseUrl).toBe('https://api.anthropic.com');
      expect(config.apiKey).toBe('sk-test-key');
    });

    test('should have optional fields', () => {
      const config: APIConfig = {
        baseUrl: 'https://api.anthropic.com',
        apiKey: 'sk-test-key',
        model: 'claude-3-haiku-20240307',
        maxTokens: 1024,
        timeout: 30000,
      };

      expect(config.model).toBe('claude-3-haiku-20240307');
      expect(config.maxTokens).toBe(1024);
      expect(config.timeout).toBe(30000);
    });
  });

  describe('APIResult', () => {
    test('should represent success result', () => {
      const result: APIResult<ChatResponse> = {
        success: true,
        data: { message: '응답입니다' },
      };

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.message).toBe('응답입니다');
      }
    });

    test('should represent error result', () => {
      const error: APIError = {
        code: 'RATE_LIMIT',
        message: '요청 한도 초과',
        details: { retryAfter: 60 },
      };

      const result: APIResult<ChatResponse> = {
        success: false,
        error,
      };

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('RATE_LIMIT');
        expect(result.error.details?.retryAfter).toBe(60);
      }
    });
  });
});
