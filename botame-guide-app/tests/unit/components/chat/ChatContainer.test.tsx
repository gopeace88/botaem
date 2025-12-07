import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { ChatMessage, QuickReply, PlaybookSuggestion } from '@/types/chat.types';

describe('ChatContainer', () => {
  const mockOnSendMessage = jest.fn();
  const mockOnQuickReplyClick = jest.fn();
  const mockOnSuggestionClick = jest.fn();

  const createMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
    id: `msg-${Date.now()}-${Math.random()}`,
    type: 'text',
    sender: 'user',
    content: 'Test message',
    timestamp: new Date(),
    status: 'sent',
    ...overrides,
  });

  beforeEach(() => {
    mockOnSendMessage.mockClear();
    mockOnQuickReplyClick.mockClear();
    mockOnSuggestionClick.mockClear();
  });

  describe('rendering', () => {
    test('should render empty state when no messages', () => {
      render(
        <ChatContainer
          messages={[]}
          onSendMessage={mockOnSendMessage}
          onQuickReplyClick={mockOnQuickReplyClick}
          onSuggestionClick={mockOnSuggestionClick}
        />
      );

      expect(screen.getByText(/도움이 필요하시면/i)).toBeInTheDocument();
    });

    test('should render messages', () => {
      const messages = [
        createMessage({ content: '첫 번째 메시지' }),
        createMessage({ content: '두 번째 메시지', sender: 'assistant' }),
      ];

      render(
        <ChatContainer
          messages={messages}
          onSendMessage={mockOnSendMessage}
          onQuickReplyClick={mockOnQuickReplyClick}
          onSuggestionClick={mockOnSuggestionClick}
        />
      );

      expect(screen.getByText('첫 번째 메시지')).toBeInTheDocument();
      expect(screen.getByText('두 번째 메시지')).toBeInTheDocument();
    });

    test('should render input field', () => {
      render(
        <ChatContainer
          messages={[]}
          onSendMessage={mockOnSendMessage}
          onQuickReplyClick={mockOnQuickReplyClick}
          onSuggestionClick={mockOnSuggestionClick}
        />
      );

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  describe('quick replies', () => {
    test('should render quick reply buttons from last message', () => {
      const quickReplies: QuickReply[] = [
        { id: 'qr-1', label: '예', value: 'yes' },
        { id: 'qr-2', label: '아니오', value: 'no' },
      ];

      const messages = [
        createMessage({
          type: 'quick_reply',
          sender: 'assistant',
          content: '선택하세요',
          quickReplies,
        }),
      ];

      render(
        <ChatContainer
          messages={messages}
          onSendMessage={mockOnSendMessage}
          onQuickReplyClick={mockOnQuickReplyClick}
          onSuggestionClick={mockOnSuggestionClick}
        />
      );

      expect(screen.getByText('예')).toBeInTheDocument();
      expect(screen.getByText('아니오')).toBeInTheDocument();
    });

    test('should call onQuickReplyClick when quick reply clicked', async () => {
      const quickReplies: QuickReply[] = [
        { id: 'qr-1', label: '예', value: 'yes' },
      ];

      const messages = [
        createMessage({
          type: 'quick_reply',
          sender: 'assistant',
          content: '선택하세요',
          quickReplies,
        }),
      ];

      render(
        <ChatContainer
          messages={messages}
          onSendMessage={mockOnSendMessage}
          onQuickReplyClick={mockOnQuickReplyClick}
          onSuggestionClick={mockOnSuggestionClick}
        />
      );

      await userEvent.click(screen.getByText('예'));
      expect(mockOnQuickReplyClick).toHaveBeenCalledWith(quickReplies[0]);
    });
  });

  describe('playbook suggestions', () => {
    test('should render suggestion cards from last message', () => {
      const suggestions: PlaybookSuggestion[] = [
        {
          playbookId: 'pb-1',
          title: '예산 등록',
          description: '예산을 등록합니다',
          category: '교부관리',
        },
      ];

      const messages = [
        createMessage({
          type: 'playbook_suggestion',
          sender: 'assistant',
          content: '추천 플레이북',
          suggestions,
        }),
      ];

      render(
        <ChatContainer
          messages={messages}
          onSendMessage={mockOnSendMessage}
          onQuickReplyClick={mockOnQuickReplyClick}
          onSuggestionClick={mockOnSuggestionClick}
        />
      );

      expect(screen.getByText('예산 등록')).toBeInTheDocument();
    });

    test('should call onSuggestionClick when suggestion clicked', async () => {
      const suggestions: PlaybookSuggestion[] = [
        {
          playbookId: 'pb-1',
          title: '예산 등록',
          description: '예산을 등록합니다',
          category: '교부관리',
        },
      ];

      const messages = [
        createMessage({
          type: 'playbook_suggestion',
          sender: 'assistant',
          content: '추천 플레이북',
          suggestions,
        }),
      ];

      render(
        <ChatContainer
          messages={messages}
          onSendMessage={mockOnSendMessage}
          onQuickReplyClick={mockOnQuickReplyClick}
          onSuggestionClick={mockOnSuggestionClick}
        />
      );

      await userEvent.click(screen.getByText('예산 등록'));
      expect(mockOnSuggestionClick).toHaveBeenCalledWith(suggestions[0]);
    });
  });

  describe('sending messages', () => {
    test('should call onSendMessage when message sent', async () => {
      render(
        <ChatContainer
          messages={[]}
          onSendMessage={mockOnSendMessage}
          onQuickReplyClick={mockOnQuickReplyClick}
          onSuggestionClick={mockOnSuggestionClick}
        />
      );

      const input = screen.getByRole('textbox');
      await userEvent.type(input, '테스트 메시지');
      await userEvent.click(screen.getByRole('button', { name: /전송/i }));

      expect(mockOnSendMessage).toHaveBeenCalledWith('테스트 메시지');
    });
  });

  describe('typing indicator', () => {
    test('should show typing indicator when isTyping is true', () => {
      render(
        <ChatContainer
          messages={[]}
          onSendMessage={mockOnSendMessage}
          onQuickReplyClick={mockOnQuickReplyClick}
          onSuggestionClick={mockOnSuggestionClick}
          isTyping={true}
        />
      );

      expect(screen.getByTestId('typing-indicator')).toBeInTheDocument();
    });

    test('should hide typing indicator when isTyping is false', () => {
      render(
        <ChatContainer
          messages={[]}
          onSendMessage={mockOnSendMessage}
          onQuickReplyClick={mockOnQuickReplyClick}
          onSuggestionClick={mockOnSuggestionClick}
          isTyping={false}
        />
      );

      expect(screen.queryByTestId('typing-indicator')).not.toBeInTheDocument();
    });
  });

  describe('disabled state', () => {
    test('should disable input when disabled prop is true', () => {
      render(
        <ChatContainer
          messages={[]}
          onSendMessage={mockOnSendMessage}
          onQuickReplyClick={mockOnQuickReplyClick}
          onSuggestionClick={mockOnSuggestionClick}
          disabled={true}
        />
      );

      expect(screen.getByRole('textbox')).toBeDisabled();
    });
  });

  describe('accessibility', () => {
    test('should have accessible message list', () => {
      const messages = [createMessage({ content: '테스트' })];

      render(
        <ChatContainer
          messages={messages}
          onSendMessage={mockOnSendMessage}
          onQuickReplyClick={mockOnQuickReplyClick}
          onSuggestionClick={mockOnSuggestionClick}
        />
      );

      expect(screen.getByRole('log')).toBeInTheDocument();
    });
  });
});
