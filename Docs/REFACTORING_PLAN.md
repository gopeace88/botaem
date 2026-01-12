# 보탬e 아키텍처 리팩토링 기획서

> **버전**: 1.1.0  
> **작성일**: 2026-01-08  
> **상태**: Oracle 검토 완료

---

## 1. 현재 상태 분석

### 1.1 발견된 기술 부채

| 영역 | 문제점 | 영향도 |
|------|--------|--------|
| **타입 중복** | `StepResult`, `RunnerState`가 서비스/스토어에 중복 정의 | 높음 |
| **IPC 채널** | 문자열 리터럴 중복 (`main.ts` + `preload.ts`) | 중간 |
| **Self-healing** | v1-v4 복잡도 과도 (1,200줄), 전략 혼재 | 높음 |
| **any 남용** | `self-healing.ts`, `snapshot.service.ts` 등 | 중간 |
| **main.ts 과부하** | 400줄, 모든 IPC/서비스/부트스트랩 집중 | 높음 |
| **코드 공유 부재** | `botame-admin`과 `botame-guide-app` 간 중복 구현 | 높음 |

### 1.2 아키텍처 평가

```
적합한 선택 (유지):
- Electron + Playwright: 브라우저 자동화에 최적
- React: 관리 UI에 적합
- Supabase: 동기화 및 인증에 충분

개선 필요:
- Self-healing v1-v4 복잡도 → 모듈화 (단순 삭제 아님)
- 공유 코드 부재 → 패키지 분리
- 실행 아티팩트 수집 부족 → trace/log 강화
- 보안 강화 필요 → 자격증명 관리, Electron 하드닝
```

### 1.3 기술 스택 검토 결과 (2026년 기준)

| 기술 | 대안 검토 | 결론 |
|------|----------|------|
| **Electron** | Tauri 2.x | **Electron 유지** - Tauri는 Playwright 통합 부재 |
| **Playwright** | browser-use, AI 자동화 | **Playwright 유지** - 결정론적 자동화에 최적 |
| **Zustand** | Jotai, Redux Toolkit | **Zustand 유지** - Electron+React에 적합 |
| **Supabase** | - | **유지** - 동기화/인증에 충분 |

> **참고**: LLM 기반 자동화(browser-use 등)는 유망하나, 정부 시스템에서 요구하는 
> 재현성/감사성이 부족하여 **보조 도구로만 활용** 권장

---

## 2. 리팩토링 목표

### 2.1 핵심 목표

1. **공유 패키지 분리**: `packages/core`로 실행 엔진 통합
2. **Self-healing 모듈화**: 1,200줄 → 모듈 파이프라인 (v4 유지)
3. **타입 안전성 강화**: IPC 채널, 공유 타입 중앙화
4. **실행 아티팩트**: Playwright trace, 로그 수집 체계화
5. **보안 강화**: 자격증명 관리, Electron 하드닝
6. **플레이북 계층 단순화**: 4레벨 → 2~3레벨

### 2.2 비목표 (하지 않을 것)

- Electron/Playwright 교체 (적합한 선택)
- 전체 재작성 (점진적 리팩토링)
- UI 변경 (기능 유지)

---

## 3. 신규 패키지 구조

### 3.1 모노레포 구조

```
02.보탬e/
├── packages/
│   ├── core/                        # 공유 실행 코어
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── types/               # 통합 타입 정의
│   │       │   ├── index.ts
│   │       │   ├── playbook.ts      # Playbook, Step, Metadata
│   │       │   ├── execution.ts     # StepResult, RunnerState
│   │       │   ├── selector.ts      # SmartSelector, SelectorStrategy
│   │       │   └── healing.ts       # HealingRecord, HealMethod
│   │       │
│   │       ├── ipc/                 # 타입 안전 IPC 정의
│   │       │   ├── channels.ts      # 채널 상수
│   │       │   └── types.ts         # 요청/응답 타입
│   │       │
│   │       ├── playbook/            # 플레이북 파서/검증
│   │       │   ├── parser.ts
│   │       │   ├── validator.ts
│   │       │   └── resolver.ts      # includes 해석기
│   │       │
│   │       ├── selector/            # 셀렉터 생성/매칭
│   │       │   ├── generator.ts     # SmartSelector 생성
│   │       │   ├── matcher.ts       # 매칭 로직
│   │       │   └── priority.ts      # 우선순위 정의
│   │       │
│   │       └── self-healing/        # 단순화된 Self-healing
│   │           ├── engine.ts        # 메인 엔진
│   │           ├── strategies/      # 전략별 분리
│   │           │   ├── identity.ts  # v3 Identity 매칭
│   │           │   ├── playwright.ts # Playwright 로케이터
│   │           │   ├── fallback.ts  # 폴백 셀렉터
│   │           │   └── coordinates.ts
│   │           └── index.ts
│   │
│   └── shared-ui/                   # (Phase 2) 공유 UI 컴포넌트
│       └── ...
│
├── botame-admin/                    # 관리자 앱
│   ├── package.json                 # @botame/core 의존
│   ├── electron/
│   │   ├── main.ts                  # 단순화 (IPC 라우터만)
│   │   ├── ipc/                     # IPC 핸들러 분리
│   │   │   ├── playbook.handlers.ts
│   │   │   ├── recording.handlers.ts
│   │   │   └── browser.handlers.ts
│   │   └── services/
│   │       ├── playbook-runner.service.ts  # @botame/core 활용
│   │       └── recording.service.ts
│   └── src/
│       └── ...
│
└── botame-guide-app/                # 사용자 앱
    ├── package.json                 # @botame/core 의존
    └── electron/
        ├── playbook/
        │   └── engine.ts            # @botame/core 활용
        └── ...
```

### 3.2 패키지 의존 관계

```
┌─────────────────┐     ┌─────────────────┐
│  botame-admin   │     │ botame-guide-app│
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
              ┌──────▼──────┐
              │ @botame/core │
              └─────────────┘
```

---

## 4. Self-healing 모듈화 (v4 유지)

### 4.1 현재 문제

```typescript
// 현재: 1,200줄, v1-v4 전략 혼재
// - SemanticStep, SemanticStepV3, SemanticStepV4 타입 분기
// - 10+ 전략이 순차적으로 시도됨
// - 디버깅 어려움
```

### 4.2 핵심 결정: v4 유지 ⚠️

> **Oracle 검토 결과**: v4 EnhancedFallbacks 삭제는 성공률 저하 위험
> 
> v4가 제공하는 정부 시스템 필수 전략:
> - `nearbyLabelSelectors`: 라벨 근처 input/select (정부 폼 핵심)
> - `parentChainSelectors`: 안정 조상 + 상대 자식 (동적 ID 대응)
> - `structuralPosition`: 폼 내 순서 (eXBuilder 대응)
> - `textPatterns`: 텍스트 정규화 (한글 띄어쓰기 등)

### 4.3 신규 우선순위 (5단계 파이프라인)

```
┌─────────────────────────────────────────────────────────────────────┐
│                Self-healing 전략 파이프라인 (수정됨)                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Identity (v3) - Accessibility-First                             │
│     └─ getByRole(role, { name }) // 가장 안정적                       │
│                                                                     │
│  2. Playwright Locators                                             │
│     └─ getByLabel() > getByPlaceholder() > getByText() > getByTestId()│
│                                                                     │
│  3. Fallback Selectors (v2)                                         │
│     └─ SmartSelector.fallbacks 순차 시도                             │
│                                                                     │
│  4. Structural Module (v4) ✅ 유지                                   │
│     ├─ nearbyLabelSelectors: 라벨 기반 input 탐색                    │
│     ├─ parentChainSelectors: 안정 조상 + 상대 자식                   │
│     ├─ structuralPosition: nth-of-type, 폼 내 순서                   │
│     └─ textPatterns: 텍스트 정규화/변형                              │
│                                                                     │
│  5. Coordinates (최후 수단)                                          │
│     └─ 녹화 시점 좌표 클릭                                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.4 모듈화된 엔진 설계

```typescript
// packages/core/src/self-healing/engine.ts

export interface HealingResult {
  success: boolean;
  locator?: Locator;
  strategy: HealStrategy;
  selector?: string;
  record?: HealingRecord;
}

export type HealStrategy = 
  | 'identity'      // v3 Accessibility
  | 'playwright'    // getByRole, getByLabel, etc.
  | 'fallback'      // v2 SmartSelector fallbacks
  | 'structural'    // v4 구조적 폴백 (유지!)
  | 'coordinates';  // 좌표 기반

export class SelfHealingEngine {
  private strategies: HealingStrategy[];
  
  constructor(private page: Page) {
    // 5단계 파이프라인 (v4 structural 포함)
    this.strategies = [
      new IdentityStrategy(page),        // 1. v3 accessibility
      new PlaywrightLocatorStrategy(page), // 2. Playwright 로케이터
      new FallbackStrategy(page),         // 3. v2 SmartSelector
      new StructuralStrategy(page),       // 4. v4 구조적 폴백 ✅
      new CoordinatesStrategy(page),      // 5. 좌표 (최후)
    ];
  }

  async findElement(step: SemanticStep): Promise<HealingResult> {
    for (const strategy of this.strategies) {
      const result = await strategy.find(step);
      if (result.success) {
        this.recordHealing(step, result);
        return result;
      }
    }
    return { success: false, strategy: 'coordinates' };
  }
}
```

### 4.5 전략별 모듈 분리

```
packages/core/src/self-healing/
├── engine.ts              # 파이프라인 오케스트레이터
├── types.ts               # 공통 타입
├── strategies/
│   ├── base.ts           # 전략 인터페이스
│   ├── identity.ts       # v3 Accessibility 매칭
│   ├── playwright.ts     # Playwright 로케이터
│   ├── fallback.ts       # v2 SmartSelector
│   ├── structural.ts     # v4 구조적 폴백 ✅
│   │   ├── nearby-label.ts
│   │   ├── parent-chain.ts
│   │   ├── position.ts
│   │   └── text-pattern.ts
│   └── coordinates.ts    # 좌표 기반
└── index.ts
```

### 4.6 정부 시스템 특화 전략 추가

eXBuilder6/Cleopatra 기반 사이트 대응:

```typescript
// packages/core/src/self-healing/strategies/structural.ts

export class StructuralStrategy implements HealingStrategy {
  // 1. Frame-aware 탐색
  async findInCorrectFrame(step: SemanticStep): Promise<Locator | null> {
    if (step.frameContext) {
      const frame = this.page.frameLocator(step.frameContext);
      return this.findInFrame(frame, step);
    }
    return null;
  }

  // 2. Landmark anchoring
  async findByLandmark(step: SemanticStep): Promise<Locator | null> {
    const { parentChain } = step.structuralPosition || {};
    if (!parentChain) return null;
    
    // 안정적인 landmark 조상 찾기
    const landmark = parentChain.find(p => p.isLandmark || p.isForm);
    if (landmark) {
      return this.page.locator(landmark.selector)
        .locator(step.identity?.tagName || '*');
    }
    return null;
  }

  // 3. Widget adapters (특수 위젯 처리)
  async findInWidget(step: SemanticStep): Promise<Locator | null> {
    // eXBuilder 콤보박스, 그리드 셀 등 특수 처리
    const widgetType = this.detectWidgetType(step);
    if (widgetType) {
      return this.widgetAdapters[widgetType]?.find(step);
    }
    return null;
  }
}
```

### 4.7 마이그레이션 전략

| 단계 | 작업 | 영향 |
|------|------|------|
| 1 | `packages/core/self-healing` 모듈 구조 생성 | 없음 |
| 2 | 기존 v3/v4 로직을 전략별 모듈로 분리 | 없음 (동작 동일) |
| 3 | `botame-guide-app`에서 먼저 적용 | 낮음 |
| 4 | 성공률 측정 후 `botame-admin` 적용 | 중간 |
| 5 | 기존 `self-healing.ts` 제거 | - |

### 4.8 성공률 모니터링

v4 유지 결정을 검증하기 위한 측정:

```typescript
// 실행 시 healing 통계 수집
interface HealingStats {
  total: number;
  byStrategy: Record<HealStrategy, number>;
  successRate: number;
}

// 전략별 성공률이 5% 미만이면 해당 전략 제거 검토
// 전략별 성공률이 20% 이상이면 유지 필수
```

---

## 5. IPC 타입 안전성

### 5.1 현재 문제

```typescript
// main.ts
ipcMain.handle('playbook:run', async (_, playbook, startUrl) => { ... });

// preload.ts  
ipcRenderer.invoke('playbook:run', playbook, startUrl);

// 문제점:
// - 채널명 오타 → 런타임 에러
// - 파라미터 타입 보장 없음
// - 응답 타입 추론 불가
```

### 5.2 신규 설계

```typescript
// packages/core/src/ipc/channels.ts

export const IPC_CHANNELS = {
  PLAYBOOK: {
    RUN: 'playbook:run',
    STOP: 'playbook:stop',
    LIST: 'playbook:list',
    SAVE: 'playbook:save',
    DELETE: 'playbook:delete',
  },
  RECORDING: {
    START: 'recording:start',
    STOP: 'recording:stop',
    PAUSE: 'recording:pause',
    RESUME: 'recording:resume',
  },
  BROWSER: {
    CONNECT: 'browser:connect',
    DISCONNECT: 'browser:disconnect',
    NAVIGATE: 'browser:navigate',
  },
} as const;

// packages/core/src/ipc/types.ts

import { IPC_CHANNELS } from './channels';
import { Playbook, StepResult, IpcResult } from '../types';

// 요청/응답 타입 매핑
export interface IpcHandlerMap {
  [IPC_CHANNELS.PLAYBOOK.RUN]: {
    request: { playbook: Playbook; startUrl?: string };
    response: IpcResult<StepResult[]>;
  };
  [IPC_CHANNELS.PLAYBOOK.LIST]: {
    request: void;
    response: IpcResult<PlaybookListItem[]>;
  };
  // ...
}

// 타입 안전 invoke 헬퍼
export type IpcChannel = keyof IpcHandlerMap;

export function createTypedInvoke(ipcRenderer: IpcRenderer) {
  return async function invoke<C extends IpcChannel>(
    channel: C,
    request: IpcHandlerMap[C]['request']
  ): Promise<IpcHandlerMap[C]['response']> {
    return ipcRenderer.invoke(channel, request);
  };
}
```

### 5.3 사용 예시

```typescript
// botame-admin/electron/preload.ts
import { IPC_CHANNELS, createTypedInvoke } from '@botame/core/ipc';

const invoke = createTypedInvoke(ipcRenderer);

const api = {
  runPlaybook: (playbook: Playbook, startUrl?: string) =>
    invoke(IPC_CHANNELS.PLAYBOOK.RUN, { playbook, startUrl }),
  
  listPlaybooks: () =>
    invoke(IPC_CHANNELS.PLAYBOOK.LIST, undefined),
};

// 타입 안전성: 
// - 채널명 오타 → 컴파일 에러
// - 잘못된 파라미터 → 컴파일 에러
// - 응답 타입 자동 추론
```

---

## 6. main.ts 분리

### 6.1 현재 구조 (400줄)

```typescript
// main.ts 현재: 모든 것이 한 파일에
- 서비스 인스턴스 생성
- 윈도우 생성
- IPC 핸들러 40개+
- 이벤트 리스너
- 부트스트랩 로직
```

### 6.2 신규 구조

```
botame-admin/electron/
├── main.ts                    # 50줄 이하, 진입점만
├── bootstrap.ts               # 서비스 초기화, 윈도우 생성
├── ipc/
│   ├── index.ts              # IPC 라우터
│   ├── playbook.handlers.ts  # 플레이북 관련 핸들러
│   ├── recording.handlers.ts # 녹화 관련 핸들러
│   └── browser.handlers.ts   # 브라우저 관련 핸들러
└── services/
    └── ...
```

```typescript
// main.ts (신규: 50줄 이하)
import { app, BrowserWindow } from 'electron';
import { bootstrap } from './bootstrap';
import { registerIpcHandlers } from './ipc';

let mainWindow: BrowserWindow | null = null;

app.whenReady().then(async () => {
  mainWindow = await bootstrap();
  registerIpcHandlers(mainWindow);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

---

## 7. 플레이북 계층 단순화 (4레벨 → 2~3레벨)

### 7.1 기존 계획의 문제점

> **Oracle 검토 결과**: 4레벨 계층은 운영 부담 과다
>
> 문제점:
> - 버전/마이그레이션 복잡도 증가
> - 소유권 불명확 ("어디서 고쳐야 하지?")
> - 깊은 체인 디버깅 어려움

### 7.2 단순화된 계층 구조 (2~3레벨)

```
┌─────────────────────────────────────────────────────────────────────┐
│                  플레이북 계층 구조 (단순화됨)                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Level A: Scenario (시나리오) - 실제 실행 단위                        │
│  ─────────────────────────────────────────────────────────────────  │
│  │ 예: "전자세금계산서 집행등록", "카드사용내역 집행등록"               │
│  │                                                                  │
│  │ 특징:                                                            │
│  │ - 사용자가 실제로 실행하는 단위                                   │
│  │ - 모든 스텝이 이 레벨에 직접 포함                                 │
│  │ - includes 없이 flat structure 유지                              │
│  └──────────────────────────────────────────────────────────────────│
│                                      │                              │
│                                      ▼                              │
│  Level B: Aliases (자연어 매핑)                                      │
│  ─────────────────────────────────────────────────────────────────  │
│  │ 예: "세금계산서 처리해줘" → scenario-tax-invoice-register         │
│  │     "카드값 정리" → scenario-card-expense-register               │
│  │                                                                  │
│  │ 특징:                                                            │
│  │ - 시나리오당 5~10개 자연어 별칭                                   │
│  │ - LLM 또는 키워드 매칭으로 시나리오 선택                          │
│  └──────────────────────────────────────────────────────────────────│
│                                                                     │
│  ❌ 제거: Level 1 (원자적), Level 2 (기능 단위)                       │
│     → 재사용 필요성이 증명되면 그때 도입                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.3 왜 "기능 단위" 레벨을 제거하는가?

```
기존 계획:
  Level 2 (func-login) = [atomic-type-userid, atomic-type-password, atomic-click-login]
  
  문제점:
  - 로그인 스텝이 다른 시나리오에서 완전히 동일할 확률 낮음
  - 스텝 하나 바꾸려면 어느 레벨을 수정해야 하는지 혼란
  - includes 체인 디버깅 복잡

신규 계획:
  각 시나리오에 로그인 스텝 직접 포함 (중복 허용)
  
  장점:
  - 시나리오 자체가 완결적 (외부 의존 없음)
  - 수정 시 해당 시나리오만 변경
  - 디버깅 단순

  단점:
  - 스텝 중복 → 허용 가능 (저장 비용 미미)
```

### 7.4 재사용이 필요한 경우

재사용 압력이 증명되면 **인라인 템플릿**으로 해결:

```yaml
# scenario-tax-invoice-register.yaml

id: "scenario-tax-invoice-register"
level: "scenario"

steps:
  # 로그인 템플릿 인라인 확장 (includes 아님)
  - template: "common/login"
    variables:
      user_id: "{{user_id}}"
      password: "{{password}}"
  
  # 이후 스텝들
  - action: "click"
    selector: '[aria-label="집행관리"]'
    message: "집행관리 메뉴 클릭"
  # ...

aliases:
  - "세금계산서 처리"
  - "전자세금계산서 집행"
```

```yaml
# common/login.yaml (템플릿, 별도 레벨 아님)

# 이 파일은 scenario에 인라인 확장됨
# 독립 실행 불가, 카탈로그에 표시 안됨

steps:
  - action: "navigate"
    value: "https://www.losims.go.kr/lss.do"
  - action: "type"
    selector: "#userId"
    value: "{{user_id}}"
  - action: "type"
    selector: "#password"
    value: "{{password}}"
  - action: "click"
    selector: '[aria-label="로그인"]'
```

### 7.5 플레이북 해석기 (단순화)

```typescript
// packages/core/src/playbook/resolver.ts

export interface ResolvedPlaybook {
  id: string;
  level: 'scenario';  // 단일 레벨만 지원
  steps: ResolvedStep[];
  aliases: string[];
}

export class PlaybookResolver {
  private templateCache = new Map<string, PlaybookStep[]>();
  
  async resolve(playbookId: string): Promise<ResolvedPlaybook> {
    const playbook = await this.loader.load(playbookId);
    const steps: ResolvedStep[] = [];
    
    for (const step of playbook.steps) {
      if (step.template) {
        // 템플릿 인라인 확장 (레벨이 아닌 단순 복사)
        const templateSteps = await this.loadTemplate(step.template);
        const expanded = this.applyVariables(templateSteps, step.variables);
        steps.push(...expanded);
      } else {
        steps.push(step);
      }
    }
    
    return {
      id: playbookId,
      level: 'scenario',
      steps,
      aliases: playbook.aliases || [],
    };
  }
}
```

### 7.6 DB 스키마 (단순화)

```sql
-- 기존 playbooks 테이블 (level 컬럼 제거 또는 기본값 고정)
-- level은 모두 'scenario'로 통일

-- 자연어 별칭은 playbooks 테이블에 JSONB로 포함
ALTER TABLE playbooks ADD COLUMN aliases TEXT[] DEFAULT '{}';

-- 별도 테이블 불필요 (단순화)
-- CREATE TABLE playbook_aliases ... (제거)

-- 별칭 검색 인덱스
CREATE INDEX idx_playbooks_aliases 
ON playbooks USING gin(aliases);
```

### 7.7 Phase 2에서 계층 확장 조건

4레벨 계층 도입은 다음 조건이 **모두** 충족될 때만 검토:

| 조건 | 기준 |
|------|------|
| 시나리오 수 | 50개 이상 |
| 동일 스텝 시퀀스 반복 | 5개 이상 시나리오에서 동일 |
| 다중 작성자 | 3명 이상 동시 작업 |
| 거버넌스 요구 | 승인 워크플로우 필요 |

**현재는 단일 레벨(시나리오) + 템플릿으로 충분**

---

## 8. 실행 아티팩트 수집

### 8.1 수집 대상

| 아티팩트 | 용도 | 저장 방식 |
|----------|------|----------|
| **Playwright Trace** | 실행 디버깅, 재생 | `.zip` 파일 |
| **스크린샷** | 각 스텝 완료 시점 | `.png` (S3/로컬) |
| **Console 로그** | 에러 추적 | JSON |
| **Network 로그** | API 호출 분석 | HAR 또는 JSON |
| **Healing 기록** | 셀렉터 안정성 분석 | DB 저장 |

### 8.2 수집 설계

```typescript
// packages/core/src/execution/artifacts.ts

export interface ExecutionArtifacts {
  executionId: string;
  playbookId: string;
  startedAt: Date;
  completedAt?: Date;
  
  // Playwright trace
  tracePath?: string;
  
  // 스텝별 결과
  stepResults: StepArtifact[];
  
  // 전체 로그
  consoleLog: ConsoleEntry[];
  networkLog: NetworkEntry[];
  
  // 치유 기록
  healingRecords: HealingRecord[];
}

export interface StepArtifact {
  stepId: string;
  stepIndex: number;
  status: StepStatus;
  duration: number;
  
  // 스크린샷 (성공/실패 모두)
  screenshotBefore?: string;
  screenshotAfter?: string;
  
  // 치유 정보
  healed?: boolean;
  healMethod?: HealStrategy;
  originalSelector?: string;
  usedSelector?: string;
}

export class ArtifactCollector {
  private context: BrowserContext;
  private artifacts: ExecutionArtifacts;
  
  async startTracing(): Promise<void> {
    await this.context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: true,
    });
  }
  
  async stopTracing(savePath: string): Promise<void> {
    await this.context.tracing.stop({ path: savePath });
    this.artifacts.tracePath = savePath;
  }
  
  captureConsole(page: Page): void {
    page.on('console', msg => {
      this.artifacts.consoleLog.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now(),
      });
    });
  }
  
  captureNetwork(page: Page): void {
    page.on('response', async response => {
      this.artifacts.networkLog.push({
        url: response.url(),
        status: response.status(),
        method: response.request().method(),
        timestamp: Date.now(),
      });
    });
  }
}
```

---

## 9. 보안 강화

### 9.1 자격증명 관리

정부 시스템 자격증명 보안은 필수:

```
┌─────────────────────────────────────────────────────────────────────┐
│                      자격증명 보안 원칙                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ❌ 절대 금지:                                                       │
│  ├─ 플레이북 파일에 비밀번호 평문 저장                               │
│  ├─ 로그에 자격증명 출력                                            │
│  ├─ 렌더러 상태(Zustand)에 비밀번호 저장                            │
│  └─ 스크린샷에 비밀번호 필드 노출                                    │
│                                                                     │
│  ✅ 권장 방식:                                                       │
│  ├─ OS 자격증명 저장소 사용 (keytar 라이브러리)                      │
│  │   └─ Windows: Credential Manager                                │
│  │   └─ macOS: Keychain                                            │
│  │   └─ Linux: libsecret                                           │
│  ├─ 민감 스텝에 "사용자 직접 입력" 게이트 적용                       │
│  └─ 비밀번호 필드 스크린샷 자동 마스킹                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.2 구현 예시

```typescript
// packages/core/src/security/credential-store.ts

import keytar from 'keytar';

const SERVICE_NAME = 'botame-guide';

export class CredentialStore {
  async save(account: string, password: string): Promise<void> {
    await keytar.setPassword(SERVICE_NAME, account, password);
  }

  async get(account: string): Promise<string | null> {
    return keytar.getPassword(SERVICE_NAME, account);
  }

  async delete(account: string): Promise<boolean> {
    return keytar.deletePassword(SERVICE_NAME, account);
  }
}

// 플레이북 스텝에서 사용
interface SecureStep extends PlaybookStep {
  // 자격증명 참조 (값이 아닌 키)
  credentialRef?: string;  // "losims-login"
  
  // 사용자 입력 게이트
  requireUserInput?: boolean;
  inputMask?: boolean;  // 입력 시 마스킹
}
```

### 9.3 Electron 하드닝

```typescript
// botame-admin/electron/main.ts

const mainWindow = new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,        // ✅ 이미 적용됨
    contextIsolation: true,        // ✅ 이미 적용됨
    sandbox: true,                 // 추가 권장
    webSecurity: true,             // 추가 권장
  },
});

// CSP 헤더 추가
session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': [
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
      ],
    },
  });
});
```

### 9.4 IPC 런타임 검증

타입 안전 IPC에 추가로 런타임 검증:

```typescript
// packages/core/src/ipc/validators.ts

import { z } from 'zod';

// 고위험 채널 스키마 정의
const PlaybookRunSchema = z.object({
  playbook: z.object({
    metadata: z.object({ id: z.string() }),
    steps: z.array(z.object({ action: z.string() })),
  }),
  startUrl: z.string().url().optional(),
});

// 런타임 검증 미들웨어
export function validateIpcRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`IPC validation failed: ${result.error.message}`);
  }
  return result.data;
}

// 사용 예시
ipcMain.handle(IPC_CHANNELS.PLAYBOOK.RUN, async (_, request) => {
  const validated = validateIpcRequest(PlaybookRunSchema, request);
  return runnerService.run(validated.playbook, validated.startUrl);
});
```

### 9.5 프로덕션 설정

```typescript
// 프로덕션 빌드 시 적용

if (process.env.NODE_ENV === 'production') {
  // DevTools 비활성화
  app.on('web-contents-created', (_, contents) => {
    contents.on('devtools-opened', () => {
      contents.closeDevTools();
    });
  });
  
  // Electron Fuses 설정 (electron-builder.yml)
  // runAsNode: false
  // enableNodeCliInspectArguments: false
}
```

### 9.6 보안 체크리스트

| 항목 | 상태 | 우선순위 |
|------|------|----------|
| nodeIntegration: false | ✅ 적용됨 | - |
| contextIsolation: true | ✅ 적용됨 | - |
| IPC allowlist | ✅ 적용됨 | - |
| CSP 헤더 | ⬜ 미적용 | 높음 |
| OS 자격증명 저장소 | ⬜ 미적용 | 높음 |
| IPC 런타임 검증 | ⬜ 미적용 | 중간 |
| 프로덕션 DevTools 차단 | ⬜ 미적용 | 중간 |
| 스크린샷 비밀번호 마스킹 | ⬜ 미적용 | 중간 |

---

## 10. 구현 로드맵 (수정됨)

### Phase 1: 기반 구축 (2주)

| 작업 | 상세 | 우선순위 |
|------|------|----------|
| 모노레포 설정 | pnpm workspace, tsconfig paths | 높음 |
| `@botame/core` 패키지 생성 | 빈 패키지, 빌드 파이프라인 | 높음 |
| 타입 통합 | `shared/types.ts` → `@botame/core/types` | 높음 |
| IPC 채널 정의 | 상수 + 타입 맵 + 런타임 검증 | 높음 |

### Phase 2: Self-healing 모듈화 (2주)

| 작업 | 상세 |
|------|------|
| 모듈 구조 생성 | `strategies/` 디렉토리, 인터페이스 |
| v3 Identity 모듈 | 기존 로직 추출 |
| v4 Structural 모듈 | **유지 - 삭제 안함** |
| 파이프라인 엔진 | 5단계 전략 오케스트레이터 |
| 성공률 측정 추가 | 전략별 통계 수집 |
| `botame-guide-app` 적용 | 먼저 단순한 앱에 적용 |
| 회귀 테스트 | 기존 플레이북으로 검증 |

### Phase 3: 보안 + IPC 타입 안전 (1주)

| 작업 | 상세 |
|------|------|
| OS 자격증명 저장소 | keytar 도입, CredentialStore |
| CSP 헤더 추가 | Electron 보안 강화 |
| IPC 핸들러 분리 | `ipc/*.handlers.ts` |
| 타입 안전 invoke | `createTypedInvoke` 적용 |
| 런타임 검증 | zod 스키마 검증 |
| main.ts 슬림화 | 50줄 이하로 |

### Phase 4: 플레이북 단순화 + 아티팩트 (2주)

| 작업 | 상세 |
|------|------|
| PlaybookResolver | 템플릿 인라인 확장 (계층 아님) |
| aliases 통합 | playbooks 테이블에 JSONB로 |
| ArtifactCollector | trace, screenshot, log |
| 스크린샷 마스킹 | 비밀번호 필드 자동 블러 |
| 실행 결과 저장 | Supabase에 아티팩트 메타 |

### Phase 5: 통합 이관 (1주)

| 작업 | 상세 |
|------|------|
| botame-admin 이관 | @botame/core 완전 적용 |
| 기존 코드 제거 | self-healing.ts, shared/types.ts |
| 프로덕션 하드닝 | DevTools 차단, Fuses |
| 통합 테스트 | 전체 기능 검증 |
| 성공률 리포트 | 전략별 효과 분석 |

---

## 11. 리스크 및 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| ~~Self-healing 단순화로 매칭 실패율 증가~~ | ~~높음~~ | ✅ v4 유지로 해결 |
| 모노레포 빌드 복잡도 | 중간 | pnpm workspace로 시작, 필요시 turborepo |
| 기존 플레이북 호환성 | 높음 | SemanticStep 하위 호환 유지 |
| ~~4레벨 계층 운영 복잡도~~ | ~~높음~~ | ✅ 2~3레벨로 단순화 |
| 자격증명 보안 누락 | 높음 | Phase 3에서 keytar 필수 적용 |
| 동시 개발 충돌 | 낮음 | feature branch 전략 |

---

## 12. 성공 기준

### 정량적 기준

| 지표 | 현재 | 목표 |
|------|------|------|
| Self-healing 코드 | 1,200줄 (단일 파일) | 5개 모듈 × 150줄 이하 |
| main.ts 줄 수 | 400줄 | 50줄 이하 |
| 타입 any 사용 | 다수 | 0개 |
| 코드 공유율 | 0% | 60%+ (실행 코어) |
| Self-healing 성공률 | 측정 안됨 | 95%+ (curated 시나리오) |
| 보안 체크리스트 | 3/8 | 8/8 |

### 정성적 기준

- [ ] 신규 개발자가 Self-healing 로직을 30분 내 이해
- [ ] IPC 채널 오타로 인한 버그 0건
- [ ] 실행 실패 시 trace로 원인 즉시 파악 가능
- [ ] 자격증명이 평문으로 저장되는 곳 0건

### 에스컬레이션 트리거

다음 상황 시 계획 재검토:

| 상황 | 조치 |
|------|------|
| Self-healing 성공률 < 95% | v4 structural 모듈 강화 또는 AI 폴백 검토 |
| 시나리오 50개 이상 + 동일 스텝 반복 | 계층 구조 재도입 검토 |
| 다중 작성자 (3명+) 동시 작업 | Turborepo/Nx + 거버넌스 도입 |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 1.0.0 | 2026-01-08 | 초기 기획 완료 |
| 1.1.0 | 2026-01-08 | Oracle 검토 반영: v4 유지, 계층 단순화, 보안 강화 |
