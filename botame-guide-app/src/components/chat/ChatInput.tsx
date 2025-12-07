import React, { useState, useCallback, KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

export interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  disabled = false,
  placeholder = '메시지를 입력하세요...',
}) => {
  const [value, setValue] = useState('');

  const handleSend = useCallback(() => {
    const trimmedValue = value.trim();
    if (trimmedValue && !disabled) {
      onSend(trimmedValue);
      setValue('');
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value);
  }, []);

  return (
    <div className="flex items-center gap-2 p-3 border-t bg-background">
      <input
        type="text"
        role="textbox"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        aria-label="메시지 입력"
        className={cn(
          'flex-1 px-4 py-2 rounded-full border bg-background',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'placeholder:text-muted-foreground'
        )}
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={disabled}
        aria-label="전송"
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center',
          'bg-primary text-primary-foreground',
          'hover:bg-primary/90 transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
          />
        </svg>
      </button>
    </div>
  );
};
