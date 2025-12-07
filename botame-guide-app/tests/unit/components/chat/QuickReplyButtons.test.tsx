import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuickReplyButtons } from '@/components/chat/QuickReplyButtons';
import { QuickReply } from '@/types/chat.types';

describe('QuickReplyButtons', () => {
  const mockOnClick = jest.fn();

  const quickReplies: QuickReply[] = [
    { id: 'qr-1', label: '예산 등록', value: 'budget_register' },
    { id: 'qr-2', label: '지출 결의', value: 'expenditure' },
    { id: 'qr-3', label: '도움말', value: 'help', icon: 'help-circle' },
  ];

  beforeEach(() => {
    mockOnClick.mockClear();
  });

  describe('rendering', () => {
    test('should render all quick reply buttons', () => {
      render(<QuickReplyButtons replies={quickReplies} onClick={mockOnClick} />);

      expect(screen.getByText('예산 등록')).toBeInTheDocument();
      expect(screen.getByText('지출 결의')).toBeInTheDocument();
      expect(screen.getByText('도움말')).toBeInTheDocument();
    });

    test('should render with correct role', () => {
      render(<QuickReplyButtons replies={quickReplies} onClick={mockOnClick} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(3);
    });

    test('should render empty when no replies', () => {
      const { container } = render(<QuickReplyButtons replies={[]} onClick={mockOnClick} />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('interaction', () => {
    test('should call onClick with correct reply on click', async () => {
      render(<QuickReplyButtons replies={quickReplies} onClick={mockOnClick} />);

      const button = screen.getByText('예산 등록');
      await userEvent.click(button);

      expect(mockOnClick).toHaveBeenCalledWith(quickReplies[0]);
    });

    test('should call onClick with different replies', async () => {
      render(<QuickReplyButtons replies={quickReplies} onClick={mockOnClick} />);

      await userEvent.click(screen.getByText('지출 결의'));
      expect(mockOnClick).toHaveBeenCalledWith(quickReplies[1]);

      await userEvent.click(screen.getByText('도움말'));
      expect(mockOnClick).toHaveBeenCalledWith(quickReplies[2]);
    });
  });

  describe('disabled state', () => {
    test('should disable all buttons when disabled prop is true', () => {
      render(<QuickReplyButtons replies={quickReplies} onClick={mockOnClick} disabled={true} />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });

    test('should not call onClick when disabled', async () => {
      render(<QuickReplyButtons replies={quickReplies} onClick={mockOnClick} disabled={true} />);

      const button = screen.getByText('예산 등록');
      await userEvent.click(button);

      expect(mockOnClick).not.toHaveBeenCalled();
    });
  });

  describe('styling', () => {
    test('should have horizontal layout', () => {
      const { container } = render(
        <QuickReplyButtons replies={quickReplies} onClick={mockOnClick} />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('flex');
      expect(wrapper).toHaveClass('flex-wrap');
    });
  });

  describe('accessibility', () => {
    test('should have accessible labels', () => {
      render(<QuickReplyButtons replies={quickReplies} onClick={mockOnClick} />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toHaveAttribute('aria-label');
      });
    });
  });
});
