/**
 * Accessibility Service - CDP Accessibility Tree 기반 요소 식별
 *
 * 핵심 원칙: Accessibility Tree의 role + name은 DOM 구조 변경에도 안정적
 *
 * browser-use/Skyvern의 접근법을 참고하되,
 * 녹화/재생 워크플로우에 최적화된 구현
 */

import { Page, CDPSession } from 'playwright';
import { BoundingBox } from '../../shared/types';

/**
 * Accessibility 노드 정보
 */
export interface AccessibilityInfo {
  // === 핵심 식별 정보 ===
  role: string;           // "button", "textbox", "link", "tab", "menuitem", etc.
  name: string;           // Computed accessible name
  description?: string;   // Accessible description

  // === 상태 정보 ===
  value?: string;         // 입력 필드의 값
  checked?: 'true' | 'false' | 'mixed';
  selected?: boolean;
  expanded?: boolean;
  disabled?: boolean;
  focused?: boolean;

  // === DOM 연결 정보 ===
  backendNodeId: number;
  nodeId?: number;
  boundingBox: BoundingBox;

  // === 계층 정보 ===
  parentRole?: string;
  parentName?: string;
  level?: number;         // heading level, tree item level
}

/**
 * CDP Accessibility 응답 타입
 */
interface AXNode {
  nodeId: string;
  ignored?: boolean;
  role?: { type: string; value: string };
  name?: { type: string; value: string; sources?: any[] };
  description?: { type: string; value: string };
  value?: { type: string; value: any };
  properties?: Array<{ name: string; value: { type: string; value: any } }>;
  childIds?: string[];
  backendDOMNodeId?: number;
}

export class AccessibilityService {
  private cdpSession: CDPSession | null = null;
  private page: Page | null = null;
  private isInitialized = false;

  /**
   * CDP Accessibility 도메인 초기화
   */
  async initialize(page: Page): Promise<void> {
    if (this.isInitialized && this.page === page) {
      return;
    }

    this.page = page;
    this.cdpSession = await page.context().newCDPSession(page);

    // Accessibility 도메인 활성화
    await this.cdpSession.send('Accessibility.enable');
    await this.cdpSession.send('DOM.enable');

    this.isInitialized = true;
    console.log('[AccessibilityService] Initialized');
  }

  /**
   * 좌표로 Accessibility 정보 가져오기
   * 녹화 시 클릭 좌표에서 정확한 요소의 role + name 획득
   */
  async getAccessibilityInfoAtPoint(x: number, y: number): Promise<AccessibilityInfo | null> {
    if (!this.cdpSession || !this.page) {
      console.error('[AccessibilityService] Not initialized');
      return null;
    }

    try {
      // 1. CDP로 해당 좌표의 정확한 노드 찾기
      const nodeResult = await this.cdpSession.send('DOM.getNodeForLocation', {
        x: Math.round(x),
        y: Math.round(y),
        includeUserAgentShadowDOM: false,
        ignorePointerEventsNone: true,
      });

      if (!nodeResult.backendNodeId) {
        console.log(`[AccessibilityService] No node found at (${x}, ${y})`);
        return null;
      }

      // 2. Accessibility 정보 가져오기
      const info = await this.getAccessibilityInfo(nodeResult.backendNodeId);

      // 3. generic role이면 JavaScript로 클릭 가능한 요소 찾기
      if (info && (info.role === 'generic' || info.role === 'none' || !info.name)) {
        console.log('[AccessibilityService] Generic role detected, trying JS element search...');
        const jsInfo = await this.findClickableElementViaJS(x, y);
        if (jsInfo) {
          return jsInfo;
        }
      }

      return info;
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      // 네비게이션 중 오류는 조용히 처리
      if (!msg.includes('context was destroyed') && !msg.includes('navigation')) {
        console.error('[AccessibilityService] Error at point:', error);
      }
      return null;
    }
  }

  /**
   * JavaScript로 클릭 가능한 요소 찾기
   * CDP가 정확한 요소를 반환하지 못할 때 폴백으로 사용
   */
  private async findClickableElementViaJS(x: number, y: number): Promise<AccessibilityInfo | null> {
    if (!this.page || !this.cdpSession) return null;

    try {
      // 브라우저에서 직접 요소 찾기
      const elementInfo = await this.page.evaluate(({ x, y }) => {
        // 해당 좌표에서 모든 요소 가져오기 (z-index 순)
        const elements = document.elementsFromPoint(x, y);

        // 클릭 가능한 요소 타입들
        const clickableTags = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA']);
        const clickableRoles = new Set([
          'button', 'link', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio',
          'option', 'radio', 'checkbox', 'switch', 'treeitem', 'combobox', 'listbox',
        ]);
        // 탭 관련 클래스 (보탬e 특화)
        const tabClasses = ['cl-tabfolder-item', 'tab-item', 'tab-button'];

        for (const el of elements) {
          const tagName = el.tagName;
          const role = el.getAttribute('role');
          const ariaLabel = el.getAttribute('aria-label');
          const textContent = el.textContent?.trim() || '';
          const className = el.className || '';

          // 1. 표준 클릭 가능한 요소 찾기
          if (clickableTags.has(tagName) || (role && clickableRoles.has(role))) {
            const rect = el.getBoundingClientRect();

            // 텍스트 내용 또는 aria-label에서 이름 추출
            let name = ariaLabel || '';
            if (!name && textContent.length > 0 && textContent.length < 50) {
              name = textContent;
            }

            return {
              role: role || tagName.toLowerCase(),
              name,
              tagName,
              ariaLabel,
              boundingBox: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
              },
            };
          }

          // 2. 탭 관련 클래스를 가진 요소 (비표준 탭 컴포넌트)
          const isTabLike = tabClasses.some(tc => className.includes(tc));
          if (isTabLike && textContent && textContent.length < 50) {
            const rect = el.getBoundingClientRect();
            return {
              role: 'tab',
              name: ariaLabel || textContent,
              tagName,
              ariaLabel,
              boundingBox: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
              },
            };
          }

          // 3. cursor: pointer 스타일인 요소도 클릭 가능할 수 있음
          const cursor = window.getComputedStyle(el).cursor;
          if (cursor === 'pointer' && textContent && textContent.length < 30) {
            const rect = el.getBoundingClientRect();
            return {
              role: role || 'button',
              name: el.getAttribute('aria-label') || textContent,
              tagName,
              ariaLabel: el.getAttribute('aria-label'),
              boundingBox: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
              },
            };
          }
        }

        return null;
      }, { x, y });

      if (elementInfo) {
        console.log(`[AccessibilityService] JS found: role="${elementInfo.role}", name="${elementInfo.name}"`);

        // backendNodeId를 얻기 위해 해당 요소 선택
        let backendNodeId = 0;
        try {
          // 좌표로 다시 조회 (JS가 찾은 요소의 위치 사용)
          const centerX = elementInfo.boundingBox.x + elementInfo.boundingBox.width / 2;
          const centerY = elementInfo.boundingBox.y + elementInfo.boundingBox.height / 2;
          const nodeResult = await this.cdpSession.send('DOM.getNodeForLocation', {
            x: Math.round(centerX),
            y: Math.round(centerY),
          });
          backendNodeId = nodeResult.backendNodeId || 0;
        } catch {
          // 무시
        }

        return {
          role: elementInfo.role,
          name: elementInfo.name,
          backendNodeId,
          boundingBox: elementInfo.boundingBox,
        };
      }
    } catch (error) {
      console.error('[AccessibilityService] JS element search error:', error);
    }

    return null;
  }

  /**
   * backendNodeId로 Accessibility 정보 가져오기
   * generic/none role인 경우 클릭 가능한 부모를 탐색
   */
  async getAccessibilityInfo(backendNodeId: number): Promise<AccessibilityInfo | null> {
    if (!this.cdpSession) return null;

    try {
      // 1. Accessibility Tree에서 노드 정보 가져오기
      const axResult = await this.cdpSession.send('Accessibility.getPartialAXTree', {
        backendNodeId,
        fetchRelatives: true,  // 부모 정보도 가져오기
      });

      const nodes = axResult.nodes as AXNode[];
      if (!nodes || nodes.length === 0) {
        return null;
      }

      // 2. 현재 노드 찾기 (backendNodeId 매칭)
      let targetNode = nodes.find(n => n.backendDOMNodeId === backendNodeId);

      // 매칭되지 않으면 첫 번째 비-무시 노드 사용
      if (!targetNode) {
        targetNode = nodes.find(n => !n.ignored && n.role?.value && n.role.value !== 'none');
      }

      // 3. generic/none role이거나 name이 없으면 클릭 가능한 부모 찾기
      if (targetNode && this.isGenericOrEmpty(targetNode)) {
        // 3-1. 먼저 Accessibility Tree에서 부모 찾기
        let clickableParent = this.findClickableParent(nodes, targetNode);

        // 3-2. Accessibility Tree에서 못 찾으면 DOM 트리 탐색
        if (!clickableParent) {
          console.log('[AccessibilityService] No clickable parent in AX tree, traversing DOM...');
          clickableParent = await this.findClickableParentViaDOM(backendNodeId);
        }

        if (clickableParent) {
          console.log(`[AccessibilityService] Found clickable parent: role="${clickableParent.role?.value}", name="${clickableParent.name?.value}"`);
          targetNode = clickableParent;
          // 부모의 backendNodeId 사용
          if (clickableParent.backendDOMNodeId) {
            backendNodeId = clickableParent.backendDOMNodeId;
          }
        }
      }

      if (!targetNode || targetNode.ignored) {
        // ignored 노드면 부모 중 유효한 노드 찾기
        const validParent = this.findValidParentNode(nodes, targetNode);
        if (validParent) {
          targetNode = validParent;
        } else {
          return null;
        }
      }

      // 3. 바운딩 박스 가져오기
      let boundingBox: BoundingBox = { x: 0, y: 0, width: 0, height: 0 };
      try {
        const boxModel = await this.cdpSession.send('DOM.getBoxModel', { backendNodeId });
        if (boxModel.model?.content) {
          const c = boxModel.model.content;
          boundingBox = {
            x: c[0],
            y: c[1],
            width: c[2] - c[0],
            height: c[5] - c[1],
          };
        }
      } catch {
        // 숨겨진 요소 등
      }

      // 4. 부모 정보 추출
      const parentNode = this.findParentNode(nodes, targetNode);

      // 5. AccessibilityInfo 구성
      const info: AccessibilityInfo = {
        role: targetNode.role?.value || 'generic',
        name: this.extractName(targetNode),
        description: targetNode.description?.value,
        backendNodeId,
        boundingBox,
      };

      // 상태 속성 추출
      if (targetNode.properties) {
        for (const prop of targetNode.properties) {
          switch (prop.name) {
            case 'checked':
              info.checked = prop.value.value;
              break;
            case 'selected':
              info.selected = prop.value.value === true;
              break;
            case 'expanded':
              info.expanded = prop.value.value === true;
              break;
            case 'disabled':
              info.disabled = prop.value.value === true;
              break;
            case 'focused':
              info.focused = prop.value.value === true;
              break;
            case 'level':
              info.level = prop.value.value;
              break;
          }
        }
      }

      // 값 추출 (입력 필드)
      if (targetNode.value?.value !== undefined) {
        info.value = String(targetNode.value.value);
      }

      // 부모 정보
      if (parentNode) {
        info.parentRole = parentNode.role?.value;
        info.parentName = this.extractName(parentNode);
      }

      console.log(`[AccessibilityService] Found: role="${info.role}", name="${info.name}"`);
      return info;
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      if (!msg.includes('context was destroyed')) {
        console.error('[AccessibilityService] Error getting info:', error);
      }
      return null;
    }
  }

  /**
   * 현재 페이지의 모든 인터랙티브 요소 스캔
   * 재생 시 Visual similarity 매칭에 사용
   */
  async scanInteractiveElements(): Promise<AccessibilityInfo[]> {
    if (!this.cdpSession || !this.page) return [];

    try {
      // 전체 Accessibility Tree 가져오기
      const fullTree = await this.cdpSession.send('Accessibility.getFullAXTree', {
        depth: 10,  // 적절한 깊이
      });

      const nodes = fullTree.nodes as AXNode[];
      const interactiveRoles = new Set([
        'button', 'link', 'textbox', 'checkbox', 'radio',
        'tab', 'menuitem', 'option', 'combobox', 'listbox',
        'searchbox', 'slider', 'spinbutton', 'switch',
        'treeitem', 'gridcell', 'row',
      ]);

      const results: AccessibilityInfo[] = [];

      for (const node of nodes) {
        if (node.ignored || !node.role?.value) continue;

        const role = node.role.value;
        if (!interactiveRoles.has(role)) continue;

        const backendNodeId = node.backendDOMNodeId;
        if (!backendNodeId) continue;

        // 바운딩 박스 가져오기
        let boundingBox: BoundingBox = { x: 0, y: 0, width: 0, height: 0 };
        try {
          const boxModel = await this.cdpSession.send('DOM.getBoxModel', { backendNodeId });
          if (boxModel.model?.content) {
            const c = boxModel.model.content;
            boundingBox = {
              x: c[0],
              y: c[1],
              width: c[2] - c[0],
              height: c[5] - c[1],
            };
          }
        } catch {
          continue;  // 보이지 않는 요소 스킵
        }

        // 보이지 않는 요소 스킵
        if (boundingBox.width <= 0 || boundingBox.height <= 0) continue;

        results.push({
          role,
          name: this.extractName(node),
          description: node.description?.value,
          backendNodeId,
          boundingBox,
        });
      }

      console.log(`[AccessibilityService] Scanned ${results.length} interactive elements`);
      return results;
    } catch (error) {
      console.error('[AccessibilityService] Scan error:', error);
      return [];
    }
  }

  /**
   * role + name으로 요소 쿼리
   * 재생 시 Accessibility 기반 매칭에 사용
   */
  async queryByRoleAndName(role: string, name: string): Promise<AccessibilityInfo | null> {
    if (!this.cdpSession) return null;

    try {
      // CDP queryAXTree 사용
      const result = await this.cdpSession.send('Accessibility.queryAXTree', {
        accessibleName: name,
        role,
      });

      const nodes = result.nodes as AXNode[];
      if (!nodes || nodes.length === 0) return null;

      // 첫 번째 매칭 반환
      const node = nodes.find(n => !n.ignored);
      if (!node || !node.backendDOMNodeId) return null;

      return this.getAccessibilityInfo(node.backendDOMNodeId);
    } catch (error) {
      console.error('[AccessibilityService] Query error:', error);
      return null;
    }
  }

  /**
   * Accessible name 추출 (동적 상태 제거)
   */
  private extractName(node: AXNode): string {
    if (!node.name?.value) return '';

    let name = node.name.value;

    // 동적 상태 텍스트 제거
    // 예: "아이디 로그인, 선택됨" -> "아이디 로그인"
    const dynamicPatterns = [
      /, 선택됨$/,
      /, 선택되지 않음$/,
      /, 확장됨$/,
      /, 축소됨$/,
      /, expanded$/i,
      /, collapsed$/i,
      /, selected$/i,
      /, pressed$/i,
      /, checked$/i,
    ];

    for (const pattern of dynamicPatterns) {
      name = name.replace(pattern, '');
    }

    return name.trim();
  }

  /**
   * ignored 노드의 유효한 부모 찾기
   */
  private findValidParentNode(nodes: AXNode[], current?: AXNode): AXNode | null {
    if (!current) return null;

    // nodes 배열에서 현재 노드의 인덱스 찾기
    const currentIndex = nodes.findIndex(n => n.nodeId === current.nodeId);
    if (currentIndex < 0) return null;

    // 이전 노드들 중 유효한 것 찾기 (부모는 보통 이전에 나옴)
    for (let i = currentIndex - 1; i >= 0; i--) {
      const node = nodes[i];
      if (!node.ignored && node.role?.value && node.role.value !== 'none' && node.role.value !== 'generic') {
        // childIds에 현재 노드가 있는지 확인
        if (node.childIds?.includes(current.nodeId)) {
          return node;
        }
      }
    }

    return null;
  }

  /**
   * 부모 노드 찾기
   */
  private findParentNode(nodes: AXNode[], current: AXNode): AXNode | null {
    for (const node of nodes) {
      if (node.childIds?.includes(current.nodeId)) {
        return node;
      }
    }
    return null;
  }

  /**
   * generic/none role이거나 name이 비어있는지 확인
   */
  private isGenericOrEmpty(node: AXNode): boolean {
    const role = node.role?.value;

    // generic, none 또는 role이 없는 경우
    if (!role || role === 'generic' || role === 'none') {
      return true;
    }

    // StaticText는 클릭 대상이 아님
    if (role === 'StaticText') {
      return true;
    }

    // 인터랙티브 role이지만 name이 비어있는 경우는 제외 (name 없어도 유효할 수 있음)
    return false;
  }

  /**
   * 클릭 가능한 부모 노드 찾기
   * nodes 배열에서 현재 노드의 부모 중 클릭 가능한 역할을 가진 노드를 찾음
   */
  private findClickableParent(nodes: AXNode[], current: AXNode): AXNode | null {
    const clickableRoles = new Set([
      'button', 'link', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio',
      'option', 'radio', 'checkbox', 'switch', 'treeitem', 'row', 'gridcell',
      'textbox', 'searchbox', 'combobox', 'listbox', 'slider', 'spinbutton',
    ]);

    // 부모 체인을 따라 올라가며 클릭 가능한 노드 찾기
    let currentNode: AXNode | undefined = current;
    const visited = new Set<string>();

    while (currentNode) {
      visited.add(currentNode.nodeId);

      // 부모 찾기
      const parent = this.findParentNode(nodes, currentNode);
      if (!parent || visited.has(parent.nodeId)) {
        break;
      }

      const parentRole = parent.role?.value;
      if (parentRole && clickableRoles.has(parentRole)) {
        // 클릭 가능한 부모 발견
        return parent;
      }

      currentNode = parent;
    }

    return null;
  }

  /**
   * DOM 트리를 직접 탐색하여 클릭 가능한 부모 찾기
   * Accessibility Tree에서 부모를 못 찾을 때 사용
   */
  private async findClickableParentViaDOM(backendNodeId: number): Promise<AXNode | null> {
    if (!this.cdpSession) return null;

    const clickableRoles = new Set([
      'button', 'link', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio',
      'option', 'radio', 'checkbox', 'switch', 'treeitem', 'row', 'gridcell',
      'textbox', 'searchbox', 'combobox', 'listbox', 'slider', 'spinbutton',
    ]);

    const clickableTags = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA']);
    // 탭 관련 클래스 (비표준 컴포넌트용)
    const tabClasses = ['cl-tabfolder-item', 'tab-item', 'tab-button', 'cl-button'];

    try {
      // DOM 트리에서 현재 요소 + 부모 체인 탐색 (최대 10레벨)
      // i=0은 현재 요소, i>0은 부모
      let currentBackendNodeId = backendNodeId;

      for (let i = 0; i < 10; i++) {
        // 현재 노드 정보 가져오기
        const { node } = await this.cdpSession.send('DOM.describeNode', {
          backendNodeId: currentBackendNodeId,
          depth: 0,
        });

        // 속성을 객체로 변환
        const attrs: Record<string, string> = {};
        if (node.attributes) {
          for (let j = 0; j < node.attributes.length; j += 2) {
            attrs[node.attributes[j]] = node.attributes[j + 1];
          }
        }

        const role = attrs['role'];
        const tagName = node.nodeName;
        const className = attrs['class'] || '';

        console.log(`[AccessibilityService] DOM traverse [${i}]: ${tagName}, role="${role}", class="${className?.substring(0, 30)}"`);

        // 탭 관련 클래스 확인
        const isTabLike = tabClasses.some(tc => className.includes(tc));
        // 버튼 관련 클래스 확인
        const isButtonLike = className.includes('cl-button') || className.includes('btn-login') || className.includes('btn-');

        // 클릭 가능한 요소인지 확인 (현재 요소 또는 부모)
        if ((role && clickableRoles.has(role)) || clickableTags.has(tagName) || isTabLike || isButtonLike) {
          console.log(`[AccessibilityService] Found clickable DOM element: ${tagName}, role="${role}"`);

          // 이 요소의 Accessibility 정보 가져오기
          const axResult = await this.cdpSession.send('Accessibility.getPartialAXTree', {
            backendNodeId: currentBackendNodeId,
            fetchRelatives: false,
          });

          const axNodes = axResult.nodes as AXNode[];
          const axNode = axNodes.find(n => n.backendDOMNodeId === currentBackendNodeId);

          if (axNode && !axNode.ignored) {
            return axNode;
          }

          // AX 노드가 없으면 가상 노드 생성
          // 클래스 기반으로 role 추론
          let inferredRole = role || tagName.toLowerCase();
          if (isTabLike) {
            inferredRole = 'tab';
          } else if (isButtonLike) {
            inferredRole = 'button';
          }

          return {
            nodeId: `dom-${currentBackendNodeId}`,
            role: { type: 'role', value: inferredRole },
            name: { type: 'computedString', value: attrs['aria-label'] || '' },
            backendDOMNodeId: currentBackendNodeId,
          } as AXNode;
        }

        // 부모 노드로 이동
        if (!node.parentId) {
          // parentId가 없으면 resolveNode로 시도
          const { object } = await this.cdpSession.send('DOM.resolveNode', {
            backendNodeId: currentBackendNodeId,
          });

          if (object.objectId) {
            const { result } = await this.cdpSession.send('Runtime.callFunctionOn', {
              objectId: object.objectId,
              functionDeclaration: 'function() { return this.parentElement; }',
              returnByValue: false,
            });

            if (result.objectId) {
              const { node: parentNode } = await this.cdpSession.send('DOM.describeNode', {
                objectId: result.objectId,
              });
              currentBackendNodeId = parentNode.backendNodeId;
              continue;
            }
          }
          break;
        }

        // nodeId로 부모 backendNodeId 가져오기
        const parentNodeId = node.parentId;
        try {
          const { node: parentNode } = await this.cdpSession.send('DOM.describeNode', {
            nodeId: parentNodeId,
          });
          currentBackendNodeId = parentNode.backendNodeId;
        } catch {
          break;
        }
      }
    } catch (error) {
      console.error('[AccessibilityService] DOM traversal error:', error);
    }

    return null;
  }

  /**
   * CDP 세션 교체 (페이지 네비게이션 후)
   */
  async refreshSession(): Promise<void> {
    if (!this.page) return;

    try {
      if (this.cdpSession) {
        await this.cdpSession.detach().catch(() => {});
      }

      this.cdpSession = await this.page.context().newCDPSession(this.page);
      await this.cdpSession.send('Accessibility.enable');
      await this.cdpSession.send('DOM.enable');

      console.log('[AccessibilityService] Session refreshed');
    } catch (error) {
      console.error('[AccessibilityService] Refresh error:', error);
    }
  }

  /**
   * 정리
   */
  async cleanup(): Promise<void> {
    if (this.cdpSession) {
      try {
        await this.cdpSession.send('Accessibility.disable');
        await this.cdpSession.detach();
      } catch {
        // 이미 분리됨
      }
      this.cdpSession = null;
    }
    this.page = null;
    this.isInitialized = false;
    console.log('[AccessibilityService] Cleaned up');
  }
}
