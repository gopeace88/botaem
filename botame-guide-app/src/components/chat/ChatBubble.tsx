import React from 'react';
import { ChatMessage, ChatSender } from '@/types/chat.types';
import { cn } from '@/lib/utils';

export interface ChatBubbleProps {
  message: ChatMessage;
}

// Format time to HH:MM
const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

// Get alignment class based on sender
const getAlignmentClass = (sender: ChatSender): string => {
  switch (sender) {
    case 'user':
      return 'justify-end';
    case 'assistant':
      return 'justify-start';
    case 'system':
      return 'justify-center';
    default:
      return 'justify-start';
  }
};

// Get bubble style based on sender
const getBubbleClass = (sender: ChatSender, type: string): string => {
  if (type === 'error') {
    return 'bg-destructive/10 text-destructive border border-destructive/20';
  }

  if (type === 'system' || type === 'progress') {
    return 'bg-muted text-muted-foreground text-sm';
  }

  switch (sender) {
    case 'user':
      return 'bg-primary text-primary-foreground';
    case 'assistant':
      return 'bg-secondary text-secondary-foreground';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

// Status indicator component
const StatusIndicator: React.FC<{ status: ChatMessage['status'] }> = ({ status }) => {
  switch (status) {
    case 'sending':
      return (
        <span data-testid="status-sending" className="text-muted-foreground">
          <svg className="w-3 h-3 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
          </svg>
        </span>
      );
    case 'sent':
      return (
        <span data-testid="status-sent" className="text-muted-foreground">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </span>
      );
    case 'delivered':
      return (
        <span data-testid="status-delivered" className="text-primary">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7M5 13l4 4L19 7" />
          </svg>
        </span>
      );
    case 'error':
      return (
        <span data-testid="status-error" className="text-destructive">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>
      );
    default:
      return null;
  }
};

// Error icon component
const ErrorIcon: React.FC = () => (
  <span data-testid="error-icon" className="text-destructive mr-2">
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  </span>
);

// Progress bar component
const ProgressBar: React.FC<{
  current: number;
  total: number;
  stepName: string;
}> = ({ current, total, stepName }) => {
  const percentage = Math.round((current / total) * 100);

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1 text-xs">
        <span>{stepName}</span>
        <span>{current}/{total}</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={total}
        className="w-full bg-muted rounded-full h-2"
      >
        <div
          className="bg-primary rounded-full h-2 transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const { type, sender, content, timestamp, status, progress } = message;

  const renderContent = () => {
    if (type === 'error') {
      return (
        <div className="flex items-center">
          <ErrorIcon />
          <span>{content}</span>
        </div>
      );
    }

    if (type === 'progress' && progress) {
      return (
        <div className="w-48">
          <ProgressBar
            current={progress.current}
            total={progress.total}
            stepName={progress.stepName}
          />
        </div>
      );
    }

    return <span>{content}</span>;
  };

  return (
    <div className={cn('flex w-full mb-2', getAlignmentClass(sender))}>
      <article
        role="article"
        aria-label={`${sender} 메시지`}
        className={cn(
          'max-w-[80%] rounded-lg px-3 py-2',
          getBubbleClass(sender, type)
        )}
      >
        {renderContent()}
        <div className="flex items-center justify-end gap-1 mt-1">
          <span className="text-xs opacity-60">
            {formatTime(timestamp instanceof Date ? timestamp : new Date(timestamp))}
          </span>
          {sender === 'user' && <StatusIndicator status={status} />}
        </div>
      </article>
    </div>
  );
};
