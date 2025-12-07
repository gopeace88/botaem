/**
 * Chat Types
 * Type definitions for the chat interface
 */

// === Message Types ===
export type ChatMessageType =
  | 'text'
  | 'playbook_suggestion'
  | 'quick_reply'
  | 'guide'
  | 'error'
  | 'system'
  | 'progress';

export type ChatSender = 'user' | 'assistant' | 'system';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'error';

// === Quick Reply ===
export interface QuickReply {
  id: string;
  label: string;
  value: string;
  icon?: string;
}

// === Playbook Suggestion ===
export interface PlaybookSuggestion {
  playbookId: string;
  title: string;
  description: string;
  category: string;
  difficulty?: '쉬움' | '보통' | '어려움';
  estimatedTime?: string;
}

// === Guide Action ===
export interface GuideAction {
  type: 'highlight' | 'click' | 'scroll' | 'focus';
  selector: string;
  message?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
}

// === Chat Message ===
export interface ChatMessage {
  id: string;
  type: ChatMessageType;
  sender: ChatSender;
  content: string;
  timestamp: Date;
  status: MessageStatus;

  // Optional fields based on type
  quickReplies?: QuickReply[];
  suggestions?: PlaybookSuggestion[];
  action?: GuideAction;

  // For error messages
  errorCode?: string;

  // For progress messages
  progress?: {
    current: number;
    total: number;
    stepName: string;
  };

  // Metadata
  metadata?: Record<string, unknown>;
}

// === Chat Session ===
export interface ChatSession {
  id: string;
  startedAt: Date;
  lastMessageAt: Date;
  messageCount: number;
  context?: {
    activePlaybookId?: string;
    currentStep?: number;
    variables?: Record<string, unknown>;
  };
}

// === Chat State ===
export interface ChatState {
  messages: ChatMessage[];
  session: ChatSession | null;
  isTyping: boolean;
  error: string | null;
}

// === Input Props ===
export interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

// === Message Props ===
export interface ChatMessageProps {
  message: ChatMessage;
  onQuickReplyClick?: (reply: QuickReply) => void;
  onSuggestionClick?: (suggestion: PlaybookSuggestion) => void;
  onActionComplete?: () => void;
}
