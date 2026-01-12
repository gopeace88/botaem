# 코드 스타일 및 컨벤션

## 파일/디렉토리 명명 규칙

- **컴포넌트**: PascalCase (예: `RunnerPanel.tsx`, `RecordingPanel.tsx`)
- **서비스**: kebab-case (예: `playbook-runner.service.ts`, `recording.service.ts`)
- **스토어**: kebab-case + `.store.ts` (예: `runner.store.ts`, `recording.store.ts`)
- **타입 파일**: `.types.ts` 또는 `types.ts`
- **테스트**: `__tests__/` 디렉토리 또는 `.test.ts`/`.spec.ts`

## TypeScript 스타일

### 타입 정의
- 인터페이스는 PascalCase: `interface StepResult`, `interface Playbook`
- 타입 별칭은 PascalCase: `type ActionType = 'click' | 'navigate'`
- Enum 대신 Union Type 사용 (예: `type Status = 'pending' | 'running' | 'success'`)

### 함수 명명
- **동사 + 명사**: `executeStep`, `loadPlaybook`, `startRecording`
- **핸들러**: `handleClick`, `handleSubmit`
- **이벤트 콜백**: `onStepComplete`, `onError`

### 변수 명명
- **camelCase**: `currentStep`, `isExecuting`, `healedSelector`
- **boolean**: `is`/`has`/`should` 접두사 (예: `isPaused`, `hasError`, `shouldRetry`)
- **private class member**: `private` 키워드 사용 (TS 표준)

## React 컴포넌트 스타일

### 함수형 컴포넌트 + Hooks
```typescript
export function RunnerPanel() {
  const { isExecuting, currentStep } = useRunnerStore();
  const [localState, setLocalState] = useState();

  useEffect(() => {
    // 사이드 이펙트
  }, []);

  const handleClick = () => {
    // 이벤트 핸들러
  };

  return (
    <div className="...">
      {/* JSX */}
    </div>
  );
}
```

### Zustand 스토어 패턴
```typescript
interface RunnerState {
  // 상태
  isExecuting: boolean;
  currentStep: number;
  
  // 액션
  startExecution: () => Promise<void>;
  stopExecution: () => void;
}

export const useRunnerStore = create<RunnerState>()((set, get) => ({
  isExecuting: false,
  currentStep: 0,
  
  startExecution: async () => {
    set({ isExecuting: true });
    // ...
  },
  
  stopExecution: () => {
    set({ isExecuting: false, currentStep: 0 });
  },
}));
```

## 서비스/IPC 패턴

### IPC 채널 명명
- `domain:action` 형식 (예: `'playbook:execute'`, `'browser:navigate'`, `'runner:stop'`)

### IpcResult 타입
```typescript
interface IpcResult<T = unknown> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}
```

## 주석 스타일

### JSDoc (공개 API)
```typescript
/**
 * 플레이북 스텝을 실행합니다
 * @param step - 실행할 스텝
 * @param context - 실행 컨텍스트
 * @returns 실행 결과
 */
async executeStep(step: PlaybookStep, context: ExecutionContext): Promise<StepResult>
```

### 인라인 주석
- 복잡한 로직에만 사용
- "//" 스타일
- 의미 있는 코드는 주석 대신 명확한 변수명/함수명 사용

## Import 순서

1. React/라이브러리
2. 외부 패키지 (@/ 없는 것)
3. 내부 패키지 (@/로 시작)
4. 상대 경로 (./)
5. 타입 (import type)

```typescript
import { useState, useEffect } from 'react';
import { Playwright } from 'playwright';
import { useRunnerStore } from '@/stores/runner.store';
import { StepResult } from './types';
import type { PlaybookStep } from '@/types';
```

## 에러 처리

```typescript
// 함수명 + try-catch
async function executeStep(step: PlaybookStep): Promise<StepResult> {
  try {
    // ...
    return { success: true, ... };
  } catch (error) {
    logger.error('Step execution failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
```

## 테스트

- **테스트 파일**: `.test.ts` 또는 `__tests__/` 디렉토리
- **테스트명**: `describe('ServiceName')`, `it('should do something')`
- **Given-When-Then 패턴** 권장

```typescript
describe('PlaybookRunnerService', () => {
  it('should execute a single step successfully', async () => {
    // Given
    const step = { id: '1', action: 'click' };
    
    // When
    const result = await service.executeStep(step);
    
    // Then
    expect(result.status).toBe('success');
  });
});
```
