import React from 'react';
import { PlaybookSuggestion } from '@/types/chat.types';
import { cn } from '@/lib/utils';

export interface PlaybookSuggestionCardProps {
  suggestion: PlaybookSuggestion;
  onClick: (suggestion: PlaybookSuggestion) => void;
}

// Get difficulty badge style
const getDifficultyStyle = (
  difficulty: PlaybookSuggestion['difficulty']
): string => {
  switch (difficulty) {
    case '쉬움':
      return 'bg-green-100 text-green-800';
    case '보통':
      return 'bg-yellow-100 text-yellow-800';
    case '어려움':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const PlaybookSuggestionCard: React.FC<PlaybookSuggestionCardProps> = ({
  suggestion,
  onClick,
}) => {
  const { title, description, category, difficulty, estimatedTime } = suggestion;

  return (
    <button
      type="button"
      onClick={() => onClick(suggestion)}
      aria-label={`${title} 플레이북 실행`}
      className={cn(
        'w-full text-left p-4 rounded-lg border',
        'bg-card hover:bg-accent/50',
        'transition-colors duration-150',
        'focus:outline-none focus:ring-2 focus:ring-primary'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-medium text-foreground">{title}</h4>
        <span
          className={cn(
            'px-2 py-0.5 text-xs rounded-full shrink-0',
            'bg-primary/10 text-primary'
          )}
        >
          {category}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
        {description}
      </p>

      {/* Footer */}
      <div className="flex items-center gap-3 text-xs">
        {difficulty && (
          <span
            className={cn(
              'px-2 py-0.5 rounded-full',
              getDifficultyStyle(difficulty)
            )}
          >
            {difficulty}
          </span>
        )}
        {estimatedTime && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {estimatedTime}
          </span>
        )}
      </div>
    </button>
  );
};
