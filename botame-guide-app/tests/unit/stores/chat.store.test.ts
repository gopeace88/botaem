import { act, renderHook } from '@testing-library/react';
import { useChatStore } from '@/stores/chat.store';
import { ChatMessage, QuickReply, PlaybookSuggestion } from '@/types/chat.types';

describe('ChatStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    const { result } = renderHook(() => useChatStore());
    act(() => {
      result.current.clearMessages();
      result.current.endSession();
    });
  });

  describe('messages', () => {
    test('should start with empty messages', () => {
      const { result } = renderHook(() => useChatStore());
      expect(result.current.messages).toEqual([]);
    });

    test('should add message', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.addMessage({
          type: 'text',
          sender: 'user',
          content: 'Hello',
        });
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].content).toBe('Hello');
      expect(result.current.messages[0].id).toBeDefined();
      expect(result.current.messages[0].timestamp).toBeDefined();
    });

    test('should add multiple messages', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.addMessage({
          type: 'text',
          sender: 'user',
          content: 'First',
        });
        result.current.addMessage({
          type: 'text',
          sender: 'assistant',
          content: 'Second',
        });
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0].content).toBe('First');
      expect(result.current.messages[1].content).toBe('Second');
    });

    test('should update message status', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.addMessage({
          type: 'text',
          sender: 'user',
          content: 'Test',
        });
      });

      const messageId = result.current.messages[0].id;

      act(() => {
        result.current.updateMessageStatus(messageId, 'delivered');
      });

      expect(result.current.messages[0].status).toBe('delivered');
    });

    test('should clear messages', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.addMessage({
          type: 'text',
          sender: 'user',
          content: 'Test',
        });
        result.current.clearMessages();
      });

      expect(result.current.messages).toEqual([]);
    });
  });

  describe('typing indicator', () => {
    test('should start with isTyping false', () => {
      const { result } = renderHook(() => useChatStore());
      expect(result.current.isTyping).toBe(false);
    });

    test('should set typing state', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.setTyping(true);
      });

      expect(result.current.isTyping).toBe(true);

      act(() => {
        result.current.setTyping(false);
      });

      expect(result.current.isTyping).toBe(false);
    });
  });

  describe('session', () => {
    test('should start with no session', () => {
      const { result } = renderHook(() => useChatStore());
      expect(result.current.session).toBeNull();
    });

    test('should start new session', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.startSession();
      });

      expect(result.current.session).not.toBeNull();
      expect(result.current.session?.id).toBeDefined();
      expect(result.current.session?.messageCount).toBe(0);
    });

    test('should update session on new message', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.startSession();
        result.current.addMessage({
          type: 'text',
          sender: 'user',
          content: 'Test',
        });
      });

      expect(result.current.session?.messageCount).toBe(1);
    });

    test('should end session', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.startSession();
        result.current.endSession();
      });

      expect(result.current.session).toBeNull();
    });
  });

  describe('error handling', () => {
    test('should start with no error', () => {
      const { result } = renderHook(() => useChatStore());
      expect(result.current.error).toBeNull();
    });

    test('should set error', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.setError('Network error');
      });

      expect(result.current.error).toBe('Network error');
    });

    test('should clear error', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.setError('Error');
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('convenience methods', () => {
    test('should send user message', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.sendUserMessage('Hello');
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].sender).toBe('user');
      expect(result.current.messages[0].content).toBe('Hello');
      expect(result.current.messages[0].type).toBe('text');
    });

    test('should send assistant message', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.sendAssistantMessage('Hi there!');
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].sender).toBe('assistant');
      expect(result.current.messages[0].content).toBe('Hi there!');
    });

    test('should send quick reply message', () => {
      const { result } = renderHook(() => useChatStore());
      const quickReplies: QuickReply[] = [
        { id: 'qr-1', label: 'Option 1', value: 'opt1' },
        { id: 'qr-2', label: 'Option 2', value: 'opt2' },
      ];

      act(() => {
        result.current.sendQuickReplyMessage('Choose:', quickReplies);
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].type).toBe('quick_reply');
      expect(result.current.messages[0].quickReplies).toEqual(quickReplies);
    });

    test('should send suggestion message', () => {
      const { result } = renderHook(() => useChatStore());
      const suggestions: PlaybookSuggestion[] = [
        {
          playbookId: 'pb-1',
          title: 'Test Playbook',
          description: 'Test description',
          category: '기타',
        },
      ];

      act(() => {
        result.current.sendSuggestionMessage('Recommendations:', suggestions);
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].type).toBe('playbook_suggestion');
      expect(result.current.messages[0].suggestions).toEqual(suggestions);
    });

    test('should send guide message', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.sendGuideMessage('Click the button', {
          type: 'highlight',
          selector: '#btn',
        });
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].type).toBe('guide');
      expect(result.current.messages[0].action).toBeDefined();
    });

    test('should send progress message', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.sendProgressMessage(2, 5, 'Step 2');
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].type).toBe('progress');
      expect(result.current.messages[0].progress).toEqual({
        current: 2,
        total: 5,
        stepName: 'Step 2',
      });
    });

    test('should send error message', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.sendErrorMessage('Something went wrong', 'ERR_001');
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].type).toBe('error');
      expect(result.current.messages[0].errorCode).toBe('ERR_001');
    });
  });
});
