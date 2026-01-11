# 보탬e 아키텍처 리팩토링 설계

## 개요

### 목표

- **안정성 1순위**: guide 앱 배포 후 업데이트 최소화
- **코드 중복 최소화**: 공유 코드는 packages/에서 일원 관리
- **독립적 배포**: admin 변경이 guide에 영향 없음

### 배경

현재 프로젝트의 주요 문제점:
1. 타입 정의이 `botame-admin/shared/types.ts`, `botame-guide-app/electron/playbook/types.ts`, `packages/core/src/types/` 세 곳에 중복
2. 플레이북 실행/녹화 로직이 두 앱에 각각 구현되어 있음
3. Playwright 컨트롤러 코드가 중복
4. admin 앱 변경이 guide 앱에 의도치 않은 영향을 줄 위험

---

## 패키지 구조

```
02.보탬e/
├── packages/
│   ├── @botame/types/           # 타입 정의 (안정적)
│   │   ├── src/
│   │   │   ├── playbook.ts      # Playbook, PlaybookStep, etc.
│   │   │   ├── selector.ts      # SmartSelector, etc.
│   │   │   ├── execution.ts     # StepResult, ExecutionContext
│   │   │   ├── healing.ts       # Self-healing 타입
│   │   │   ├── recording.ts     # 녹화 관련 타입
│   │   │   ├── ipc.ts           # IPC 공통 타입
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── @botame/player/          # 플레이북 실행 엔진 (공유)
│   │   ├── src/
│   │   │   ├── engine.ts        # 핵심 실행 엔진
│   │   │   ├── parser.ts        # 플레이북 파싱
│   │   │   ├── interpolator.ts  # 변수 보간
│   │   │   ├── validator.ts     # JSON 스키마 검증
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── @botame/recorder/        # 플레이북 녹화 엔진 (admin 전용)
│       ├── src/
│       │   ├── capture.ts       # 액션 캡처
│       │   ├── smart-selector.ts # 스마트 셀렉터 생성
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── botame-admin/                # 관리자 도구
│   └── package.json             # 의존: @botame/types, @botame/player, @botame/recorder
│
└── botame-guide-app/            # 사용자 가이드 앱
    └── package.json             # 의존: @botame/types, @botame/player (버전 고정)
```

---

## 의존성 관계

### 의존성 다이어그램

```
┌─────────────────┐
│ botame-admin    │
│                 │
│ ── uses ────────┼──► @botame/recorder (admin 전용, 자주 업데이트)
│                 │
│ ── uses ────────┼──► @botame/player (^2.1.0, 항상 최신)
│                 │
│ ── uses ────────┼──► @botame/types (^1.0.0, 항상 최신)
└─────────────────┘

┌─────────────────┐
│ botame-guide-app│
│                 │
│ ── uses ────────┼──► @botame/player (2.1.0, 정확히 이 버전만)
│                 │
│ ── uses ────────┼──► @botame/types (1.0.0, 정확히 이 버전만)
└─────────────────┘

     @botame/recorder
          │
          └── depends on ──► @botame/types

     @botame/player
          │
          └── depends on ──► @botame/types
```

### 버전 관리 전략

#### botame-guide-app (정확한 버전 고정)

```json
{
  "dependencies": {
    "@botame/types": "1.0.0",
    "@botame/player": "2.1.0"
  }
}
```

- 명시된 버전만 사용
- 업데이트 시 package.json을 직접 수정하고 `pnpm install`
- 배포 후 실수로 업데이트되는 것을 방지

#### botame-admin (유연한 버전)

```json
{
  "dependencies": {
    "@botame/types": "^1.0.0",
    "@botame/player": "^2.1.0",
    "@botame/recorder": "^1.0.0"
  }
}
```

- caret(^) 사용으로 항상 최신 호환 버전 사용
- 개발 중인 admin 앱은 최신 기능 즉시 반영

---

## @botame/types 상세 설계

### 개요

가장 안정적인 패키지. 한 번 정의되면 쉽게 변경되지 않음.

### 파일 구조

```
packages/@botame/types/
├── src/
│   ├── playbook.ts         # 플레이북 핵심 타입
│   ├── selector.ts         # 셀렉터 관련 타입
│   ├── execution.ts        # 실행 컨텍스트 & 결과
│   ├── healing.ts          # 자동 고침 타입
│   ├── recording.ts        # 녹화 관련 타입
│   ├── ipc.ts              # IPC 공통 타입
│   └── index.ts            # 전체 export
├── package.json
└── tsconfig.json
```

### 핵심 타입: 통합된 PlaybookStep

현재 세 곳에 분산된 `PlaybookStep`을 하나로 통합:

```typescript
export type ActionType =
  | 'navigate' | 'click' | 'type' | 'select'
  | 'wait' | 'guide' | 'scroll' | 'hover';

export interface PlaybookStep {
  // === 기본 필드 (모든 앱 공통) ===
  id: string;
  action: ActionType;
  selector?: string;
  value?: string;
  message?: string;
  timeout?: number;
  optional?: boolean;
  waitAfter?: number;

  // === 다중 셀렉터 지원 ===
  selectors?: SelectorInfo[];

  // === 가이드 앱 확장 (선택적) ===
  wait_for?: WaitFor;
  condition?: string;
  on_error?: OnError;
  verify?: StepVerify;

  // === 실행 히스토리 (런타임 전용) ===
  healingHistory?: HealingRecord[];
}

export interface Playbook {
  metadata: PlaybookMetadata;
  steps: PlaybookStep[];

  // === 가이드 앱 확장 ===
  variables?: Record<string, VariableDefinition>;
  preconditions?: Precondition[];
  error_handlers?: ErrorHandler[];
}
```

### 버전 관리 전략

- **Major (1.x → 2.x)**: 타입 삭제 또는 호환성 파괴
- **Minor (1.0 → 1.1)**: 새로운 선택적 필드 추가 (하위 호환 OK)
- **Patch (1.0.0 → 1.0.1)**: 버그 수정, JSDoc 업데이트

---

## @botame/player 상세 설계

### 개요

두 앱이 공유하는 플레이북 실행 엔진.

### 책임 범위

- ✅ 플레이북 파싱 및 검증
- ✅ 스텝 순차 실행
- ✅ 자동 고침 (Self-Healing)
- ✅ 실행 상태 관리
- ❌ 브라우저 제어 X (각 앱이 Playwright 직접 사용)
- ❌ UI 렌더링 X

### 핵심 API

```typescript
export interface PlaybookEngine {
  // 플레이북 로드
  load(playbook: Playbook): Promise<void>;

  // 실행 시작
  execute(context: ExecutionContext): Promise<ExecutionResult>;

  // 일시정지/재개
  pause(): void;
  resume(): void;

  // 중단
  stop(): void;

  // 이벤트 리스너
  on(event: EngineEvent, callback: (data: any) => void): void;
}

export interface ExecutionContext {
  variables: Record<string, unknown>;
  currentUrl: string;
  healingEnabled: boolean;

  // 브라우저 제어는 각 앱이 제공
  browserAdapter: BrowserAdapter;
}
```

### BrowserAdapter 인터페이스

```typescript
export interface BrowserAdapter {
  // 기본 액션
  click(selector: string, options?: ClickOptions): Promise<ActionResult>;
  type(selector: string, text: string): Promise<ActionResult>;
  select(selector: string, value: string): Promise<ActionResult>;
  navigate(url: string): Promise<ActionResult>;
  waitFor(selector: string, timeout?: number): Promise<ActionResult>;

  // 상태 조회
  getUrl(): string;
  getTitle(): string;

  // 자동 고침 지원
  getTextContent(selector: string): Promise<string>;
  getAriaLabel(selector: string): Promise<string>;
  isVisible(selector: string): Promise<boolean>;
}
```

### 각 앱의 사용 예시

```typescript
// botame-guide-app/electron/player/execution-handler.ts

import { PlaybookEngine } from '@botame/player';
import { PlaywrightAdapter } from './playwright-adapter';

class GuideExecutionHandler {
  private engine = new PlaybookEngine();

  async execute(playbook: Playbook) {
    const adapter = new PlaywrightAdapter(this.page);

    return this.engine.execute(playbook, {
      variables: {},
      currentUrl: this.page.url(),
      healingEnabled: true,
      browserAdapter: adapter
    });
  }
}

// botame-admin/electron/services/admin-runner.service.ts

import { PlaybookEngine } from '@botame/player';
import { AdminBrowserAdapter } from './admin-browser-adapter';

class AdminRunnerService {
  private engine = new PlaybookEngine();

  async testPlaybook(playbook: Playbook) {
    const adapter = new AdminBrowserAdapter(this.browserService);

    return this.engine.execute(playbook, {
      variables: {},
      currentUrl: this.browserService.getCurrentUrl(),
      healingEnabled: true,
      browserAdapter: adapter
    });
  }
}
```

---

## @botame/recorder 상세 설계

### 개요

admin 전용 플레이북 녹화 엔진. guide 앱과는 독립적으로 개발/업데이트.

### 책임 범위

- ✅ 브라우저 액션 캡처
- ✅ 스마트 셀렉터 생성 (다중 전략)
- ✅ 요소 식별 정보 수집 (ElementIdentity)
- ❌ 플레이북 편집 UI X (admin 렌더러에서 처리)
- ❌ 브라우저 제어 X (admin의 browser.service 사용)

### 핵심 API

```typescript
export interface ActionCapture {
  // 캡처된 액션
  action: ActionType;
  timestamp: number;

  // 셀렉터 정보
  primarySelector: string;
  fallbackSelectors: SelectorInfo[];

  // 요소 식별 (v3/v4)
  identity: ElementIdentity;

  // 좌표 (CDP)
  clickX?: number;
  clickY?: number;
}

export interface Recorder {
  // 캡처 시작
  start(): void;

  // 액션 기록
  recordAction(cdpEvent: CDPEvent): ActionCapture;

  // 플레이북으로 변환
  generatePlaybook(): Playbook;

  // 캡처 중단
  stop(): RecordedAction[];
}
```

### admin에서의 사용 예시

```typescript
// botame-admin/electron/services/recording.service.ts

import { Recorder } from '@botame/recorder';

class RecordingService {
  private recorder = new Recorder();

  async startRecording(page: Page) {
    this.recorder.start();

    // CDP 이벤트 리스닝
    page.on('framenavigated', () => this.recordNavigation());
    page.on('console', () => /* ... */);
  }

  async stopRecording() {
    const actions = this.recorder.stop();
    const playbook = this.recorder.generatePlaybook();

    // 저장 로직 (admin 고유)
    await this.saveToDatabase(playbook);
  }
}
```

---

## 마이그레이션 계획

### 단계 1: 패키지 스캐폴딩 (1일)

```bash
# packages 폴더 구조 생성
mkdir -p packages/@botame/{types,player,recorder}/src

# 각 패키지 초기화
cd packages/@botame/types && pnpm init
cd ../player && pnpm init
cd ../recorder && pnpm init

# workspace 구성
# 루트의 pnpm-workspace.yaml에 추가
```

### 단계 2: 타입 통합 (2-3일)

1. `botame-admin/shared/types.ts` → `packages/@botame/types/`
2. `botame-guide-app/electron/playbook/types.ts` → 통합
3. 세 곳의 `PlaybookStep`을 하나로 합치기
4. 각 앱의 import 경로 업데이트

**검증:** 두 앱 모두 타입 에러 없이 컴파일

### 단계 3: player 추출 (3-4일)

1. `botame-guide-app/electron/playbook/engine.ts` → `packages/@botame/player/`
2. `botame-guide-app/electron/playbook/parser.ts` → `packages/@botame/player/`
3. `botame-guide-app/electron/playbook/interpolator.ts` → `packages/@botame/player/`
4. `botame-guide-app/electron/playbook/validator.ts` → `packages/@botame/player/`
5. `botame-admin/electron/services/playbook-runner.service.ts` → player 사용하도록 리팩토링
6. BrowserAdapter 인터페이스 도입

**검증:** 두 앱에서 플레이북 실행 테스트

### 단계 4: recorder 추출 (2-3일)

1. `botame-admin/electron/services/recording.service.ts`의 녹화 로직 → `packages/@botame/recorder/`
2. smart-selector 로직 통합
3. admin 앱에서 recorder 패키지 사용하도록 리팩토링

**검증:** admin 앱에서 녹화 기능 테스트

### 단계 5: 테스트 & 검증 (2-3일)

1. 각 패키지 유닛 테스트 작성
2. 통합 테스트 (두 앱 모두)
3. 가이드 앱 배포 시뮬레이션 (버전 고정 확인)

### 단계 6: 문서화 (1일)

1. 각 패키지 README.md
2. API 문서 (JSDoc)
3. 마이그레이션 가이드

**예상 총 소요 시간: 10-15일**

---

## 이점 요약

### 안정성

- ✅ guide 앱은 정확한 버전을 사용하여 배포
- ✅ admin 변경이 guide에 영향 없음
- ✅ 버그 수정은 packages/에서 한 번만

### 유지보수성

- ✅ 타입 정의가 하나로 통합
- ✅ 실행 엔진이 공유되어 중복 제거
- ✅ 명확한 패키지 경계

### 생산성

- ✅ 새로운 기능 추가 시 packages/에서만 작업
- ✅ 두 앱 모두 즉시 혜택
- ✅ 테스트가 패키지 단위로 격리

---

## 다음 단계

이 설계가 승인되면:

1. 구현 계획(Implementation Plan) 작성
2. Git Worktree 생성하여 독립 작업 공간 마련
3. 단계별로 마이그레이션 진행
