/**
 * Supabase Service
 * Handles authentication and data persistence
 */

import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export interface ChatMessage {
  id?: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  intent?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

export interface ChatSession {
  id?: string;
  user_id: string;
  title?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PlaybookExecution {
  id?: string;
  user_id: string;
  session_id?: string;
  playbook_id: string;
  playbook_name: string;
  status: 'started' | 'completed' | 'failed' | 'cancelled';
  variables?: Record<string, unknown>;
  result?: Record<string, unknown>;
  started_at?: string;
  completed_at?: string;
}

export class SupabaseService {
  private client: SupabaseClient | null = null;
  private currentUser: User | null = null;
  private currentSession: Session | null = null;

  /**
   * Initialize Supabase client
   */
  initialize(config: SupabaseConfig): void {
    this.client = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });

    // 세션 상태 변경 감지
    this.client.auth.onAuthStateChange((_event, session) => {
      this.currentSession = session;
      this.currentUser = session?.user ?? null;
    });
  }

  /**
   * Check if client is initialized
   */
  isInitialized(): boolean {
    return this.client !== null;
  }

  /**
   * Get current user
   */
  getUser(): User | null {
    return this.currentUser;
  }

  /**
   * Get current session
   */
  getSession(): Session | null {
    return this.currentSession;
  }

  /**
   * Sign in with email and password
   */
  async signIn(
    email: string,
    password: string
  ): Promise<{ user: User | null; error: Error | null }> {
    if (!this.client) {
      return { user: null, error: new Error('Supabase not initialized') };
    }

    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { user: null, error };
    }

    this.currentUser = data.user;
    this.currentSession = data.session;
    return { user: data.user, error: null };
  }

  /**
   * Sign up with email and password
   */
  async signUp(
    email: string,
    password: string,
    displayName?: string
  ): Promise<{ user: User | null; error: Error | null }> {
    if (!this.client) {
      return { user: null, error: new Error('Supabase not initialized') };
    }

    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    });

    if (error) {
      return { user: null, error };
    }

    return { user: data.user, error: null };
  }

  /**
   * Sign out
   */
  async signOut(): Promise<{ error: Error | null }> {
    if (!this.client) {
      return { error: new Error('Supabase not initialized') };
    }

    const { error } = await this.client.auth.signOut();
    if (!error) {
      this.currentUser = null;
      this.currentSession = null;
    }
    return { error };
  }

  /**
   * Send chat message via Edge Function
   */
  async sendChatMessage(
    message: string,
    context?: { playbookContext?: string; systemInfo?: string },
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<{
    data: {
      message: string;
      intent: string;
      suggestions: Array<{
        id: string;
        name: string;
        description?: string;
        matchScore: number;
      }>;
      action?: {
        type: string;
        playbookId?: string;
        parameters?: Record<string, unknown>;
      };
    } | null;
    error: Error | null;
  }> {
    if (!this.client) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    const { data, error } = await this.client.functions.invoke('chat', {
      body: { message, context, conversationHistory },
    });

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  }

  // Chat Session Methods

  /**
   * Create a new chat session
   */
  async createChatSession(title?: string): Promise<{
    data: ChatSession | null;
    error: Error | null;
  }> {
    if (!this.client || !this.currentUser) {
      return { data: null, error: new Error('Not authenticated') };
    }

    const { data, error } = await this.client
      .from('chat_sessions')
      .insert({
        user_id: this.currentUser.id,
        title: title || `대화 ${new Date().toLocaleDateString('ko-KR')}`,
      })
      .select()
      .single();

    return { data, error };
  }

  /**
   * Get chat sessions for current user
   */
  async getChatSessions(): Promise<{
    data: ChatSession[] | null;
    error: Error | null;
  }> {
    if (!this.client || !this.currentUser) {
      return { data: null, error: new Error('Not authenticated') };
    }

    const { data, error } = await this.client
      .from('chat_sessions')
      .select('*')
      .eq('user_id', this.currentUser.id)
      .order('updated_at', { ascending: false });

    return { data, error };
  }

  /**
   * Save chat message
   */
  async saveChatMessage(message: Omit<ChatMessage, 'id' | 'created_at'>): Promise<{
    data: ChatMessage | null;
    error: Error | null;
  }> {
    if (!this.client) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    const { data, error } = await this.client
      .from('chat_messages')
      .insert(message)
      .select()
      .single();

    return { data, error };
  }

  /**
   * Get messages for a chat session
   */
  async getChatMessages(sessionId: string): Promise<{
    data: ChatMessage[] | null;
    error: Error | null;
  }> {
    if (!this.client) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    const { data, error } = await this.client
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    return { data, error };
  }

  // Playbook Execution Methods

  /**
   * Record playbook execution start
   */
  async startPlaybookExecution(
    playbookId: string,
    playbookName: string,
    sessionId?: string,
    variables?: Record<string, unknown>
  ): Promise<{ data: PlaybookExecution | null; error: Error | null }> {
    if (!this.client || !this.currentUser) {
      return { data: null, error: new Error('Not authenticated') };
    }

    const { data, error } = await this.client
      .from('playbook_executions')
      .insert({
        user_id: this.currentUser.id,
        session_id: sessionId,
        playbook_id: playbookId,
        playbook_name: playbookName,
        status: 'started',
        variables,
      })
      .select()
      .single();

    return { data, error };
  }

  /**
   * Update playbook execution status
   */
  async updatePlaybookExecution(
    executionId: string,
    status: 'completed' | 'failed' | 'cancelled',
    result?: Record<string, unknown>
  ): Promise<{ error: Error | null }> {
    if (!this.client) {
      return { error: new Error('Supabase not initialized') };
    }

    const { error } = await this.client
      .from('playbook_executions')
      .update({
        status,
        result,
        completed_at: new Date().toISOString(),
      })
      .eq('id', executionId);

    return { error };
  }

  /**
   * Get playbook execution history
   */
  async getPlaybookExecutions(limit = 50): Promise<{
    data: PlaybookExecution[] | null;
    error: Error | null;
  }> {
    if (!this.client || !this.currentUser) {
      return { data: null, error: new Error('Not authenticated') };
    }

    const { data, error } = await this.client
      .from('playbook_executions')
      .select('*')
      .eq('user_id', this.currentUser.id)
      .order('started_at', { ascending: false })
      .limit(limit);

    return { data, error };
  }
}

// Singleton instance
export const supabaseService = new SupabaseService();
