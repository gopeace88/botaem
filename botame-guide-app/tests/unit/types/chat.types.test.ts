import {
  ChatMessage,
  ChatMessageType,
  ChatSender,
  MessageStatus,
  QuickReply,
  PlaybookSuggestion,
  ChatSession,
} from '@/types/chat.types';

describe('Chat Types', () => {
  describe('ChatMessage', () => {
    test('text message should have required fields', () => {
      const message: ChatMessage = {
        id: 'msg-1',
        type: 'text',
        sender: 'user',
        content: '예산 등록 방법을 알려주세요',
        timestamp: new Date(),
        status: 'sent',
      };

      expect(message.id).toBe('msg-1');
      expect(message.type).toBe('text');
      expect(message.sender).toBe('user');
      expect(message.content).toBe('예산 등록 방법을 알려주세요');
      expect(message.status).toBe('sent');
    });

    test('playbook_suggestion message should have suggestions array', () => {
      const message: ChatMessage = {
        id: 'msg-2',
        type: 'playbook_suggestion',
        sender: 'assistant',
        content: '다음 플레이북을 추천합니다:',
        timestamp: new Date(),
        status: 'delivered',
        suggestions: [
          {
            playbookId: 'budget-register',
            title: '예산 등록',
            description: '신규 예산을 등록하는 방법',
            category: '교부관리',
          },
        ],
      };

      expect(message.suggestions).toBeDefined();
      expect(message.suggestions).toHaveLength(1);
      expect(message.suggestions![0].playbookId).toBe('budget-register');
    });

    test('quick_reply message should have quickReplies array', () => {
      const message: ChatMessage = {
        id: 'msg-3',
        type: 'quick_reply',
        sender: 'assistant',
        content: '어떤 작업을 도와드릴까요?',
        timestamp: new Date(),
        status: 'delivered',
        quickReplies: [
          { id: 'qr-1', label: '예산 등록', value: '예산 등록' },
          { id: 'qr-2', label: '지출 결의', value: '지출 결의' },
        ],
      };

      expect(message.quickReplies).toBeDefined();
      expect(message.quickReplies).toHaveLength(2);
    });

    test('guide message should have action field', () => {
      const message: ChatMessage = {
        id: 'msg-4',
        type: 'guide',
        sender: 'assistant',
        content: '다음 버튼을 클릭하세요',
        timestamp: new Date(),
        status: 'delivered',
        action: {
          type: 'highlight',
          selector: '#submit-btn',
          message: '이 버튼을 클릭하세요',
        },
      };

      expect(message.action).toBeDefined();
      expect(message.action!.type).toBe('highlight');
      expect(message.action!.selector).toBe('#submit-btn');
    });

    test('progress message should have progress field', () => {
      const message: ChatMessage = {
        id: 'msg-5',
        type: 'progress',
        sender: 'system',
        content: '진행 중...',
        timestamp: new Date(),
        status: 'delivered',
        progress: {
          current: 2,
          total: 5,
          stepName: '예산 입력',
        },
      };

      expect(message.progress).toBeDefined();
      expect(message.progress!.current).toBe(2);
      expect(message.progress!.total).toBe(5);
    });

    test('error message should have errorCode', () => {
      const message: ChatMessage = {
        id: 'msg-6',
        type: 'error',
        sender: 'system',
        content: '요청 처리 중 오류가 발생했습니다',
        timestamp: new Date(),
        status: 'delivered',
        errorCode: 'ERR_NETWORK',
      };

      expect(message.errorCode).toBe('ERR_NETWORK');
    });
  });

  describe('QuickReply', () => {
    test('should have required fields', () => {
      const quickReply: QuickReply = {
        id: 'qr-1',
        label: '예산 등록',
        value: 'register_budget',
      };

      expect(quickReply.id).toBe('qr-1');
      expect(quickReply.label).toBe('예산 등록');
      expect(quickReply.value).toBe('register_budget');
    });

    test('should have optional icon', () => {
      const quickReply: QuickReply = {
        id: 'qr-2',
        label: '도움말',
        value: 'help',
        icon: 'help-circle',
      };

      expect(quickReply.icon).toBe('help-circle');
    });
  });

  describe('PlaybookSuggestion', () => {
    test('should have required fields', () => {
      const suggestion: PlaybookSuggestion = {
        playbookId: 'budget-001',
        title: '예산 등록 가이드',
        description: '신규 예산을 등록하는 방법을 안내합니다',
        category: '교부관리',
      };

      expect(suggestion.playbookId).toBe('budget-001');
      expect(suggestion.title).toBe('예산 등록 가이드');
      expect(suggestion.category).toBe('교부관리');
    });

    test('should have optional difficulty and estimatedTime', () => {
      const suggestion: PlaybookSuggestion = {
        playbookId: 'budget-002',
        title: '복잡한 예산 처리',
        description: '복잡한 예산 처리 가이드',
        category: '교부관리',
        difficulty: '어려움',
        estimatedTime: '15분',
      };

      expect(suggestion.difficulty).toBe('어려움');
      expect(suggestion.estimatedTime).toBe('15분');
    });
  });

  describe('ChatSession', () => {
    test('should have required fields', () => {
      const session: ChatSession = {
        id: 'session-1',
        startedAt: new Date(),
        lastMessageAt: new Date(),
        messageCount: 5,
      };

      expect(session.id).toBe('session-1');
      expect(session.messageCount).toBe(5);
    });

    test('should have optional context', () => {
      const session: ChatSession = {
        id: 'session-2',
        startedAt: new Date(),
        lastMessageAt: new Date(),
        messageCount: 3,
        context: {
          activePlaybookId: 'budget-001',
          currentStep: 2,
        },
      };

      expect(session.context).toBeDefined();
      expect(session.context!.activePlaybookId).toBe('budget-001');
    });
  });
});
