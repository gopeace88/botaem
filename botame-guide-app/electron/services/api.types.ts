/**
 * Cloud API Types
 * Type definitions for cloud API services
 */

// === Claude API Types ===
export interface ChatRequest {
  message: string;
  context?: ChatContext;
  sessionId?: string;
}

export interface ChatContext {
  activePlaybookId?: string;
  currentStep?: number;
  variables?: Record<string, unknown>;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface ChatResponse {
  message: string;
  intent?: UserIntent;
  suggestions?: PlaybookRecommendation[];
  action?: SuggestedAction;
}

export type UserIntent =
  | 'ask_help'
  | 'start_playbook'
  | 'continue_playbook'
  | 'cancel_playbook'
  | 'clarify'
  | 'confirm'
  | 'reject'
  | 'unknown';

export interface SuggestedAction {
  type: 'start_playbook' | 'continue' | 'wait' | 'confirm' | 'input_required';
  playbookId?: string;
  stepIndex?: number;
  requiredInput?: string[];
}

// === Playbook Recommendation Types ===
export interface PlaybookRecommendation {
  playbookId: string;
  title: string;
  description: string;
  category: string;
  confidence: number;
  matchReason?: string;
}

export interface RecommendationRequest {
  query: string;
  category?: string;
  limit?: number;
}

export interface RecommendationResponse {
  recommendations: PlaybookRecommendation[];
  query: string;
  totalMatches: number;
}

// === API Configuration ===
export interface APIConfig {
  baseUrl: string;
  apiKey: string;
  model?: string;
  maxTokens?: number;
  timeout?: number;
}

// === API Error Types ===
export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type APIResult<T> =
  | { success: true; data: T }
  | { success: false; error: APIError };

// === Vision API Types (Interactive Watch & Guide) ===
export interface VisionVerifyRequest {
  screenshot: Buffer;
  stepMessage: string;
  verifyCondition?: string;
}

export interface VisionVerifyResponse {
  success: boolean;
  reason: string;
}

export interface VisionGuidanceRequest {
  screenshot: Buffer;
  stepMessage: string;
  failReason: string;
}

export interface VisionGuidanceResponse {
  guidance: string;
}

export interface VisionConfig {
  baseUrl: string;
  apiKey: string;
  model?: string;
  maxTokens?: number;
  imageDetail?: 'low' | 'high' | 'auto';
}
