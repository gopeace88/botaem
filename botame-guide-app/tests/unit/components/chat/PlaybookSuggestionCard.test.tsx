import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlaybookSuggestionCard } from '@/components/chat/PlaybookSuggestionCard';
import { PlaybookSuggestion } from '@/types/chat.types';

describe('PlaybookSuggestionCard', () => {
  const mockOnClick = jest.fn();

  const suggestion: PlaybookSuggestion = {
    playbookId: 'budget-001',
    title: '예산 등록 가이드',
    description: '신규 예산을 등록하는 방법을 안내합니다',
    category: '교부관리',
    difficulty: '쉬움',
    estimatedTime: '5분',
  };

  beforeEach(() => {
    mockOnClick.mockClear();
  });

  describe('rendering', () => {
    test('should render title', () => {
      render(<PlaybookSuggestionCard suggestion={suggestion} onClick={mockOnClick} />);

      expect(screen.getByText('예산 등록 가이드')).toBeInTheDocument();
    });

    test('should render description', () => {
      render(<PlaybookSuggestionCard suggestion={suggestion} onClick={mockOnClick} />);

      expect(screen.getByText('신규 예산을 등록하는 방법을 안내합니다')).toBeInTheDocument();
    });

    test('should render category badge', () => {
      render(<PlaybookSuggestionCard suggestion={suggestion} onClick={mockOnClick} />);

      expect(screen.getByText('교부관리')).toBeInTheDocument();
    });

    test('should render difficulty badge', () => {
      render(<PlaybookSuggestionCard suggestion={suggestion} onClick={mockOnClick} />);

      expect(screen.getByText('쉬움')).toBeInTheDocument();
    });

    test('should render estimated time', () => {
      render(<PlaybookSuggestionCard suggestion={suggestion} onClick={mockOnClick} />);

      expect(screen.getByText('5분')).toBeInTheDocument();
    });

    test('should render without optional fields', () => {
      const minimalSuggestion: PlaybookSuggestion = {
        playbookId: 'test-001',
        title: '테스트 가이드',
        description: '테스트 설명',
        category: '기타',
      };

      render(<PlaybookSuggestionCard suggestion={minimalSuggestion} onClick={mockOnClick} />);

      expect(screen.getByText('테스트 가이드')).toBeInTheDocument();
      expect(screen.queryByText('쉬움')).not.toBeInTheDocument();
      expect(screen.queryByText('5분')).not.toBeInTheDocument();
    });
  });

  describe('interaction', () => {
    test('should call onClick with suggestion on click', async () => {
      render(<PlaybookSuggestionCard suggestion={suggestion} onClick={mockOnClick} />);

      const card = screen.getByRole('button');
      await userEvent.click(card);

      expect(mockOnClick).toHaveBeenCalledWith(suggestion);
    });
  });

  describe('difficulty styling', () => {
    test('should render easy difficulty with green style', () => {
      render(<PlaybookSuggestionCard suggestion={suggestion} onClick={mockOnClick} />);

      const difficultyBadge = screen.getByText('쉬움');
      expect(difficultyBadge).toHaveClass('bg-green-100');
    });

    test('should render normal difficulty with yellow style', () => {
      const normalSuggestion = { ...suggestion, difficulty: '보통' as const };
      render(<PlaybookSuggestionCard suggestion={normalSuggestion} onClick={mockOnClick} />);

      const difficultyBadge = screen.getByText('보통');
      expect(difficultyBadge).toHaveClass('bg-yellow-100');
    });

    test('should render hard difficulty with red style', () => {
      const hardSuggestion = { ...suggestion, difficulty: '어려움' as const };
      render(<PlaybookSuggestionCard suggestion={hardSuggestion} onClick={mockOnClick} />);

      const difficultyBadge = screen.getByText('어려움');
      expect(difficultyBadge).toHaveClass('bg-red-100');
    });
  });

  describe('accessibility', () => {
    test('should have button role', () => {
      render(<PlaybookSuggestionCard suggestion={suggestion} onClick={mockOnClick} />);

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    test('should have accessible label', () => {
      render(<PlaybookSuggestionCard suggestion={suggestion} onClick={mockOnClick} />);

      const card = screen.getByRole('button');
      expect(card).toHaveAttribute('aria-label', expect.stringContaining(suggestion.title));
    });
  });
});
