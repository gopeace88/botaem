/**
 * AI 셀렉터 생성 서비스
 *
 * 녹화 시 DOM 컨텍스트를 분석하여 안정적인 폴백 셀렉터를 생성합니다.
 * Claude Haiku 모델을 사용하여 비용을 최적화합니다.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  SelectorWithScore,
  SelectorStrategy,
  AIGeneratedSelectors,
  ElementSnapshot,
  BoundingBox,
} from '../../shared/types';
import { configLoader } from '../../shared/config';

// AI 모델 설정
const AI_MODEL = 'claude-3-haiku-20240307';
const MAX_TOKENS = 800;

// 요소 정보 인터페이스
interface ElementInfo {
  tagName: string;
  id?: string;
  className?: string;
  textContent?: string;
  ariaLabel?: string;
  placeholder?: string;
  name?: string;
  type?: string;
  role?: string;
  dataTestId?: string;
  boundingBox?: BoundingBox;
  parentPath?: string;
}

// AI 응답 파싱 결과
interface ParsedAIResponse {
  primary: SelectorWithScore;
  fallbacks: SelectorWithScore[];
  reasoning: string;
  confidence: number;
}

export class AISelectorService {
  private client: Anthropic | null = null;
  private enabled: boolean = false;

  constructor() {
    this.initializeClient();
  }

  /**
   * Anthropic 클라이언트 초기화
   */
  private initializeClient(): void {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
      this.enabled = true;
      console.log('[AISelectorService] Initialized with API key');
    } else {
      console.warn('[AISelectorService] No API key found, AI selector generation disabled');
      this.enabled = false;
    }
  }

  /**
   * AI 기능 활성화 여부
   */
  isEnabled(): boolean {
    return this.enabled && this.client !== null;
  }

  /**
   * 요소에 대한 AI 폴백 셀렉터 생성
   */
  async generateSelectors(
    element: ElementInfo,
    domContext: string,
    message?: string
  ): Promise<AIGeneratedSelectors | null> {
    if (!this.isEnabled()) {
      console.log('[AISelectorService] AI disabled, skipping selector generation');
      return null;
    }

    try {
      const prompt = this.buildPrompt(element, domContext, message);
      const response = await this.callAI(prompt);
      const parsed = this.parseResponse(response);

      if (!parsed) {
        console.warn('[AISelectorService] Failed to parse AI response');
        return null;
      }

      return {
        selectors: [parsed.primary, ...parsed.fallbacks],
        generatedAt: new Date().toISOString(),
        model: AI_MODEL,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
        domContext: domContext.slice(0, 500), // 디버깅용으로 일부만 저장
      };
    } catch (error) {
      console.error('[AISelectorService] Error generating selectors:', error);
      return null;
    }
  }

  /**
   * AI 프롬프트 생성
   */
  private buildPrompt(element: ElementInfo, domContext: string, message?: string): string {
    return `당신은 웹 자동화 전문가입니다. 아래 요소에 대해 안정적인 CSS 셀렉터를 생성하세요.

## 요소 정보
- tagName: ${element.tagName}
- id: ${element.id || '없음'}
- className: ${element.className || '없음'}
- text: ${element.textContent?.slice(0, 100) || '없음'}
- aria-label: ${element.ariaLabel || '없음'}
- placeholder: ${element.placeholder || '없음'}
- name: ${element.name || '없음'}
- type: ${element.type || '없음'}
- role: ${element.role || '없음'}
- data-testid: ${element.dataTestId || '없음'}
${message ? `- 사용자 액션: ${message}` : ''}

## DOM 컨텍스트 (주변 HTML)
\`\`\`html
${domContext.slice(0, 2000)}
\`\`\`

## 요구사항
1. 가장 안정적인 primary 셀렉터 1개
2. 우선순위 순으로 fallback 셀렉터 4개
3. 각 셀렉터의 안정성 점수 (0-100)

## 셀렉터 우선순위 원칙 (안정성 순)
1. data-testid 속성 - 테스트용으로 가장 안정적
2. aria-label 속성 - 접근성 속성은 잘 변경되지 않음
3. name 속성 - 폼 요소에서 안정적
4. placeholder 속성 - 입력 필드에서 유용
5. role + 텍스트 조합 - 시맨틱 요소 식별
6. 텍스트 기반 (text=, :has-text) - 한국어 지원
7. 고유 ID - 동적 ID(숫자 포함)는 피할 것
8. 구조적 경로 - 부모 > 자식 조합

## 주의사항
- 동적으로 생성되는 ID(숫자 포함)는 사용하지 마세요
- 클래스명이 해시값처럼 보이면 사용하지 마세요
- 한국어 텍스트는 text= 셀렉터로 활용하세요
${configLoader.getAiPrompt()?.siteContext ? `- ${configLoader.getAiPrompt()?.siteContext}` : ''}

## 응답 형식 (JSON만 출력)
{
  "primary": { "strategy": "aria-label", "value": "[aria-label=\\"교부관리\\"]", "confidence": 95 },
  "fallbacks": [
    { "strategy": "text", "value": "text=\\"교부관리\\"", "confidence": 90 },
    { "strategy": "role", "value": "[role=\\"button\\"]:has-text(\\"교부관리\\")", "confidence": 85 },
    { "strategy": "css", "value": ".gnb-menu >> text=교부관리", "confidence": 75 },
    { "strategy": "xpath", "value": "//button[contains(text(), '교부관리')]", "confidence": 70 }
  ],
  "reasoning": "aria-label이 명시적으로 설정되어 있어 가장 안정적입니다.",
  "confidence": 88
}`;
  }

  /**
   * AI API 호출
   */
  private async callAI(prompt: string): Promise<string> {
    if (!this.client) {
      throw new Error('AI client not initialized');
    }

    const response = await this.client.messages.create({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    console.log(`[AISelectorService] API call - input: ${response.usage.input_tokens}, output: ${response.usage.output_tokens}`);
    return content.text;
  }

  /**
   * AI 응답 파싱
   */
  private parseResponse(response: string): ParsedAIResponse | null {
    try {
      // JSON 블록 추출 (```json ... ``` 또는 순수 JSON)
      let jsonStr = response;
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      // { 로 시작하는 부분 찾기
      const startIdx = jsonStr.indexOf('{');
      const endIdx = jsonStr.lastIndexOf('}');
      if (startIdx === -1 || endIdx === -1) {
        throw new Error('No JSON object found');
      }
      jsonStr = jsonStr.slice(startIdx, endIdx + 1);

      const parsed = JSON.parse(jsonStr);

      // 필수 필드 검증
      if (!parsed.primary || !parsed.fallbacks || !Array.isArray(parsed.fallbacks)) {
        throw new Error('Invalid response structure');
      }

      // SelectorWithScore 형식으로 변환
      const primary: SelectorWithScore = {
        strategy: this.mapStrategy(parsed.primary.strategy),
        value: parsed.primary.value,
        confidence: parsed.primary.confidence || 80,
      };

      const fallbacks: SelectorWithScore[] = parsed.fallbacks.map((f: any) => ({
        strategy: this.mapStrategy(f.strategy),
        value: f.value,
        confidence: f.confidence || 70,
      }));

      return {
        primary,
        fallbacks,
        reasoning: parsed.reasoning || '',
        confidence: parsed.confidence || 75,
      };
    } catch (error) {
      console.error('[AISelectorService] Failed to parse response:', error);
      console.error('[AISelectorService] Raw response:', response);
      return null;
    }
  }

  /**
   * 전략 문자열을 SelectorStrategy로 매핑
   */
  private mapStrategy(strategy: string): SelectorStrategy {
    const strategyMap: Record<string, SelectorStrategy> = {
      'css': 'css',
      'xpath': 'xpath',
      'text': 'text',
      'role': 'role',
      'testId': 'testId',
      'data-testid': 'testId',
      'placeholder': 'placeholder',
      'label': 'label',
      'aria-label': 'label',
      'name': 'css', // name은 CSS 셀렉터로 처리
    };

    return strategyMap[strategy] || 'css';
  }

  /**
   * ElementSnapshot에서 ElementInfo 추출
   */
  extractElementInfo(snapshot: ElementSnapshot): ElementInfo {
    return {
      tagName: snapshot.tagName,
      id: snapshot.attributes['id'],
      className: snapshot.attributes['class'],
      textContent: snapshot.textContent,
      ariaLabel: snapshot.attributes['aria-label'],
      placeholder: snapshot.attributes['placeholder'],
      name: snapshot.attributes['name'],
      type: snapshot.attributes['type'],
      role: snapshot.role || snapshot.attributes['role'],
      dataTestId: snapshot.attributes['data-testid'],
      boundingBox: snapshot.boundingBox,
    };
  }

  /**
   * DOM 컨텍스트 추출 (요소 주변 HTML)
   */
  async extractDOMContext(page: any, selector: string): Promise<string> {
    try {
      const context = await page.evaluate((sel: string) => {
        const element = document.querySelector(sel);
        if (!element) return '';

        // 부모 2단계까지 포함
        let parent = element.parentElement?.parentElement || element.parentElement || element;

        // outerHTML 추출 (최대 3000자)
        const html = parent.outerHTML;
        if (html.length > 3000) {
          // 요소 주변만 추출
          const elementHtml = element.outerHTML;
          const idx = html.indexOf(elementHtml);
          if (idx !== -1) {
            const start = Math.max(0, idx - 500);
            const end = Math.min(html.length, idx + elementHtml.length + 500);
            return '...' + html.slice(start, end) + '...';
          }
        }
        return html;
      }, selector);

      return context || '';
    } catch (error) {
      console.error('[AISelectorService] Failed to extract DOM context:', error);
      return '';
    }
  }

  /**
   * 녹화된 액션에 대해 AI 셀렉터 생성 (배치)
   */
  async generateSelectorsForAction(
    page: any,
    elementInfo: ElementInfo,
    selector: string,
    message?: string
  ): Promise<AIGeneratedSelectors | null> {
    const domContext = await this.extractDOMContext(page, selector);
    if (!domContext) {
      console.warn('[AISelectorService] No DOM context available');
      return null;
    }

    return this.generateSelectors(elementInfo, domContext, message);
  }
}

// 싱글톤 인스턴스
let instance: AISelectorService | null = null;

export function getAISelectorService(): AISelectorService {
  if (!instance) {
    instance = new AISelectorService();
  }
  return instance;
}
