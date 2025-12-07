import React from 'react';
import { QuickReply } from '@/types/chat.types';
import { cn } from '@/lib/utils';

export interface QuickReplyButtonsProps {
  replies: QuickReply[];
  onClick: (reply: QuickReply) => void;
  disabled?: boolean;
}

export const QuickReplyButtons: React.FC<QuickReplyButtonsProps> = ({
  replies,
  onClick,
  disabled = false,
}) => {
  if (replies.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {replies.map((reply) => (
        <button
          key={reply.id}
          type="button"
          onClick={() => onClick(reply)}
          disabled={disabled}
          aria-label={reply.label}
          className={cn(
            'px-4 py-2 rounded-full border border-primary/30',
            'text-sm text-primary bg-primary/5',
            'hover:bg-primary/10 hover:border-primary/50',
            'transition-colors duration-150',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'flex items-center gap-2'
          )}
        >
          {reply.icon && (
            <span className="w-4 h-4">
              {/* Icon placeholder - would be replaced with actual icon component */}
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </span>
          )}
          <span>{reply.label}</span>
        </button>
      ))}
    </div>
  );
};
