import { create } from 'zustand';
import {
  ChatMessage,
  ChatMessageType,
  ChatSender,
  MessageStatus,
  ChatSession,
  QuickReply,
  PlaybookSuggestion,
  GuideAction,
} from '@/types/chat.types';

// Generate unique ID
const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
const generateSessionId = () => `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Message input type (without auto-generated fields)
interface MessageInput {
  type: ChatMessageType;
  sender: ChatSender;
  content: string;
  quickReplies?: QuickReply[];
  suggestions?: PlaybookSuggestion[];
  action?: GuideAction;
  errorCode?: string;
  progress?: {
    current: number;
    total: number;
    stepName: string;
  };
  metadata?: Record<string, unknown>;
}

// Store state interface
interface ChatState {
  messages: ChatMessage[];
  session: ChatSession | null;
  isTyping: boolean;
  error: string | null;
}

// Store actions interface
interface ChatActions {
  // Message actions
  addMessage: (input: MessageInput) => void;
  updateMessageStatus: (id: string, status: MessageStatus) => void;
  clearMessages: () => void;

  // Typing indicator
  setTyping: (typing: boolean) => void;

  // Session management
  startSession: () => void;
  endSession: () => void;
  updateSessionContext: (context: ChatSession['context']) => void;

  // Error handling
  setError: (error: string) => void;
  clearError: () => void;

  // Convenience methods for sending messages
  sendUserMessage: (content: string) => void;
  sendAssistantMessage: (content: string) => void;
  sendQuickReplyMessage: (content: string, quickReplies: QuickReply[]) => void;
  sendSuggestionMessage: (content: string, suggestions: PlaybookSuggestion[]) => void;
  sendGuideMessage: (content: string, action: GuideAction) => void;
  sendProgressMessage: (current: number, total: number, stepName: string) => void;
  sendErrorMessage: (content: string, errorCode?: string) => void;
  sendSystemMessage: (content: string) => void;
}

// Combined store type
type ChatStore = ChatState & ChatActions;

// Create the store
export const useChatStore = create<ChatStore>((set, get) => ({
  // Initial state
  messages: [],
  session: null,
  isTyping: false,
  error: null,

  // Message actions
  addMessage: (input: MessageInput) => {
    const message: ChatMessage = {
      id: generateId(),
      timestamp: new Date(),
      status: input.sender === 'user' ? 'sent' : 'delivered',
      ...input,
    };

    set((state) => ({
      messages: [...state.messages, message],
      session: state.session
        ? {
            ...state.session,
            lastMessageAt: new Date(),
            messageCount: state.session.messageCount + 1,
          }
        : null,
    }));
  },

  updateMessageStatus: (id: string, status: MessageStatus) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, status } : msg
      ),
    }));
  },

  clearMessages: () => {
    set({ messages: [] });
  },

  // Typing indicator
  setTyping: (typing: boolean) => {
    set({ isTyping: typing });
  },

  // Session management
  startSession: () => {
    const now = new Date();
    set({
      session: {
        id: generateSessionId(),
        startedAt: now,
        lastMessageAt: now,
        messageCount: 0,
      },
    });
  },

  endSession: () => {
    set({ session: null });
  },

  updateSessionContext: (context: ChatSession['context']) => {
    set((state) => ({
      session: state.session
        ? { ...state.session, context }
        : null,
    }));
  },

  // Error handling
  setError: (error: string) => {
    set({ error });
  },

  clearError: () => {
    set({ error: null });
  },

  // Convenience methods
  sendUserMessage: (content: string) => {
    get().addMessage({
      type: 'text',
      sender: 'user',
      content,
    });
  },

  sendAssistantMessage: (content: string) => {
    get().addMessage({
      type: 'text',
      sender: 'assistant',
      content,
    });
  },

  sendQuickReplyMessage: (content: string, quickReplies: QuickReply[]) => {
    get().addMessage({
      type: 'quick_reply',
      sender: 'assistant',
      content,
      quickReplies,
    });
  },

  sendSuggestionMessage: (content: string, suggestions: PlaybookSuggestion[]) => {
    get().addMessage({
      type: 'playbook_suggestion',
      sender: 'assistant',
      content,
      suggestions,
    });
  },

  sendGuideMessage: (content: string, action: GuideAction) => {
    get().addMessage({
      type: 'guide',
      sender: 'assistant',
      content,
      action,
    });
  },

  sendProgressMessage: (current: number, total: number, stepName: string) => {
    get().addMessage({
      type: 'progress',
      sender: 'system',
      content: `${stepName} (${current}/${total})`,
      progress: { current, total, stepName },
    });
  },

  sendErrorMessage: (content: string, errorCode?: string) => {
    get().addMessage({
      type: 'error',
      sender: 'system',
      content,
      errorCode,
    });
  },

  sendSystemMessage: (content: string) => {
    get().addMessage({
      type: 'system',
      sender: 'system',
      content,
    });
  },
}));
