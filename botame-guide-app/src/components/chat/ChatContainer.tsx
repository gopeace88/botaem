import React, { useRef, useEffect } from 'react';
import {
  ChatMessage,
  QuickReply,
  PlaybookSuggestion,
} from '@/types/chat.types';
import { ChatBubble } from './ChatBubble';
import { ChatInput } from './ChatInput';
import { QuickReplyButtons } from './QuickReplyButtons';
import { PlaybookSuggestionCard } from './PlaybookSuggestionCard';

export interface ChatContainerProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  onQuickReplyClick: (reply: QuickReply) => void;
  onSuggestionClick: (suggestion: PlaybookSuggestion) => void;
  isTyping?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

// Typing indicator component
const TypingIndicator: React.FC = () => (
  <div
    data-testid="typing-indicator"
    className="flex items-center gap-1 px-3 py-2"
  >
    <span className="text-sm text-muted-foreground">입력 중</span>
    <span className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  </div>
);

// Empty state component
const EmptyState: React.FC = () => (
  <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
    <div className="w-16 h-16 mb-4 rounded-full bg-primary/10 flex items-center justify-center">
      <svg
        className="w-8 h-8 text-primary"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
        />
      </svg>
    </div>
    <h3 className="text-lg font-medium mb-2">안녕하세요!</h3>
    <p className="text-muted-foreground text-sm">
      도움이 필요하시면 메시지를 보내주세요.
    </p>
  </div>
);

export const ChatContainer: React.FC<ChatContainerProps> = ({
  messages,
  onSendMessage,
  onQuickReplyClick,
  onSuggestionClick,
  isTyping = false,
  disabled = false,
  placeholder,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    // Check if scrollIntoView exists (not available in jsdom)
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  // Get last message for interactive elements
  const lastMessage = messages[messages.length - 1];
  const showQuickReplies =
    lastMessage?.type === 'quick_reply' && lastMessage.quickReplies;
  const showSuggestions =
    lastMessage?.type === 'playbook_suggestion' && lastMessage.suggestions;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Messages Area */}
      <div
        role="log"
        aria-live="polite"
        aria-label="채팅 메시지"
        className="flex-1 overflow-y-auto p-4"
      >
        {messages.length === 0 && !isTyping ? (
          <EmptyState />
        ) : (
          <>
            {messages.map((message) => (
              <ChatBubble key={message.id} message={message} />
            ))}

            {/* Quick Replies */}
            {showQuickReplies && (
              <div className="flex justify-start mb-2">
                <QuickReplyButtons
                  replies={lastMessage.quickReplies!}
                  onClick={onQuickReplyClick}
                  disabled={disabled}
                />
              </div>
            )}

            {/* Playbook Suggestions */}
            {showSuggestions && (
              <div className="space-y-2 mt-2 max-w-[80%]">
                {lastMessage.suggestions!.map((suggestion) => (
                  <PlaybookSuggestionCard
                    key={suggestion.playbookId}
                    suggestion={suggestion}
                    onClick={onSuggestionClick}
                  />
                ))}
              </div>
            )}

            {/* Typing Indicator */}
            {isTyping && <TypingIndicator />}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <ChatInput
        onSend={onSendMessage}
        disabled={disabled}
        placeholder={placeholder}
      />
    </div>
  );
};
