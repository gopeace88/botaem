import { render, screen } from '@testing-library/react';
import { ChatBubble } from '@/components/chat/ChatBubble';
import { ChatMessage } from '@/types/chat.types';

describe('ChatBubble', () => {
  const createMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
    id: 'msg-1',
    type: 'text',
    sender: 'user',
    content: 'Hello, World!',
    timestamp: new Date('2024-01-01T10:00:00'),
    status: 'sent',
    ...overrides,
  });

  describe('rendering', () => {
    test('should render message content', () => {
      const message = createMessage({ content: '안녕하세요' });
      render(<ChatBubble message={message} />);

      expect(screen.getByText('안녕하세요')).toBeInTheDocument();
    });

    test('should render user message with correct alignment', () => {
      const message = createMessage({ sender: 'user' });
      const { container } = render(<ChatBubble message={message} />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('justify-end');
    });

    test('should render assistant message with correct alignment', () => {
      const message = createMessage({ sender: 'assistant' });
      const { container } = render(<ChatBubble message={message} />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('justify-start');
    });

    test('should render system message with center alignment', () => {
      const message = createMessage({ sender: 'system', type: 'system' });
      const { container } = render(<ChatBubble message={message} />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('justify-center');
    });
  });

  describe('message types', () => {
    test('should render text message', () => {
      const message = createMessage({ type: 'text', content: '테스트 메시지' });
      render(<ChatBubble message={message} />);

      expect(screen.getByText('테스트 메시지')).toBeInTheDocument();
    });

    test('should render error message with error styling', () => {
      const message = createMessage({
        type: 'error',
        sender: 'system',
        content: '오류가 발생했습니다',
        errorCode: 'ERR_001',
      });
      render(<ChatBubble message={message} />);

      expect(screen.getByText('오류가 발생했습니다')).toBeInTheDocument();
      expect(screen.getByTestId('error-icon')).toBeInTheDocument();
    });

    test('should render progress message with progress bar', () => {
      const message = createMessage({
        type: 'progress',
        sender: 'system',
        content: '진행 중...',
        progress: { current: 2, total: 5, stepName: '예산 입력' },
      });
      render(<ChatBubble message={message} />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText('예산 입력')).toBeInTheDocument();
      expect(screen.getByText('2/5')).toBeInTheDocument();
    });
  });

  describe('timestamp', () => {
    test('should display formatted timestamp', () => {
      const message = createMessage({
        timestamp: new Date('2024-01-01T10:30:00'),
      });
      render(<ChatBubble message={message} />);

      expect(screen.getByText('10:30')).toBeInTheDocument();
    });
  });

  describe('status indicator', () => {
    test('should show sending indicator for sending status', () => {
      const message = createMessage({ status: 'sending' });
      render(<ChatBubble message={message} />);

      expect(screen.getByTestId('status-sending')).toBeInTheDocument();
    });

    test('should show sent indicator for sent status', () => {
      const message = createMessage({ status: 'sent' });
      render(<ChatBubble message={message} />);

      expect(screen.getByTestId('status-sent')).toBeInTheDocument();
    });

    test('should show delivered indicator for delivered status', () => {
      const message = createMessage({ sender: 'user', status: 'delivered' });
      render(<ChatBubble message={message} />);

      expect(screen.getByTestId('status-delivered')).toBeInTheDocument();
    });

    test('should show error indicator for error status', () => {
      const message = createMessage({ status: 'error' });
      render(<ChatBubble message={message} />);

      expect(screen.getByTestId('status-error')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    test('should have accessible role', () => {
      const message = createMessage();
      render(<ChatBubble message={message} />);

      expect(screen.getByRole('article')).toBeInTheDocument();
    });

    test('should have aria-label with sender', () => {
      const message = createMessage({ sender: 'assistant' });
      render(<ChatBubble message={message} />);

      const article = screen.getByRole('article');
      expect(article).toHaveAttribute('aria-label', expect.stringContaining('assistant'));
    });
  });
});
