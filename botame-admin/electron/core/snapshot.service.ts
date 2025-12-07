/**
 * DOM Snapshot Service - CDP 기반 DOM 스냅샷 수집
 *
 * browser-use의 DOM 스냅샷 패턴을 TypeScript로 구현
 * 보탬e 특화: 한국 웹사이트의 복잡한 iframe 구조 처리
 */

import { Page, CDPSession } from 'playwright';
import { DOMSnapshot, ElementSnapshot, BoundingBox } from '../../shared/types';

export class SnapshotService {
  private cdpSession: CDPSession | null = null;
  private page: Page | null = null;

  /**
   * CDP 세션 초기화
   */
  async initialize(page: Page): Promise<void> {
    this.page = page;
    this.cdpSession = await page.context().newCDPSession(page);

    // DOM 도메인 활성화
    await this.cdpSession.send('DOM.enable');
    await this.cdpSession.send('DOMSnapshot.enable');

    console.log('[SnapshotService] CDP session initialized');
  }

  /**
   * 현재 페이지의 DOM 스냅샷 캡처
   */
  async captureSnapshot(): Promise<DOMSnapshot> {
    if (!this.cdpSession || !this.page) {
      throw new Error('SnapshotService not initialized');
    }

    const url = this.page.url();
    const viewport = this.page.viewportSize() || { width: 1920, height: 1080 };

    // CDP로 DOM 스냅샷 수집
    const [domSnapshot] = await Promise.all([
      this.cdpSession.send('DOMSnapshot.captureSnapshot', {
        computedStyles: ['display', 'visibility', 'opacity', 'pointer-events'],
        includePaintOrder: true,
        includeDOMRects: true,
      }),
    ]);

    // 스냅샷 데이터를 ElementSnapshot 배열로 변환
    const elements = await this.processSnapshotData(domSnapshot);

    return {
      timestamp: Date.now(),
      url,
      viewport,
      elements,
    };
  }

  /**
   * 특정 좌표의 요소 찾기
   */
  async getElementAtPoint(x: number, y: number): Promise<ElementSnapshot | null> {
    if (!this.cdpSession) return null;

    try {
      const result = await this.cdpSession.send('DOM.getNodeForLocation', {
        x: Math.round(x),
        y: Math.round(y),
        includeUserAgentShadowDOM: false,
      });

      if (result.backendNodeId) {
        return this.getElementByBackendNodeId(result.backendNodeId);
      }
    } catch (error) {
      console.error('[SnapshotService] getElementAtPoint error:', error);
    }

    return null;
  }

  /**
   * backendNodeId로 요소 정보 가져오기
   */
  async getElementByBackendNodeId(backendNodeId: number): Promise<ElementSnapshot | null> {
    if (!this.cdpSession) return null;

    try {
      // 노드 정보 가져오기
      const { node } = await this.cdpSession.send('DOM.describeNode', {
        backendNodeId,
        depth: 0,
      });

      // 박스 모델 가져오기
      let boundingBox: BoundingBox = { x: 0, y: 0, width: 0, height: 0 };
      try {
        const boxModel = await this.cdpSession.send('DOM.getBoxModel', {
          backendNodeId,
        });
        if (boxModel.model?.content) {
          const content = boxModel.model.content;
          boundingBox = {
            x: content[0],
            y: content[1],
            width: content[2] - content[0],
            height: content[5] - content[1],
          };
        }
      } catch {
        // 박스 모델이 없는 요소 (예: 숨겨진 요소)
      }

      // 속성을 Record로 변환
      const attributes: Record<string, string> = {};
      if (node.attributes) {
        for (let i = 0; i < node.attributes.length; i += 2) {
          attributes[node.attributes[i]] = node.attributes[i + 1];
        }
      }

      // XPath 생성
      const xpath = this.generateXPathFromNode(node, attributes);

      return {
        nodeId: node.nodeId || 0,
        backendNodeId,
        tagName: node.nodeName || 'UNKNOWN',
        attributes,
        textContent: node.nodeValue || undefined,
        boundingBox,
        isVisible: boundingBox.width > 0 && boundingBox.height > 0,
        isInViewport: this.isInViewport(boundingBox),
        xpath,
        cssPath: this.generateCssPath(node, attributes),
        role: attributes['role'],
        name: attributes['aria-label'] || attributes['name'],
      };
    } catch (error) {
      console.error('[SnapshotService] getElementByBackendNodeId error:', error);
      return null;
    }
  }

  /**
   * DOM 스냅샷 데이터 처리
   */
  private async processSnapshotData(snapshotData: any): Promise<ElementSnapshot[]> {
    const elements: ElementSnapshot[] = [];
    const { documents, strings } = snapshotData;

    if (!documents || documents.length === 0) return elements;

    const doc = documents[0];
    const nodes = doc.nodes;

    // 클릭 가능한 요소만 필터링
    const clickableTags = new Set([
      'A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA',
      'LABEL', 'SUMMARY', 'DETAILS'
    ]);

    for (let i = 0; i < (nodes.backendNodeId?.length || 0); i++) {
      const backendNodeId = nodes.backendNodeId[i];
      const nodeNameIndex = nodes.nodeName?.[i];
      const nodeName = nodeNameIndex !== undefined ? strings[nodeNameIndex] : '';

      // 클릭 가능하거나 role이 있는 요소만 처리
      if (clickableTags.has(nodeName.toUpperCase())) {
        const element = await this.getElementByBackendNodeId(backendNodeId);
        if (element && element.isVisible) {
          elements.push(element);
        }
      }
    }

    return elements;
  }

  /**
   * 노드에서 XPath 생성
   */
  private generateXPathFromNode(node: any, attributes: Record<string, string>): string {
    if (attributes['id']) {
      return `//*[@id="${attributes['id']}"]`;
    }

    // 기본 XPath 생성
    const tagName = (node.nodeName || 'div').toLowerCase();
    return `//${tagName}`;
  }

  /**
   * CSS 경로 생성
   */
  private generateCssPath(node: any, attributes: Record<string, string>): string {
    const tagName = (node.nodeName || 'div').toLowerCase();

    if (attributes['id']) {
      return `#${attributes['id']}`;
    }

    if (attributes['data-testid']) {
      return `[data-testid="${attributes['data-testid']}"]`;
    }

    if (attributes['class']) {
      const classes = attributes['class'].split(' ').filter((c: string) => c.trim()).slice(0, 2);
      if (classes.length) {
        return `${tagName}.${classes.join('.')}`;
      }
    }

    return tagName;
  }

  /**
   * 뷰포트 내 여부 확인
   */
  private isInViewport(box: BoundingBox): boolean {
    const viewport = this.page?.viewportSize() || { width: 1920, height: 1080 };
    return (
      box.x >= -100 &&
      box.y >= -100 &&
      box.x < viewport.width + 100 &&
      box.y < viewport.height + 100
    );
  }

  /**
   * 정리
   */
  async cleanup(): Promise<void> {
    if (this.cdpSession) {
      try {
        await this.cdpSession.detach();
      } catch {
        // 이미 분리됨
      }
      this.cdpSession = null;
    }
    this.page = null;
  }
}
