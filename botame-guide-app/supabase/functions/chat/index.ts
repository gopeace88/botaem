// Supabase Edge Function: Claude API Proxy
// API 키를 서버사이드에서 안전하게 관리

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

interface ChatRequest {
  message: string;
  context?: {
    playbookContext?: string;
    systemInfo?: string;
  };
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

interface ChatResponse {
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
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 인증 확인
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Supabase 클라이언트 생성
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // 사용자 확인
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 요청 파싱
    const { message, context, conversationHistory }: ChatRequest = await req.json();

    // Claude API 키 확인
    const claudeApiKey = Deno.env.get('CLAUDE_API_KEY');
    if (!claudeApiKey) {
      return new Response(
        JSON.stringify({ error: 'Claude API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 시스템 프롬프트 구성
    const systemPrompt = buildSystemPrompt(context);

    // 대화 이력 구성
    const messages = [
      ...(conversationHistory || []).map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    // Claude API 호출
    const claudeResponse = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        messages,
      }),
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error('Claude API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Claude API request failed' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const claudeData = await claudeResponse.json();
    const responseText = claudeData.content?.[0]?.text || '';

    // 응답 파싱
    const response = parseClaudeResponse(responseText);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildSystemPrompt(context?: ChatRequest['context']): string {
  let prompt = `당신은 '보탬e 가이드'입니다. 지방보조금관리시스템(보탬e)을 사용하는 공무원들을 도와주는 AI 어시스턴트입니다.

역할:
1. 사용자의 질문을 이해하고 적절한 업무 프로세스(플레이북)를 추천합니다.
2. 업무 절차를 친절하게 안내합니다.
3. 시스템 사용 중 발생하는 문제 해결을 돕습니다.

응답 형식:
- 사용자 의도(intent)를 파악하세요: recommendation(추천), question(질문), help(도움), action(실행)
- 관련 플레이북이 있다면 JSON 형식으로 suggestions에 포함하세요
- 실행할 액션이 있다면 action에 포함하세요

응답 예시:
{
  "intent": "recommendation",
  "message": "예산 등록 업무를 도와드리겠습니다.",
  "suggestions": [{"id": "budget-register", "name": "예산 등록", "matchScore": 0.95}],
  "action": {"type": "execute_playbook", "playbookId": "budget-register"}
}`;

  if (context?.playbookContext) {
    prompt += `\n\n현재 플레이북 컨텍스트:\n${context.playbookContext}`;
  }

  if (context?.systemInfo) {
    prompt += `\n\n시스템 정보:\n${context.systemInfo}`;
  }

  return prompt;
}

function parseClaudeResponse(text: string): ChatResponse {
  // JSON 형식 응답 파싱 시도
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        message: parsed.message || text,
        intent: parsed.intent || 'unknown',
        suggestions: parsed.suggestions || [],
        action: parsed.action,
      };
    } catch {
      // JSON 파싱 실패 시 텍스트 응답
    }
  }

  return {
    message: text,
    intent: 'unknown',
    suggestions: [],
  };
}
