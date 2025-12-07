import { ClaudeService } from '@electron/services/claude.service';
import {
  ChatRequest,
  ChatResponse,
  APIConfig,
  APIResult,
} from '@electron/services/api.types';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('ClaudeService', () => {
  const mockConfig: APIConfig = {
    baseUrl: 'https://api.anthropic.com',
    apiKey: 'sk-test-key',
    model: 'claude-3-haiku-20240307',
    maxTokens: 1024,
    timeout: 30000,
  };

  let service: ClaudeService;

  beforeEach(() => {
    mockFetch.mockClear();
    service = new ClaudeService(mockConfig);
  });

  describe('initialization', () => {
    test('should create instance with config', () => {
      expect(service).toBeInstanceOf(ClaudeService);
    });

    test('should use default model if not specified', () => {
      const serviceWithDefaults = new ClaudeService({
        baseUrl: 'https://api.anthropic.com',
        apiKey: 'sk-test',
      });
      expect(serviceWithDefaults).toBeInstanceOf(ClaudeService);
    });
  });

  describe('chat', () => {
    test('should send chat request and return response', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: '예산 등록을 도와드리겠습니다.' }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: ChatRequest = {
        message: '예산 등록 방법을 알려주세요',
      };

      const result = await service.chat(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.message).toBe('예산 등록을 도와드리겠습니다.');
      }
    });

    test('should include context in request', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: '계속 진행합니다.' }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: ChatRequest = {
        message: '다음',
        context: {
          activePlaybookId: 'budget-001',
          currentStep: 2,
          history: [
            { role: 'user', content: '예산 등록' },
            { role: 'assistant', content: '시작합니다' },
          ],
        },
      };

      await service.chat(request);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);

      // Should include history in messages
      expect(body.messages.length).toBeGreaterThan(1);
    });

    test('should handle API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: { message: 'Invalid API key' } }),
      });

      const result = await service.chat({ message: 'test' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('AUTH_ERROR');
      }
    });

    test('should handle network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.chat({ message: 'test' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NETWORK_ERROR');
      }
    });

    test('should handle rate limit error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({
          error: { message: 'Rate limit exceeded' },
        }),
      });

      const result = await service.chat({ message: 'test' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('RATE_LIMIT');
      }
    });
  });

  describe('parseIntent', () => {
    test('should parse ask_help intent', () => {
      const intent = service.parseIntent('예산 등록 방법을 알려주세요');
      expect(intent).toBe('ask_help');
    });

    test('should parse start_playbook intent', () => {
      const intent = service.parseIntent('예산 등록 시작');
      expect(intent).toBe('start_playbook');
    });

    test('should parse confirm intent', () => {
      const intent = service.parseIntent('네, 맞습니다');
      expect(intent).toBe('confirm');
    });

    test('should parse reject intent', () => {
      const intent = service.parseIntent('아니요, 취소합니다');
      expect(intent).toBe('reject');
    });

    test('should return unknown for ambiguous messages', () => {
      const intent = service.parseIntent('음...');
      expect(intent).toBe('unknown');
    });
  });

  describe('buildSystemPrompt', () => {
    test('should build base system prompt', () => {
      const prompt = service.buildSystemPrompt();
      expect(prompt).toContain('보탬e');
      expect(prompt).toContain('가이드');
    });

    test('should include playbook context when provided', () => {
      const prompt = service.buildSystemPrompt({
        activePlaybookId: 'budget-001',
        currentStep: 2,
      });
      expect(prompt).toContain('budget-001');
    });
  });

  describe('extractRecommendations', () => {
    test('should extract playbook recommendations from response', () => {
      const responseText = `
        예산 등록과 관련된 플레이북을 추천합니다:
        [PLAYBOOK:budget-001:예산 등록:신규 예산 등록 가이드:0.95]
        [PLAYBOOK:budget-002:예산 수정:기존 예산 수정 가이드:0.75]
      `;

      const recommendations = service.extractRecommendations(responseText);

      expect(recommendations).toHaveLength(2);
      expect(recommendations[0].playbookId).toBe('budget-001');
      expect(recommendations[0].confidence).toBe(0.95);
    });

    test('should return empty array when no recommendations', () => {
      const responseText = '일반적인 질문에 대한 답변입니다.';
      const recommendations = service.extractRecommendations(responseText);
      expect(recommendations).toEqual([]);
    });
  });

  describe('extractAction', () => {
    test('should extract start_playbook action', () => {
      const responseText = '[ACTION:start_playbook:budget-001]';
      const action = service.extractAction(responseText);

      expect(action).not.toBeNull();
      expect(action?.type).toBe('start_playbook');
      expect(action?.playbookId).toBe('budget-001');
    });

    test('should extract input_required action', () => {
      const responseText = '[ACTION:input_required:예산명,예산액]';
      const action = service.extractAction(responseText);

      expect(action).not.toBeNull();
      expect(action?.type).toBe('input_required');
      expect(action?.requiredInput).toEqual(['예산명', '예산액']);
    });

    test('should return null when no action', () => {
      const responseText = '일반적인 답변입니다.';
      const action = service.extractAction(responseText);
      expect(action).toBeNull();
    });
  });
});
