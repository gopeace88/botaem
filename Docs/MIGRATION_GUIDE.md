# 보탬e 아키텍처 리팩토링 마이그레이션 가이드

## 개요

이 가이드는 기존 monolithic 구조에서 새로운 monorepo 구조로의 마이그레이션을 설명합니다.

### 변경 사항 요약

**이전 구조:**
- `botame-admin/shared/types.ts` - 타입 정의
- `botame-guide-app/electron/playbook/types.ts` - 중복 타입 정의
- `botame-guide-app/electron/playbook/engine.ts` - 실행 엔진
- `botame-admin/electron/services/playbook-runner.service.ts` - 중복 실행 로직

**새로운 구조:**
- `packages/@botame/types/` - 통합된 타입 정의
- `packages/@botame/player/` - 공유 실행 엔진
- `packages/@botame/recorder/` - 녹화 엔진 (admin 전용)

---

## 1. 타입 임포트 변경

### botame-admin

**변경 전:**
```typescript
import { Playbook, PlaybookStep } from '../../shared/types';
```

**변경 후:**
```typescript
import { Playbook, PlaybookStep } from '@botame/types';
```

### botame-guide-app

**변경 전:**
```typescript
import { Playbook, PlaybookStep } from '../playbook/types';
```

**변경 후:**
```typescript
import { Playbook, PlaybookStep } from '@botame/types';
```

---

## 2. 실행 엔진 사용

### PlaybookEngine 사용법

**botame-guide-app/electron/player/guide-player.ts:**
```typescript
import { PlaybookEngine } from '@botame/player';
import { PlaywrightAdapter } from './playwright-adapter';

class GuidePlayer {
  private engine = new PlaybookEngine();

  async execute(playbook: Playbook) {
    // 브라우저 어댑터 설정
    const adapter = new PlaywrightAdapter(this.page);

    // 실행 컨텍스트 구성
    const context: ExecutionContext = {
      variables: {},
      currentStepIndex: 0,
      status: 'idle',
      errors: [],
      healingEnabled: true,
      browserAdapter: adapter
    };

    // 플레이북 로드 및 실행
    this.engine.load(playbook);
    await this.engine.start(context);
  }
}
```

### 이벤트 리스닝

```typescript
engine.on('step:started', (data) => {
  console.log(`Step ${data.stepIndex} started`);
});

engine.on('step:completed', (data) => {
  console.log(`Step ${data.stepIndex} completed`);
});

engine.on('step:failed', (data) => {
  console.error(`Step ${data.stepIndex} failed:`, data.error);
});

engine.on('execution:completed', (data) => {
  console.log('Execution completed:', data.result);
});
```

---

## 3. 브라우저 어댑터 구현

### PlaywrightAdapter 예시

**botame-guide-app/electron/player/playwright-adapter.ts:**
```typescript
import { BrowserAdapter } from '@botame/types';
import { Page } from 'playwright';

export class PlaywrightAdapter implements BrowserAdapter {
  constructor(private page: Page) {}

  async click(selector: string, options?: ClickOptions): Promise<ActionResult> {
    try {
      await this.page.click(selector, options);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async type(selector: string, text: string): Promise<ActionResult> {
    try {
      await this.page.fill(selector, text);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async getUrl(): string {
    return this.page.url();
  }

  // ... 다른 메서드 구현
}
```

---

## 4. RecordingService 변경사항

### SmartSelector 생성

**변경 전:**
```typescript
import { SmartSelector } from '../core/smart-selector';

const selector: SmartSelector = {
  primary: 'css selector',
  fallback: ['fallback1', 'fallback2']
};
```

**변경 후:**
```typescript
import { generateSelectors } from '@botame/recorder';

const selectors = generateSelectors({
  tagName: 'button',
  id: 'submit-btn',
  className: 'btn btn-primary',
  text: '제출',
  ariaLabel: '제출 버튼',
  // ... 기타 요소 정보
});

// 결과: SelectorInfo[] 배열
```

---

## 5. 버전 관리 전략

### 패키지 버전 규칙

| 패키지 | 버전 | 안정성 | 변경 빈도 |
|--------|------|--------|-----------|
| @botame/types | 1.0.0 | 매우 높음 | 최소화 |
| @botame/player | 2.1.0 | 높음 | 중간 |
| @botame/recorder | 1.0.0 | 중간 | 높음 |

### 앱별 버전 고정 전략

**botame-guide-app (사용자 배포용):**
```json
{
  "dependencies": {
    "@botame/types": "1.0.0",
    "@botame/player": "2.1.0"
  }
}
```
- 정확한 버전만 사용 (caret 없음)
- 업데이트 시 package.json 직접 수정
- 배포 후 실시간 업데이트 방지

**botame-admin (개발 중):**
```json
{
  "dependencies": {
    "@botame/types": "workspace:*",
    "@botame/player": "workspace:*",
    "@botame/recorder": "workspace:*"
  }
}
```
- 개발 중: `workspace:*` 프로토콜 사용
- npm publish 후: `^1.0.0` caret 사용으로 자동 업데이트

---

## 6. 공통 마이그레이션 이슈

### Issue 1: ExecutionContext 타입 불일치

**증상:**
```
Type 'ExecutionContext' is missing properties: 'currentStepIndex', 'status'
```

**해결:**
```typescript
// 모든 필드 포함
const context: ExecutionContext = {
  variables: {},
  currentStepIndex: 0,
  status: 'idle',
  errors: [],
  healingEnabled: true,
  browserAdapter: adapter
};
```

### Issue 2: BrowserAdapter 미구현

**증상:**
```
Property 'click' does not exist on type 'BrowserAdapter'
```

**해결:**
```typescript
// BrowserAdapter 인터페이스 구현
class MyBrowserAdapter implements BrowserAdapter {
  async click(selector: string, options?: ClickOptions) {
    // 구현
  }
  // ... 다른 메서드
}
```

### Issue 3: 이벤트 타입 에러

**증상:**
```
Parameter of type 'any' is not assignable to type 'never'
```

**해결:**
```typescript
// 타입 가드 사용
engine.on('step:started', (data: Extract<EngineEvent, {type: 'step:started'}>) => {
  console.log(data.stepIndex);
});
```

---

## 7. 개발 워크플로우

### 새로운 기능 추가

1. **패키지에 기능 구현**
   ```bash
   cd packages/@botame/player
   # 코드 수정
   npm run build
   npm run test
   ```

2. **앱에서 테스트**
   ```bash
   cd ../../botame-admin
   npm run dev
   # 기능 테스트
   ```

3. **타입스크립트 캐시 클어어 (필요시)**
   ```bash
   rm -rf node_modules/.cache
   pnpm -r build
   ```

### 릴리스 프로세스

1. **패키지 버전 bump**
   ```bash
   cd packages/@botame/types
   npm version minor  # 1.0.0 -> 1.1.0
   ```

2. **빌드 및 퍼블리시**
   ```bash
   pnpm -r build
   npm publish
   ```

3. **앱 업데이트**
   - guide-app: package.json에 정확한 버전 명시 후 `pnpm install`
   - admin: `pnpm update` (caret 버전 사용 시 자동 업데이트)

---

## 8. 테스트 가이드

### 전체 워크스페이스 테스트

```bash
# 빌드
pnpm -r build

# 타입 체크
pnpm -r typecheck

# 테스트
pnpm -r test

# 한 번에 실행
pnpm -r build && pnpm -r typecheck && pnpm -r test
```

### 개별 패키지 테스트

```bash
cd packages/@botame/player
npm run test

cd packages/@botame/types
npm run typecheck
```

---

## 9. 디버깅 팁

### 빌드 캐시 문제

```bash
# 모든 캐시 삭제
rm -rf node_modules/.cache
rm -rf packages/*/node_modules/.cache

# 재빌드
pnpm -r build
```

### TypeScript 오류

```bash
# 프로젝트 클린
cd botame-admin
rm -rf dist out node_modules/.vite

# 재빌드
npm run build
```

### 워크스페이스 의존성 확인

```bash
# 의존성 트리 확인
pnpm list --depth=0

# 특정 패키지 의존성
pnpm list --filter=@botame/player
```

---

## 10. 추가 문서

- [디자인 문서](./plans/2026-01-12-architecture-refactoring-design.md)
- [구현 계획](./plans/2026-01-12-architecture-refactoring-implementation.md)
- [각 패키지 README](../packages/README.md)

---

## 11. 지원 및 피드백

마이그레이션 중 문제가 발생하면:
1. 이 가이드의 섹션 6 (공통 이슈) 확인
2. 패키지 README의 예제 코드 참조
3. TypeScript 오류 시 `pnpm -r typecheck` 실행

---

## 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|-----------|
| 2026-01-13 | 1.0.0 | 초기 마이그레이션 가이드 작성 |
