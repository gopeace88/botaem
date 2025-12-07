# CDP-First Semantic Recording v3

> 2025-12-05 | 보탬e 녹화/재생 정확도 개선

## 문제 정의

현재 녹화 시 요소 식별 실패의 근본 원인:

1. **JS 이벤트 캡처의 한계**: `e.target`이 실제 클릭한 요소가 아닐 수 있음 (이벤트 버블링)
2. **CSS 선택자 불안정성**: 동적 클래스, 중복 구조에서 고유하지 않은 선택자 생성
3. **시맨틱 정보 부족**: Accessibility Tree의 `role + name` 정보를 충분히 활용하지 않음

## 해결 방향

### 핵심 원칙: "CDP가 정확한 요소를 찾고, Accessibility가 식별자를 제공"

```
녹화 흐름:
┌─────────────────────────────────────────────────────────────┐
│  1. 클릭 이벤트 발생 → (x, y) 좌표 캡처                      │
│  2. CDP DOM.getNodeForLocation(x, y) → backendNodeId        │
│  3. CDP Accessibility.getPartialAXTree → role, name         │
│  4. CDP DOM.describeNode → attributes, textContent          │
│  5. 다중 식별자 생성 및 저장                                 │
└─────────────────────────────────────────────────────────────┘

재생 흐름:
┌─────────────────────────────────────────────────────────────┐
│  1. getByRole(role, { name }) 시도 (가장 안정적)             │
│  2. aria-label 기반 CSS 선택자 시도                          │
│  3. Fallback 선택자들 순차 시도                              │
│  4. Visual similarity 매칭 (스냅샷 비교)                     │
│  5. 좌표 기반 클릭 (최후 수단)                               │
└─────────────────────────────────────────────────────────────┘
```

## 구현 계획

### Task 1: CDP Accessibility Service 신규 생성

**파일**: `electron/core/accessibility.service.ts`

```typescript
interface AccessibilityInfo {
  role: string;        // "button", "textbox", "link", "tab", etc.
  name: string;        // Accessible name (computed)
  description?: string;
  value?: string;
  checked?: boolean;
  selected?: boolean;
  expanded?: boolean;

  // DOM 연결 정보
  backendNodeId: number;
  boundingBox: BoundingBox;
}

class AccessibilityService {
  // CDP Accessibility 도메인 활성화
  async initialize(page: Page): Promise<void>;

  // 좌표로 Accessibility 노드 찾기
  async getAccessibilityInfoAtPoint(x: number, y: number): Promise<AccessibilityInfo | null>;

  // backendNodeId로 Accessibility 정보 가져오기
  async getAccessibilityInfo(backendNodeId: number): Promise<AccessibilityInfo | null>;

  // 현재 페이지의 모든 인터랙티브 요소 스캔
  async scanInteractiveElements(): Promise<AccessibilityInfo[]>;
}
```

**CDP 명령 사용:**
- `Accessibility.enable`
- `Accessibility.getPartialAXTree({ backendNodeId, fetchRelatives: false })`
- `Accessibility.queryAXTree({ accessibleName, role })` - 재생 시 매칭에 사용

### Task 2: ElementIdentity 타입 확장

**파일**: `shared/types.ts` 수정

```typescript
/**
 * CDP 기반 요소 식별자 (v3)
 */
export interface ElementIdentity {
  // === 1순위: Accessibility 기반 (가장 안정적) ===
  axRole?: string;           // "button", "textbox", "link"
  axName?: string;           // "로그인", "아이디 입력"

  // === 2순위: 시맨틱 속성 ===
  ariaLabel?: string;
  dataTestId?: string;
  name?: string;             // form elements

  // === 3순위: 구조적 속성 ===
  tagName: string;
  type?: string;             // input type
  placeholder?: string;

  // === 4순위: 시각적 특성 ===
  boundingBox: BoundingBox;
  visualHash?: string;       // 색상, 크기 기반 해시

  // === 메타데이터 ===
  backendNodeId: number;
  textContent?: string;
  capturedAt: number;
}

/**
 * 확장된 SemanticStep (v3)
 */
export interface SemanticStepV3 extends PlaybookStep {
  identity: ElementIdentity;           // 새로운 식별 시스템
  smartSelector?: SmartSelector;       // 하위 호환
  healingHistory?: HealingRecord[];
}
```

### Task 3: Recording Service 리팩토링

**파일**: `electron/services/recording.service.ts` 수정

핵심 변경:

1. **클릭 캡처 개선**: JS에서 좌표만 캡처, CDP에서 정확한 요소 조회
2. **Accessibility 정보 우선 수집**
3. **ElementIdentity 형식으로 저장**

```typescript
private async handleRecordedAction(action: RecordedAction): Promise<void> {
  // 1. CDP로 정확한 요소 찾기
  const identity = await this.captureElementIdentity(action.clickX, action.clickY);

  // 2. SemanticStepV3 생성
  const step: SemanticStepV3 = {
    id: `step${this.stepCounter}`,
    action: action.type,
    identity,
    // ...
  };

  // 3. 하위 호환용 smartSelector도 생성
  step.smartSelector = this.convertIdentityToSmartSelector(identity);

  this.recordedSteps.push(step);
}

private async captureElementIdentity(x: number, y: number): Promise<ElementIdentity> {
  // 1. CDP로 정확한 노드 찾기
  const { backendNodeId } = await this.cdp.send('DOM.getNodeForLocation', { x, y });

  // 2. Accessibility 정보 가져오기 (핵심!)
  const axInfo = await this.accessibilityService.getAccessibilityInfo(backendNodeId);

  // 3. DOM 속성 가져오기
  const { node } = await this.cdp.send('DOM.describeNode', { backendNodeId, depth: 0 });

  // 4. 바운딩 박스
  const boxModel = await this.cdp.send('DOM.getBoxModel', { backendNodeId });

  return {
    axRole: axInfo?.role,
    axName: axInfo?.name,
    ariaLabel: node.attributes?.['aria-label'],
    // ...
  };
}
```

### Task 4: Replay Matcher 개선

**파일**: `electron/core/self-healing.ts` 수정

새로운 매칭 전략:

```typescript
async findElement(step: SemanticStepV3): Promise<HealingResult> {
  const { identity } = step;

  // 1순위: Playwright getByRole (가장 안정적)
  if (identity.axRole && identity.axName) {
    const locator = this.page.getByRole(identity.axRole, { name: identity.axName });
    if (await locator.count() === 1) {
      return { success: true, locator, usedStrategy: 'accessibility' };
    }
  }

  // 2순위: aria-label 매칭
  if (identity.ariaLabel) {
    const locator = this.page.locator(`[aria-label="${identity.ariaLabel}"]`);
    if (await locator.count() === 1) {
      return { success: true, locator, usedStrategy: 'ariaLabel' };
    }
  }

  // 3순위: form element name
  if (identity.name && this.isFormElement(identity.tagName)) {
    const locator = this.page.locator(`${identity.tagName}[name="${identity.name}"]`);
    if (await locator.count() === 1) {
      return { success: true, locator, usedStrategy: 'name' };
    }
  }

  // 4순위: 기존 smartSelector 폴백
  // ...

  // 5순위: Visual similarity
  // ...

  // 6순위: 좌표 기반
  // ...
}
```

### Task 5: Injected Script 단순화

**현재 문제**: 복잡한 `generateSelector()` 로직이 브라우저에서 실행되어 부정확

**해결**: 좌표만 캡처하고, 모든 분석은 CDP/Node.js에서 수행

```javascript
// 기존: 복잡한 셀렉터 생성
document.addEventListener('click', (e) => {
  const action = {
    type: 'click',
    selector: generateSelector(e.target),  // 부정확할 수 있음
    elementInfo: getElementInfo(e.target), // 부정확할 수 있음
    clickX: e.clientX,
    clickY: e.clientY,
  };
  window.__botameRecordAction?.(action);
});

// 개선: 좌표만 캡처
document.addEventListener('click', (e) => {
  const action = {
    type: 'click',
    clickX: e.clientX,
    clickY: e.clientY,
    timestamp: Date.now(),
    // selector, elementInfo는 CDP에서 정확하게 가져옴
  };
  window.__botameRecordAction?.(action);
});
```

## 파일 변경 목록

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `electron/core/accessibility.service.ts` | 신규 | CDP Accessibility 서비스 |
| `shared/types.ts` | 수정 | ElementIdentity 타입 추가 |
| `electron/services/recording.service.ts` | 수정 | CDP 기반 캡처로 전환 |
| `electron/core/self-healing.ts` | 수정 | Accessibility 기반 매칭 추가 |
| `electron/core/snapshot.service.ts` | 수정 | Accessibility 통합 |

## 테스트 계획

1. **녹화 정확도 테스트**
   - 중첩된 요소 클릭 (버튼 내 아이콘)
   - 동적 클래스를 가진 요소
   - Shadow DOM 내부 요소
   - iframe 내부 요소

2. **재생 매칭 테스트**
   - DOM 구조 변경 후 재생
   - 클래스 변경 후 재생
   - 요소 위치 변경 후 재생

3. **하위 호환성 테스트**
   - 기존 플레이북 파일 재생
   - smartSelector 없는 레거시 스텝 처리

## 구현 순서

1. ✅ 설계 문서 작성
2. ✅ AccessibilityService 구현 (`electron/core/accessibility.service.ts`)
3. ✅ types.ts에 ElementIdentity 추가 (`shared/types.ts`)
4. ✅ RecordingService 리팩토링 (`electron/services/recording.service.ts`)
5. ✅ SelfHealingEngine 개선 (`electron/core/self-healing.ts`)
6. ⬜ 통합 테스트
7. ⬜ 기존 플레이북 마이그레이션 (필요 시)

## 변경된 파일 요약

### 신규 파일
- `electron/core/accessibility.service.ts` - CDP Accessibility Tree 기반 요소 식별

### 수정된 파일
- `shared/types.ts` - ElementIdentity, SemanticStepV3, MatchingStrategy 타입 추가
- `electron/services/recording.service.ts` - v3 captureElementIdentity 메서드 추가
- `electron/core/self-healing.ts` - v3 findByIdentity 메서드 추가
- `electron/core/index.ts` - AccessibilityService export 추가

## 핵심 변경 사항

### 1. 녹화 시점 (recording.service.ts)
```
기존: JS 이벤트 → e.target → generateSelector()
v3:   JS 이벤트 → (x,y) 좌표 → CDP Accessibility → ElementIdentity
```

### 2. 재생 시점 (self-healing.ts)
```
기존: CSS 선택자 → fallback 선택자 → 좌표
v3:   getByRole(role, name) → aria-label → name → testId → ... → visual → 좌표
```

### 3. 하위 호환성
- SemanticStepV3는 기존 smartSelector도 유지
- 기존 플레이북은 그대로 동작
- v3 identity가 있으면 우선 사용, 없으면 v2 로직 사용
