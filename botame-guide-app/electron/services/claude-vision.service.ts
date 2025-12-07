/**
 * Claude Vision Service
 * Handles Vision API calls for Interactive Watch & Guide
 *
 * Cost optimization:
 * - Uses low resolution images (detail: "low")
 * - Limited max_tokens (100 for verify, 150 for guidance)
 * - Uses claude-3-haiku for cost efficiency
 */

import {
  VisionConfig,
  VisionVerifyRequest,
  VisionVerifyResponse,
  VisionGuidanceRequest,
  VisionGuidanceResponse,
  APIResult,
} from './api.types';

const DEFAULT_MODEL = 'claude-3-haiku-20240307';
const VERIFY_MAX_TOKENS = 100;
const GUIDANCE_MAX_TOKENS = 150;
const DEFAULT_IMAGE_DETAIL = 'low';

export class ClaudeVisionService {
  private config: Required<VisionConfig>;

  constructor(config: VisionConfig) {
    this.config = {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model || DEFAULT_MODEL,
      maxTokens: config.maxTokens || VERIFY_MAX_TOKENS,
      imageDetail: config.imageDetail || DEFAULT_IMAGE_DETAIL,
    };
  }

  /**
   * Verify if a step was completed successfully using Vision API
   * Returns success/failure with reason
   */
  async verifyScreenshot(
    request: VisionVerifyRequest
  ): Promise<APIResult<VisionVerifyResponse>> {
    try {
      const base64Image = request.screenshot.toString('base64');
      const mediaType = 'image/png';

      const systemPrompt = `당신은 업무 가이드 시스템의 검증 AI입니다.
스크린샷을 보고 사용자가 지시된 작업을 성공적으로 완료했는지 판단합니다.
반드시 JSON 형식으로만 응답하세요.`;

      const userPrompt = `[작업 지시]
${request.stepMessage}

${request.verifyCondition ? `[검증 조건]\n${request.verifyCondition}\n` : ''}
[질문]
첨부된 스크린샷을 보고, 위 작업이 성공적으로 완료되었는지 판단하세요.

JSON으로만 응답:
{"success": true/false, "reason": "판단 근거 1줄"}`;

      const response = await fetch(`${this.config.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: VERIFY_MAX_TOKENS,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: mediaType,
                    data: base64Image,
                  },
                },
                {
                  type: 'text',
                  text: userPrompt,
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        return this.handleErrorResponse(response);
      }

      const data = await response.json();
      const messageText = this.extractMessageText(data);
      const parsed = this.parseVerifyResponse(messageText);

      return {
        success: true,
        data: parsed,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'VISION_ERROR',
          message: error instanceof Error ? error.message : 'Vision API error',
        },
      };
    }
  }

  /**
   * Generate guidance when user makes a mistake
   * Returns actionable instruction for the user
   */
  async generateGuidance(
    request: VisionGuidanceRequest
  ): Promise<APIResult<VisionGuidanceResponse>> {
    try {
      const base64Image = request.screenshot.toString('base64');
      const mediaType = 'image/png';

      const systemPrompt = `당신은 업무 가이드 시스템의 도우미 AI입니다.
사용자가 실수했을 때 무엇을 해야 하는지 친절하게 안내합니다.
한국어로 1-2문장으로 간단명료하게 안내하세요.`;

      const userPrompt = `[실패한 작업]
${request.stepMessage}

[실패 원인]
${request.failReason}

스크린샷을 보고, 사용자가 지금 무엇을 해야 하는지 안내하세요.
1-2문장으로 간결하게 답변하세요.`;

      const response = await fetch(`${this.config.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: GUIDANCE_MAX_TOKENS,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: mediaType,
                    data: base64Image,
                  },
                },
                {
                  type: 'text',
                  text: userPrompt,
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        return this.handleErrorResponse(response);
      }

      const data = await response.json();
      const guidance = this.extractMessageText(data);

      return {
        success: true,
        data: { guidance: guidance.trim() },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'VISION_ERROR',
          message: error instanceof Error ? error.message : 'Vision API error',
        },
      };
    }
  }

  /**
   * Parse verification response JSON
   */
  private parseVerifyResponse(text: string): VisionVerifyResponse {
    try {
      // Try to extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          success: Boolean(parsed.success),
          reason: String(parsed.reason || ''),
        };
      }
    } catch {
      // If JSON parsing fails, try to infer from text
    }

    // Fallback: infer from text content
    const lowerText = text.toLowerCase();
    const isSuccess =
      lowerText.includes('성공') ||
      lowerText.includes('완료') ||
      lowerText.includes('true');

    return {
      success: isSuccess,
      reason: text.substring(0, 100),
    };
  }

  /**
   * Extract message text from API response
   */
  private extractMessageText(data: {
    content: Array<{ type: string; text?: string }>;
  }): string {
    const textContent = data.content.find((c) => c.type === 'text');
    return textContent?.text || '';
  }

  /**
   * Handle error response from API
   */
  private async handleErrorResponse<T>(response: Response): Promise<APIResult<T>> {
    let errorMessage = response.statusText;

    try {
      const errorData = await response.json();
      errorMessage = errorData.error?.message || errorMessage;
    } catch {
      // Use status text if JSON parsing fails
    }

    let errorCode: string;

    switch (response.status) {
      case 401:
        errorCode = 'AUTH_ERROR';
        break;
      case 429:
        errorCode = 'RATE_LIMIT';
        break;
      case 500:
      case 502:
      case 503:
        errorCode = 'SERVER_ERROR';
        break;
      default:
        errorCode = 'API_ERROR';
    }

    return {
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
        details: { status: response.status },
      },
    };
  }
}
