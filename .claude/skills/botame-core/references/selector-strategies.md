# Selector Strategies Reference

## 개요
견고한 SmartSelector 작성을 위한 전략 가이드.

## 셀렉터 우선순위

| 순위 | 전략 | 예시 | 안정성 |
|------|------|------|--------|
| 1 | data-testid | `[data-testid="save-btn"]` | ⭐⭐⭐⭐⭐ |
| 2 | role + name | `role=button[name="저장"]` | ⭐⭐⭐⭐ |
| 3 | aria-label | `[aria-label="저장하기"]` | ⭐⭐⭐⭐ |
| 4 | text content | `text=저장` | ⭐⭐⭐ |
| 5 | CSS class (의미있는) | `.btn-save` | ⭐⭐⭐ |
| 6 | CSS 조합 | `.modal-footer button.primary` | ⭐⭐ |
| 7 | XPath | `//button[contains(text(),'저장')]` | ⭐ |

## SmartSelector 구조

```typescript
interface SmartSelector {
  primary: string;      // 가장 신뢰할 수 있는 셀렉터
  fallback: string[];   // 대체 셀렉터 (최소 3개)
  metadata?: {
    text?: string;      // 요소의 텍스트 (동적 탐색용)
    ariaLabel?: string; // ARIA 라벨
    role?: string;      // 역할 (button, link 등)
  };
}
```

## 좋은 예시

### 버튼 셀렉터

```typescript
{
  primary: '[data-testid="submit-form"]',
  fallback: [
    'role=button[name="제출"]',
    'button:has-text("제출")',
    '.form-actions button[type="submit"]'
  ],
  metadata: { text: '제출', role: 'button' }
}
```

### 입력 필드 셀렉터

```typescript
{
  primary: '[data-testid="email-input"]',
  fallback: [
    'input[name="email"]',
    'input[type="email"]',
    '[aria-label="이메일 주소"]'
  ],
  metadata: { ariaLabel: '이메일 주소' }
}
```

### 테이블 행 셀렉터

```typescript
{
  primary: 'tr[data-id="12345"]',
  fallback: [
    'tr:has-text("홍길동")',
    'table tbody tr:nth-child(3)',
    '//tr[contains(.,"홍길동")]'
  ],
  metadata: { text: '홍길동' }
}
```

## losims 특화 전략

### Frame 컨텍스트 처리

losims는 iframe 구조. 반드시 frame 지정 필요.

```typescript
// ❌ 잘못된 방법
await page.click('#btn_search');

// ✅ 올바른 방법
const mainFrame = page.frameLocator('#mainFrame');
await mainFrame.locator('#btn_search').click();
```

### 동적 ID 회피

losims는 동적 ID를 자주 사용.

```typescript
// ❌ 동적 ID (변경됨)
'#btn_12345'

// ✅ 텍스트 기반
'button:has-text("조회")'

// ✅ 클래스 + 컨텍스트
'.search-area button.btn_search'
```

### 그리드 요소

```typescript
// 그리드 내 특정 행
{
  primary: 'tr:has-text("2024-001")',
  fallback: [
    '.grid_area tr:has(td:text("2024-001"))',
    '//tr[td[contains(text(),"2024-001")]]'
  ],
  metadata: { text: '2024-001' }
}
```

### 팝업/모달

```typescript
// 팝업 내 버튼
{
  primary: '.layer_popup button:has-text("확인")',
  fallback: [
    '.modal-content button.btn_confirm',
    '[role="dialog"] button:has-text("확인")'
  ],
  metadata: { text: '확인' }
}
```

## 안티 패턴

### ❌ 피해야 할 것들

```typescript
// 1. 동적 ID
'#element_1736582400000'

// 2. 깊은 CSS 경로
'div > div > div > ul > li:nth-child(2) > a'

// 3. 스타일 기반
'[style="color: red"]'

// 4. 인덱스만 사용
'button:nth-child(3)'

// 5. 빈 fallback
{ primary: '#btn', fallback: [] }
```

## 테스트 방법

셀렉터 작성 후 검증:

```typescript
// 1. 존재 확인
await expect(page.locator(selector)).toBeVisible();

// 2. 고유성 확인
const count = await page.locator(selector).count();
expect(count).toBe(1);

// 3. Fallback 검증
for (const fallback of smartSelector.fallback) {
  await expect(page.locator(fallback)).toBeVisible();
}
```
