# 보탬e 구현 가이드라인

> **버전**: 1.0.0  
> **작성일**: 2026-01-08  
> **참조**: [REFACTORING_PLAN.md](./REFACTORING_PLAN.md)

---

## 1. Phase 1 시작 전 체크리스트

### 1.1 환경 준비

```bash
# Node.js 버전 확인 (20.x LTS 권장)
node --version

# pnpm 설치 (모노레포 패키지 매니저)
npm install -g pnpm

# 의존성 설치
pnpm install
```

### 1.2 필수 확인 사항

| 항목 | 확인 방법 | 기대 결과 |
|------|----------|----------|
| 기존 앱 빌드 | `cd botame-admin && pnpm build` | 에러 없음 |
| 기존 앱 실행 | `cd botame-admin && pnpm dev` | 정상 실행 |
| TypeScript 에러 | `pnpm tsc --noEmit` | 에러 없음 |
| 테스트 실행 | `pnpm test` (있다면) | 통과 |

### 1.3 Git 브랜치 전략

```
main
  └── refactor/monorepo-setup      # Phase 1
       └── refactor/self-healing   # Phase 2
            └── refactor/security  # Phase 3
                 └── ...
```

각 Phase 완료 시 main에 머지, 다음 Phase는 main에서 새 브랜치.

---

## 2. 프로젝트 구조 컨벤션

### 2.1 모노레포 구조

```
02.보탬e/
├── packages/
│   └── core/                      # @botame/core
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts           # 메인 export
│           ├── types/             # 타입 정의
│           ├── ipc/               # IPC 채널 + 타입
│           ├── playbook/          # 플레이북 파서/해석
│           ├── self-healing/      # Self-healing 엔진
│           │   ├── engine.ts
│           │   ├── types.ts
│           │   └── strategies/
│           └── security/          # 자격증명 관리
│
├── botame-admin/                  # 관리자 앱
│   ├── package.json               # "@botame/core": "workspace:*"
│   ├── electron/
│   │   ├── main.ts               # 진입점 (50줄 이하)
│   │   ├── bootstrap.ts          # 서비스 초기화
│   │   ├── ipc/                  # IPC 핸들러
│   │   └── services/             # 앱 전용 서비스
│   └── src/                      # React 렌더러
│
├── botame-guide-app/             # 사용자 앱
│   └── ...
│
├── pnpm-workspace.yaml           # 워크스페이스 정의
└── tsconfig.base.json            # 공유 TS 설정
```

### 2.2 pnpm-workspace.yaml

```yaml
packages:
  - 'packages/*'
  - 'botame-admin'
  - 'botame-guide-app'
```

### 2.3 tsconfig.base.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "paths": {
      "@botame/core": ["./packages/core/src"],
      "@botame/core/*": ["./packages/core/src/*"]
    }
  }
}
```

---

## 3. 코딩 컨벤션

### 3.1 타입 정의 규칙

#### 파일 구조

```typescript
// packages/core/src/types/playbook.ts

// 1. 기본 타입 (enum 대신 const + type)
export const ACTION_TYPES = ['navigate', 'click', 'type', 'select', 'wait', 'guide'] as const;
export type ActionType = typeof ACTION_TYPES[number];

// 2. 인터페이스 (명확한 JSDoc)
/**
 * 플레이북 스텝 정의
 * @example
 * const step: PlaybookStep = {
 *   id: 'step-1',
 *   action: 'click',
 *   selector: '[aria-label="로그인"]',
 * };
 */
export interface PlaybookStep {
  id: string;
  action: ActionType;
  selector?: string;
  value?: string;
  message?: string;
  timeout?: number;
}

// 3. export는 파일 하단에서 명시적으로
export type { PlaybookStep };
```

#### 타입 네이밍

| 종류 | 컨벤션 | 예시 |
|------|--------|------|
| 인터페이스 | PascalCase | `PlaybookStep`, `HealingResult` |
| 타입 별칭 | PascalCase | `ActionType`, `HealStrategy` |
| 상수 | UPPER_SNAKE_CASE | `ACTION_TYPES`, `IPC_CHANNELS` |
| 함수 | camelCase | `resolvePlaybook`, `findElement` |

#### any 금지 정책

```typescript
// ❌ 절대 금지
const data: any = response;
function process(input: any): any { }

// ✅ 대안 1: unknown + 타입 가드
function process(input: unknown): Result {
  if (isPlaybook(input)) {
    return handlePlaybook(input);
  }
  throw new Error('Invalid input');
}

// ✅ 대안 2: 제네릭
function process<T extends Playbook>(input: T): Result<T> { }

// ✅ 대안 3: 명시적 타입 (최소 범위)
const data = response as PlaybookResponse;
```

### 3.2 파일/폴더 네이밍

| 종류 | 컨벤션 | 예시 |
|------|--------|------|
| 폴더 | kebab-case | `self-healing/`, `ipc/` |
| 파일 (일반) | kebab-case | `playbook-runner.ts` |
| 파일 (타입) | kebab-case | `types.ts`, `playbook.types.ts` |
| 파일 (테스트) | 원본.test.ts | `engine.test.ts` |
| 파일 (React) | PascalCase | `RunnerPanel.tsx` |

### 3.3 Import 순서

```typescript
// 1. Node 내장 모듈
import path from 'path';
import fs from 'fs/promises';

// 2. 외부 라이브러리
import { Page, Locator } from 'playwright';
import { z } from 'zod';

// 3. @botame/core 패키지
import { PlaybookStep, HealingResult } from '@botame/core/types';
import { SelfHealingEngine } from '@botame/core/self-healing';

// 4. 상대 경로 (../ 먼저, ./ 나중)
import { BrowserService } from '../services/browser.service';
import { config } from './config';

// 5. 타입 전용 import
import type { IpcHandlerMap } from '@botame/core/ipc';
```

---

## 4. Self-healing 모듈 인터페이스

### 4.1 전략 인터페이스

```typescript
// packages/core/src/self-healing/strategies/base.ts

import type { Page, Locator } from 'playwright';
import type { SemanticStep, HealingResult } from '../types';

/**
 * Self-healing 전략 인터페이스
 * 모든 전략은 이 인터페이스를 구현해야 함
 */
export interface HealingStrategy {
  /** 전략 이름 (로깅/디버깅용) */
  readonly name: string;
  
  /** 전략 우선순위 (낮을수록 먼저 시도) */
  readonly priority: number;
  
  /**
   * 요소 찾기 시도
   * @param step - 실행할 스텝
   * @returns 성공 시 locator 포함, 실패 시 success: false
   */
  find(step: SemanticStep): Promise<HealingResult>;
  
  /**
   * 이 전략이 해당 스텝에 적용 가능한지 확인
   * @param step - 검사할 스텝
   * @returns 적용 가능 여부
   */
  canHandle(step: SemanticStep): boolean;
}

/**
 * 전략 기본 구현 (공통 로직)
 */
export abstract class BaseStrategy implements HealingStrategy {
  abstract readonly name: string;
  abstract readonly priority: number;
  
  constructor(protected page: Page) {}
  
  abstract find(step: SemanticStep): Promise<HealingResult>;
  
  canHandle(_step: SemanticStep): boolean {
    return true; // 기본: 모든 스텝에 적용 가능
  }
  
  protected async tryLocator(
    locator: Locator,
    timeout = 3000
  ): Promise<boolean> {
    try {
      await locator.waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      return false;
    }
  }
  
  protected createResult(
    success: boolean,
    locator?: Locator,
    selector?: string
  ): HealingResult {
    return {
      success,
      locator,
      strategy: this.name as HealingResult['strategy'],
      selector,
    };
  }
}
```

### 4.2 전략 구현 예시

```typescript
// packages/core/src/self-healing/strategies/identity.ts

import type { SemanticStep, HealingResult } from '../types';
import { BaseStrategy } from './base';

/**
 * v3 Identity 전략 - Accessibility-First 매칭
 * 우선순위: 1 (최우선)
 */
export class IdentityStrategy extends BaseStrategy {
  readonly name = 'identity';
  readonly priority = 1;
  
  canHandle(step: SemanticStep): boolean {
    // identity 정보가 있는 스텝만 처리
    return !!step.identity?.axRole;
  }
  
  async find(step: SemanticStep): Promise<HealingResult> {
    const { identity } = step;
    if (!identity?.axRole) {
      return this.createResult(false);
    }
    
    // 1. getByRole 시도
    const roleLocator = this.page.getByRole(identity.axRole as any, {
      name: identity.axName,
    });
    
    if (await this.tryLocator(roleLocator)) {
      return this.createResult(
        true,
        roleLocator,
        `getByRole('${identity.axRole}', { name: '${identity.axName}' })`
      );
    }
    
    // 2. aria-label 폴백
    if (identity.ariaLabel) {
      const ariaLocator = this.page.locator(`[aria-label="${identity.ariaLabel}"]`);
      if (await this.tryLocator(ariaLocator)) {
        return this.createResult(
          true,
          ariaLocator,
          `[aria-label="${identity.ariaLabel}"]`
        );
      }
    }
    
    return this.createResult(false);
  }
}
```

### 4.3 엔진 구현

```typescript
// packages/core/src/self-healing/engine.ts

import type { Page } from 'playwright';
import type { SemanticStep, HealingResult, HealingStats } from './types';
import type { HealingStrategy } from './strategies/base';

import { IdentityStrategy } from './strategies/identity';
import { PlaywrightLocatorStrategy } from './strategies/playwright';
import { FallbackStrategy } from './strategies/fallback';
import { StructuralStrategy } from './strategies/structural';
import { CoordinatesStrategy } from './strategies/coordinates';

export class SelfHealingEngine {
  private strategies: HealingStrategy[];
  private stats: HealingStats = {
    total: 0,
    byStrategy: {},
    successRate: 0,
  };
  
  constructor(private page: Page) {
    // 우선순위 순으로 정렬된 전략 파이프라인
    this.strategies = [
      new IdentityStrategy(page),        // 1. v3 Accessibility
      new PlaywrightLocatorStrategy(page), // 2. Playwright 로케이터
      new FallbackStrategy(page),         // 3. v2 SmartSelector
      new StructuralStrategy(page),       // 4. v4 구조적 폴백
      new CoordinatesStrategy(page),      // 5. 좌표 (최후)
    ].sort((a, b) => a.priority - b.priority);
  }
  
  async findElement(step: SemanticStep): Promise<HealingResult> {
    this.stats.total++;
    
    for (const strategy of this.strategies) {
      // 적용 가능한 전략만 시도
      if (!strategy.canHandle(step)) {
        continue;
      }
      
      const result = await strategy.find(step);
      
      if (result.success) {
        this.recordSuccess(strategy.name);
        return result;
      }
    }
    
    // 모든 전략 실패
    return {
      success: false,
      strategy: 'coordinates',
      error: '모든 전략 실패',
    };
  }
  
  private recordSuccess(strategyName: string): void {
    this.stats.byStrategy[strategyName] = 
      (this.stats.byStrategy[strategyName] || 0) + 1;
    
    const successCount = Object.values(this.stats.byStrategy)
      .reduce((a, b) => a + b, 0);
    this.stats.successRate = (successCount / this.stats.total) * 100;
  }
  
  getStats(): HealingStats {
    return { ...this.stats };
  }
}
```

---

## 5. IPC 타입 안전 패턴

### 5.1 채널 정의

```typescript
// packages/core/src/ipc/channels.ts

/**
 * IPC 채널 상수
 * main.ts와 preload.ts에서 동일한 값 사용 보장
 */
export const IPC_CHANNELS = {
  // 플레이북
  PLAYBOOK: {
    RUN: 'playbook:run',
    STOP: 'playbook:stop',
    LIST: 'playbook:list',
    SAVE: 'playbook:save',
    DELETE: 'playbook:delete',
    GET: 'playbook:get',
  },
  
  // 녹화
  RECORDING: {
    START: 'recording:start',
    STOP: 'recording:stop',
    PAUSE: 'recording:pause',
    RESUME: 'recording:resume',
    EVENT: 'recording:event',
  },
  
  // 브라우저
  BROWSER: {
    CONNECT: 'browser:connect',
    DISCONNECT: 'browser:disconnect',
    NAVIGATE: 'browser:navigate',
    STATUS: 'browser:status',
  },
  
  // 실행
  RUNNER: {
    EVENT: 'runner:event',
    STATE: 'runner:state',
  },
} as const;

// 채널 타입 추출
export type IpcChannelPath = 
  | typeof IPC_CHANNELS.PLAYBOOK[keyof typeof IPC_CHANNELS.PLAYBOOK]
  | typeof IPC_CHANNELS.RECORDING[keyof typeof IPC_CHANNELS.RECORDING]
  | typeof IPC_CHANNELS.BROWSER[keyof typeof IPC_CHANNELS.BROWSER]
  | typeof IPC_CHANNELS.RUNNER[keyof typeof IPC_CHANNELS.RUNNER];
```

### 5.2 요청/응답 타입 매핑

```typescript
// packages/core/src/ipc/types.ts

import type { IPC_CHANNELS } from './channels';
import type { 
  Playbook, 
  PlaybookListItem, 
  StepResult, 
  IpcResult,
  RunnerState,
} from '../types';

/**
 * IPC 채널별 요청/응답 타입 매핑
 */
export interface IpcHandlerMap {
  // 플레이북
  [IPC_CHANNELS.PLAYBOOK.RUN]: {
    request: { playbook: Playbook; startUrl?: string };
    response: IpcResult<StepResult[]>;
  };
  [IPC_CHANNELS.PLAYBOOK.STOP]: {
    request: void;
    response: IpcResult<void>;
  };
  [IPC_CHANNELS.PLAYBOOK.LIST]: {
    request: void;
    response: IpcResult<PlaybookListItem[]>;
  };
  [IPC_CHANNELS.PLAYBOOK.SAVE]: {
    request: { playbook: Playbook; overwrite?: boolean };
    response: IpcResult<{ id: string }>;
  };
  [IPC_CHANNELS.PLAYBOOK.DELETE]: {
    request: { id: string };
    response: IpcResult<void>;
  };
  [IPC_CHANNELS.PLAYBOOK.GET]: {
    request: { id: string };
    response: IpcResult<Playbook>;
  };
  
  // 브라우저
  [IPC_CHANNELS.BROWSER.CONNECT]: {
    request: void;
    response: IpcResult<{ connected: boolean }>;
  };
  [IPC_CHANNELS.BROWSER.NAVIGATE]: {
    request: { url: string };
    response: IpcResult<void>;
  };
  
  // ... 기타 채널
}

/**
 * 이벤트 채널 타입 (main → renderer)
 */
export interface IpcEventMap {
  [IPC_CHANNELS.RUNNER.EVENT]: {
    type: 'started' | 'step_completed' | 'completed' | 'error';
    state: RunnerState;
    stepResult?: StepResult;
  };
  [IPC_CHANNELS.RECORDING.EVENT]: {
    type: 'action_recorded' | 'error';
    action?: RecordedAction;
    error?: string;
  };
}
```

### 5.3 타입 안전 invoke 헬퍼

```typescript
// packages/core/src/ipc/helpers.ts

import type { IpcRenderer, IpcMain } from 'electron';
import type { IpcHandlerMap, IpcEventMap, IpcChannelPath } from './types';

/**
 * 타입 안전 invoke 생성기 (preload용)
 */
export function createTypedInvoke(ipcRenderer: IpcRenderer) {
  return async function invoke<C extends keyof IpcHandlerMap>(
    channel: C,
    request: IpcHandlerMap[C]['request']
  ): Promise<IpcHandlerMap[C]['response']> {
    return ipcRenderer.invoke(channel as string, request);
  };
}

/**
 * 타입 안전 handle 생성기 (main용)
 */
export function createTypedHandle(ipcMain: IpcMain) {
  return function handle<C extends keyof IpcHandlerMap>(
    channel: C,
    handler: (
      event: Electron.IpcMainInvokeEvent,
      request: IpcHandlerMap[C]['request']
    ) => Promise<IpcHandlerMap[C]['response']>
  ): void {
    ipcMain.handle(channel as string, handler);
  };
}

/**
 * 타입 안전 on 생성기 (렌더러 이벤트 수신용)
 */
export function createTypedOn(ipcRenderer: IpcRenderer) {
  return function on<C extends keyof IpcEventMap>(
    channel: C,
    listener: (event: Electron.IpcRendererEvent, data: IpcEventMap[C]) => void
  ): void {
    ipcRenderer.on(channel as string, listener);
  };
}
```

### 5.4 사용 예시

```typescript
// botame-admin/electron/preload.ts

import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, createTypedInvoke, createTypedOn } from '@botame/core/ipc';

const invoke = createTypedInvoke(ipcRenderer);
const on = createTypedOn(ipcRenderer);

const api = {
  playbook: {
    run: (playbook, startUrl) => 
      invoke(IPC_CHANNELS.PLAYBOOK.RUN, { playbook, startUrl }),
    stop: () => 
      invoke(IPC_CHANNELS.PLAYBOOK.STOP, undefined),
    list: () => 
      invoke(IPC_CHANNELS.PLAYBOOK.LIST, undefined),
  },
  
  runner: {
    onEvent: (callback) => {
      on(IPC_CHANNELS.RUNNER.EVENT, (_, data) => callback(data));
    },
  },
};

contextBridge.exposeInMainWorld('api', api);
```

```typescript
// botame-admin/electron/ipc/playbook.handlers.ts

import { createTypedHandle } from '@botame/core/ipc';
import { IPC_CHANNELS } from '@botame/core/ipc';
import type { PlaybookRunnerService } from '../services/playbook-runner.service';

export function registerPlaybookHandlers(
  ipcMain: IpcMain,
  runnerService: PlaybookRunnerService
) {
  const handle = createTypedHandle(ipcMain);
  
  handle(IPC_CHANNELS.PLAYBOOK.RUN, async (_, request) => {
    // request는 자동으로 { playbook, startUrl? } 타입
    return runnerService.run(request.playbook, request.startUrl);
  });
  
  handle(IPC_CHANNELS.PLAYBOOK.LIST, async () => {
    return runnerService.list();
  });
}
```

---

## 6. 테스트 전략

### 6.1 테스트 구조

```
packages/core/
├── src/
│   └── self-healing/
│       ├── engine.ts
│       └── strategies/
│           ├── identity.ts
│           └── ...
└── tests/
    └── self-healing/
        ├── engine.test.ts
        ├── strategies/
        │   ├── identity.test.ts
        │   └── ...
        └── fixtures/
            ├── steps.ts           # 테스트용 스텝 데이터
            └── pages.ts           # 모의 페이지 데이터
```

### 6.2 테스트 유형

| 유형 | 범위 | 실행 시점 |
|------|------|----------|
| Unit | 개별 전략, 유틸 함수 | 매 커밋 |
| Integration | 엔진 전체, IPC 흐름 | PR 시 |
| E2E | 플레이북 실행 | 릴리스 전 |
| Regression | 기존 플레이북 성공률 | Phase 완료 시 |

### 6.3 Self-healing 회귀 테스트

```typescript
// packages/core/tests/self-healing/regression.test.ts

import { describe, test, expect, beforeAll } from 'vitest';
import { SelfHealingEngine } from '../../src/self-healing/engine';

// 테스트용 플레이북 (실제 녹화된 데이터)
const REGRESSION_PLAYBOOKS = [
  'fixtures/playbooks/login.json',
  'fixtures/playbooks/tax-invoice-register.json',
  // ...
];

describe('Self-healing Regression', () => {
  let engine: SelfHealingEngine;
  
  beforeAll(async () => {
    // 테스트 브라우저 설정
  });
  
  for (const playbookPath of REGRESSION_PLAYBOOKS) {
    describe(playbookPath, () => {
      test('모든 스텝에서 요소 찾기 성공', async () => {
        const playbook = await loadPlaybook(playbookPath);
        const results = [];
        
        for (const step of playbook.steps) {
          const result = await engine.findElement(step);
          results.push(result);
        }
        
        const successRate = results.filter(r => r.success).length / results.length;
        expect(successRate).toBeGreaterThanOrEqual(0.95); // 95% 이상
      });
    });
  }
});
```

### 6.4 성공률 기준

| 전략 | 최소 기여율 | 조치 |
|------|------------|------|
| identity | 20%+ | 유지 필수 |
| playwright | 20%+ | 유지 필수 |
| fallback | 10%+ | 유지 |
| structural | 5%+ | 유지 |
| coordinates | - | 항상 최후 폴백 |

전략별 기여율이 5% 미만이면 제거 검토.

---

## 7. PR/커밋 컨벤션

### 7.1 커밋 메시지

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Type

| Type | 설명 |
|------|------|
| feat | 새 기능 |
| fix | 버그 수정 |
| refactor | 리팩토링 (기능 변경 없음) |
| docs | 문서 변경 |
| test | 테스트 추가/수정 |
| chore | 빌드, 설정 변경 |

#### Scope

| Scope | 설명 |
|-------|------|
| core | @botame/core 패키지 |
| admin | botame-admin 앱 |
| guide | botame-guide-app 앱 |
| healing | Self-healing 관련 |
| ipc | IPC 관련 |
| security | 보안 관련 |

#### 예시

```
feat(core/healing): Add IdentityStrategy for v3 accessibility matching

- Implement getByRole with axName matching
- Add aria-label fallback
- Add canHandle() check for identity presence

Closes #123
```

```
refactor(admin): Extract IPC handlers from main.ts

- Create ipc/playbook.handlers.ts
- Create ipc/recording.handlers.ts
- Reduce main.ts from 400 lines to 50 lines

Part of Phase 3 refactoring
```

### 7.2 PR 템플릿

```markdown
## 변경 사항
<!-- 이 PR에서 변경된 내용을 설명하세요 -->

## 관련 이슈
<!-- Closes #123 -->

## 체크리스트
- [ ] TypeScript 에러 없음 (`pnpm tsc --noEmit`)
- [ ] 린트 통과 (`pnpm lint`)
- [ ] 테스트 추가/수정됨
- [ ] 테스트 통과 (`pnpm test`)
- [ ] 문서 업데이트 (필요시)

## 스크린샷 (UI 변경 시)
<!-- 변경 전/후 스크린샷 -->

## 테스트 방법
<!-- 이 변경을 어떻게 테스트할 수 있는지 설명하세요 -->
```

### 7.3 PR 리뷰 기준

| 항목 | 기준 |
|------|------|
| 크기 | 300줄 이하 권장, 500줄 초과 시 분할 요청 |
| 테스트 | 새 코드에 대한 테스트 필수 |
| 타입 | any 사용 금지 |
| 문서 | 공개 API 변경 시 문서 필수 |

---

## 8. Phase별 완료 기준

### Phase 1: 기반 구축

| 체크리스트 | 상태 |
|-----------|------|
| pnpm workspace 설정 완료 | ⬜ |
| @botame/core 패키지 생성 | ⬜ |
| 기존 types 마이그레이션 | ⬜ |
| IPC 채널 상수 정의 | ⬜ |
| 기존 앱 빌드 성공 | ⬜ |
| 기존 앱 실행 성공 | ⬜ |

### Phase 2: Self-healing 모듈화

| 체크리스트 | 상태 |
|-----------|------|
| 전략 인터페이스 정의 | ⬜ |
| IdentityStrategy 구현 | ⬜ |
| PlaywrightLocatorStrategy 구현 | ⬜ |
| FallbackStrategy 구현 | ⬜ |
| StructuralStrategy 구현 (v4) | ⬜ |
| CoordinatesStrategy 구현 | ⬜ |
| 엔진 파이프라인 구현 | ⬜ |
| 성공률 측정 로직 | ⬜ |
| 회귀 테스트 통과 (95%+) | ⬜ |
| botame-guide-app 적용 | ⬜ |

### Phase 3: 보안 + IPC

| 체크리스트 | 상태 |
|-----------|------|
| keytar 설치 및 CredentialStore | ⬜ |
| CSP 헤더 추가 | ⬜ |
| IPC 핸들러 분리 | ⬜ |
| 타입 안전 invoke 적용 | ⬜ |
| 런타임 검증 (zod) | ⬜ |
| main.ts 50줄 이하 | ⬜ |

### Phase 4: 플레이북 + 아티팩트

| 체크리스트 | 상태 |
|-----------|------|
| PlaybookResolver 구현 | ⬜ |
| 템플릿 인라인 확장 | ⬜ |
| aliases 검색 | ⬜ |
| ArtifactCollector 구현 | ⬜ |
| 스크린샷 마스킹 | ⬜ |
| Supabase 아티팩트 저장 | ⬜ |

### Phase 5: 통합

| 체크리스트 | 상태 |
|-----------|------|
| botame-admin 완전 이관 | ⬜ |
| 기존 코드 제거 | ⬜ |
| 프로덕션 하드닝 | ⬜ |
| 통합 테스트 통과 | ⬜ |
| 성공률 리포트 생성 | ⬜ |

---

## 9. 문제 해결 가이드

### 9.1 모노레포 관련

```bash
# 패키지 간 의존성 문제
pnpm install --force

# 타입 인식 안될 때
pnpm build --filter=@botame/core
# 또는 IDE 재시작

# 순환 의존성 확인
pnpm why <package-name>
```

### 9.2 Self-healing 디버깅

```typescript
// 전략별 시도 로깅 활성화
const engine = new SelfHealingEngine(page, { debug: true });

// 특정 전략만 테스트
const result = await new IdentityStrategy(page).find(step);
console.log(result);

// 성공률 확인
console.log(engine.getStats());
```

### 9.3 IPC 디버깅

```typescript
// main.ts - 모든 IPC 호출 로깅
ipcMain.on('*', (channel, ...args) => {
  console.log(`[IPC] ${channel}`, args);
});

// preload.ts - 응답 로깅
const originalInvoke = ipcRenderer.invoke;
ipcRenderer.invoke = async (channel, ...args) => {
  console.log(`[IPC Request] ${channel}`, args);
  const result = await originalInvoke.call(ipcRenderer, channel, ...args);
  console.log(`[IPC Response] ${channel}`, result);
  return result;
};
```

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 1.0.0 | 2026-01-08 | 초기 작성 |
