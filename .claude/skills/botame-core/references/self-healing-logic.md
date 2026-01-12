# Self-Healing Logic Reference

## 개요
플레이북 실행 중 셀렉터 실패 시 자동으로 대체 셀렉터를 탐색하는 로직.

## 고침 플로우

```
┌─────────────────┐
│ Primary 셀렉터  │
│     시도        │
└────────┬────────┘
         │ 실패
         ▼
┌─────────────────┐
│ Fallback 배열   │
│   순차 시도     │
└────────┬────────┘
         │ 모두 실패
         ▼
┌─────────────────┐
│ 동적 텍스트     │
│    탐색         │
└────────┬────────┘
         │ 실패
         ▼
┌─────────────────┐
│ 수동 고침 UI    │
│   (사용자 선택) │
└─────────────────┘
```

## healMethod 타입

| Method | 설명 | 신뢰도 |
|--------|------|--------|
| `fallback` | fallback 배열에서 성공 | 높음 |
| `text` | 텍스트 매칭으로 발견 | 중간 |
| `aria` | ARIA 라벨 매칭으로 발견 | 중간 |
| `dynamic` | step.message에서 키워드 추출 후 매칭 | 낮음 |
| `manual` | 사용자가 직접 선택 | 확정 |

## 동적 탐색 알고리즘

1. `step.message`에서 키워드 추출
   - 명사, 동사 추출
   - 불용어 제거

2. 키워드로 요소 탐색
   ```typescript
   // 텍스트 매칭
   page.locator(`text=${keyword}`);
   
   // ARIA 매칭
   page.locator(`[aria-label*="${keyword}"]`);
   
   // role + name
   page.getByRole('button', { name: keyword });
   ```

3. 후보 요소 점수 계산
   - 텍스트 일치도
   - 위치 (viewport 내)
   - 가시성

## 코드 위치

```typescript
// electron/core/self-healing.ts

export async function healSelector(
  page: Page,
  step: PlaybookStep,
  originalSelector: string
): Promise<HealResult> {
  // 1. Fallback 시도
  for (const fallback of step.selector.fallback) {
    try {
      await page.locator(fallback).waitFor({ timeout: 3000 });
      return { success: true, selector: fallback, method: 'fallback' };
    } catch {}
  }
  
  // 2. 동적 탐색
  const keywords = extractKeywords(step.message);
  for (const keyword of keywords) {
    // ... 탐색 로직
  }
  
  // 3. 수동 고침 요청
  return { success: false, method: 'manual' };
}
```

## StepResult 구조

```typescript
interface StepResult {
  stepId: string;
  stepIndex: number;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  message?: string;
  error?: string;
  duration?: number;
  screenshot?: string;
  // 자동 고침 결과
  healed?: boolean;
  healedSelector?: string;
  originalSelector?: string;
  healMethod?: 'fallback' | 'text' | 'aria' | 'dynamic' | 'manual';
}
```

## 고침 결과 저장

성공한 고침은 플레이북에 피드백:
- 새 셀렉터를 fallback 배열 앞에 추가
- 실패 횟수가 높은 셀렉터는 우선순위 하락
