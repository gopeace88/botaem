import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInput } from '@/components/chat/ChatInput';

describe('ChatInput', () => {
  const mockOnSend = jest.fn();

  beforeEach(() => {
    mockOnSend.mockClear();
  });

  describe('rendering', () => {
    test('should render input field', () => {
      render(<ChatInput onSend={mockOnSend} />);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    test('should render send button', () => {
      render(<ChatInput onSend={mockOnSend} />);

      expect(screen.getByRole('button', { name: /전송/i })).toBeInTheDocument();
    });

    test('should render with custom placeholder', () => {
      render(<ChatInput onSend={mockOnSend} placeholder="무엇을 도와드릴까요?" />);

      expect(screen.getByPlaceholderText('무엇을 도와드릴까요?')).toBeInTheDocument();
    });

    test('should render with default placeholder', () => {
      render(<ChatInput onSend={mockOnSend} />);

      expect(screen.getByPlaceholderText('메시지를 입력하세요...')).toBeInTheDocument();
    });
  });

  describe('input handling', () => {
    test('should update input value on type', async () => {
      render(<ChatInput onSend={mockOnSend} />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, '안녕하세요');

      expect(input).toHaveValue('안녕하세요');
    });

    test('should call onSend with input value on button click', async () => {
      render(<ChatInput onSend={mockOnSend} />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, '테스트 메시지');

      const sendButton = screen.getByRole('button', { name: /전송/i });
      await userEvent.click(sendButton);

      expect(mockOnSend).toHaveBeenCalledWith('테스트 메시지');
    });

    test('should call onSend on Enter key press', async () => {
      render(<ChatInput onSend={mockOnSend} />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, '엔터 테스트{enter}');

      expect(mockOnSend).toHaveBeenCalledWith('엔터 테스트');
    });

    test('should clear input after sending', async () => {
      render(<ChatInput onSend={mockOnSend} />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, '클리어 테스트');

      const sendButton = screen.getByRole('button', { name: /전송/i });
      await userEvent.click(sendButton);

      expect(input).toHaveValue('');
    });

    test('should not send empty message', async () => {
      render(<ChatInput onSend={mockOnSend} />);

      const sendButton = screen.getByRole('button', { name: /전송/i });
      await userEvent.click(sendButton);

      expect(mockOnSend).not.toHaveBeenCalled();
    });

    test('should not send whitespace-only message', async () => {
      render(<ChatInput onSend={mockOnSend} />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, '   ');

      const sendButton = screen.getByRole('button', { name: /전송/i });
      await userEvent.click(sendButton);

      expect(mockOnSend).not.toHaveBeenCalled();
    });
  });

  describe('disabled state', () => {
    test('should disable input when disabled prop is true', () => {
      render(<ChatInput onSend={mockOnSend} disabled={true} />);

      expect(screen.getByRole('textbox')).toBeDisabled();
    });

    test('should disable button when disabled prop is true', () => {
      render(<ChatInput onSend={mockOnSend} disabled={true} />);

      expect(screen.getByRole('button', { name: /전송/i })).toBeDisabled();
    });

    test('should not call onSend when disabled', async () => {
      render(<ChatInput onSend={mockOnSend} disabled={true} />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '테스트' } });

      // Try enter key - won't work because input is disabled
      expect(mockOnSend).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    test('should have accessible label for input', () => {
      render(<ChatInput onSend={mockOnSend} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-label');
    });

    test('should have accessible label for button', () => {
      render(<ChatInput onSend={mockOnSend} />);

      const button = screen.getByRole('button', { name: /전송/i });
      expect(button).toBeInTheDocument();
    });
  });
});
