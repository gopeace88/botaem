/**
 * Element Highlighter - 실행 중 요소 시각적 표시
 *
 * 보탬e 특화: 한국어 상태 메시지, 부드러운 애니메이션
 */

import { Page } from 'playwright';
import { BoundingBox } from '../../shared/types';

export interface HighlightOptions {
  color?: string;
  label?: string;
  duration?: number;
  pulseAnimation?: boolean;
}

export class Highlighter {
  private page: Page | null = null;
  private highlighterId = 'botame-highlighter';
  private statusBarId = 'botame-status-bar';

  /**
   * 페이지 설정
   */
  setPage(page: Page): void {
    this.page = page;
  }

  /**
   * 상태 바 표시
   */
  async showStatusBar(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): Promise<void> {
    if (!this.page) return;

    const colors = {
      info: '#3b82f6',      // 파란색
      success: '#22c55e',   // 초록색
      warning: '#f59e0b',   // 주황색
      error: '#ef4444',     // 빨간색
    };

    await this.page.evaluate(({ id, message, color }) => {
      // document.body가 없으면 건너뜀 (네비게이션 중)
      if (!document.body) return;

      let bar = document.getElementById(id);

      if (!bar) {
        bar = document.createElement('div');
        bar.id = id;
        document.body.appendChild(bar);
      }

      bar.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        padding: 12px 20px;
        background: ${color};
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 14px;
        font-weight: 600;
        text-align: center;
        z-index: 2147483647;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        transition: all 0.3s ease;
      `;
      bar.textContent = message;
    }, { id: this.statusBarId, message, color: colors[type] });
  }

  /**
   * 상태 바 숨기기
   */
  async hideStatusBar(): Promise<void> {
    if (!this.page) return;

    await this.page.evaluate((id) => {
      const bar = document.getElementById(id);
      if (bar) {
        bar.style.opacity = '0';
        setTimeout(() => bar.remove(), 300);
      }
    }, this.statusBarId);
  }

  /**
   * 요소 하이라이트
   */
  async highlightElement(
    selector: string,
    options: HighlightOptions = {}
  ): Promise<void> {
    if (!this.page) return;

    const {
      color = '#22c55e',
      label = '',
      duration = 2000,
      pulseAnimation = true,
    } = options;

    await this.page.evaluate(({ selector, color, label, pulse, highlighterId }) => {
      // document.body가 없으면 건너뜀 (네비게이션 중)
      if (!document.body) return;

      // 기존 하이라이터 제거
      document.querySelectorAll(`.${highlighterId}`).forEach(el => el.remove());

      // 요소 찾기
      let element: Element | null = null;
      try {
        element = document.querySelector(selector);
      } catch {
        // 잘못된 선택자
      }

      if (!element) return;

      const rect = element.getBoundingClientRect();

      // 하이라이트 오버레이 생성
      const overlay = document.createElement('div');
      overlay.className = highlighterId;
      overlay.style.cssText = `
        position: fixed;
        left: ${rect.left - 4}px;
        top: ${rect.top - 4}px;
        width: ${rect.width + 8}px;
        height: ${rect.height + 8}px;
        border: 3px solid ${color};
        border-radius: 4px;
        background: ${color}20;
        pointer-events: none;
        z-index: 2147483646;
        transition: all 0.2s ease;
        ${pulse ? `animation: botame-pulse 1s infinite;` : ''}
      `;

      // 라벨 추가
      if (label) {
        const labelEl = document.createElement('div');
        labelEl.style.cssText = `
          position: absolute;
          top: -28px;
          left: 0;
          padding: 4px 8px;
          background: ${color};
          color: white;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 12px;
          font-weight: 600;
          border-radius: 4px;
          white-space: nowrap;
        `;
        labelEl.textContent = label;
        overlay.appendChild(labelEl);
      }

      document.body.appendChild(overlay);

      // 애니메이션 스타일 추가
      if (pulse && document.head && !document.getElementById('botame-highlight-style')) {
        const style = document.createElement('style');
        style.id = 'botame-highlight-style';
        style.textContent = `
          @keyframes botame-pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.02); opacity: 0.8; }
          }
        `;
        document.head.appendChild(style);
      }
    }, { selector, color, label, pulse: pulseAnimation, highlighterId: this.highlighterId });

    // 지정된 시간 후 제거
    if (duration > 0) {
      setTimeout(() => this.clearHighlights(), duration);
    }
  }

  /**
   * 좌표로 하이라이트
   */
  async highlightByCoordinates(
    box: BoundingBox,
    options: HighlightOptions = {}
  ): Promise<void> {
    if (!this.page) return;

    const {
      color = '#f59e0b',  // 좌표 기반은 주황색
      label = '좌표 기반',
      duration = 2000,
    } = options;

    await this.page.evaluate(({ box, color, label, highlighterId }) => {
      // document.body가 없으면 건너뜀 (네비게이션 중)
      if (!document.body) return;

      // 기존 하이라이터 제거
      document.querySelectorAll(`.${highlighterId}`).forEach(el => el.remove());

      const overlay = document.createElement('div');
      overlay.className = highlighterId;
      overlay.style.cssText = `
        position: fixed;
        left: ${box.x - 4}px;
        top: ${box.y - 4}px;
        width: ${box.width + 8}px;
        height: ${box.height + 8}px;
        border: 3px dashed ${color};
        border-radius: 4px;
        background: ${color}15;
        pointer-events: none;
        z-index: 2147483646;
      `;

      if (label) {
        const labelEl = document.createElement('div');
        labelEl.style.cssText = `
          position: absolute;
          top: -28px;
          left: 0;
          padding: 4px 8px;
          background: ${color};
          color: white;
          font-size: 12px;
          font-weight: 600;
          border-radius: 4px;
        `;
        labelEl.textContent = label;
        overlay.appendChild(labelEl);
      }

      document.body.appendChild(overlay);
    }, { box, color, label, highlighterId: this.highlighterId });

    if (duration > 0) {
      setTimeout(() => this.clearHighlights(), duration);
    }
  }

  /**
   * 모든 하이라이트 제거
   */
  async clearHighlights(): Promise<void> {
    if (!this.page) return;

    await this.page.evaluate((highlighterId) => {
      document.querySelectorAll(`.${highlighterId}`).forEach(el => el.remove());
    }, this.highlighterId).catch(() => {});
  }

  /**
   * 성공 효과
   */
  async showSuccess(message: string = '완료!'): Promise<void> {
    await this.showStatusBar(`${message}`, 'success');
    setTimeout(() => this.hideStatusBar(), 2000);
  }

  /**
   * 실패 효과
   */
  async showError(message: string = '실패'): Promise<void> {
    await this.showStatusBar(`${message}`, 'error');
  }

  /**
   * 정리
   */
  async cleanup(): Promise<void> {
    await this.clearHighlights();
    await this.hideStatusBar();
    this.page = null;
  }
}
