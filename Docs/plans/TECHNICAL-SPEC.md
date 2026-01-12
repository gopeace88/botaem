# 기술 스펙 문서: 보탬e AI 가이드 어시스턴트

> 버전: 1.0
> 작성일: 2025-01-30
> 상태: Draft

---

## 1. 시스템 개요

### 1.1 아키텍처 요약

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         사용자 PC (Windows)                              │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Electron Desktop App                          │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │   │
│  │  │   React UI       │  │  Playbook Engine │  │  Playwright   │  │   │
│  │  │  (Renderer)      │  │  (State Machine) │  │  Controller   │  │   │
│  │  └────────┬─────────┘  └────────┬─────────┘  └───────┬───────┘  │   │
│  │           │                     │                     │          │   │
│  │           └──────────────┬──────┴─────────────────────┘          │   │
│  │                          │                                       │   │
│  │                    ┌─────┴─────┐                                 │   │
│  │                    │  IPC Bus  │                                 │   │
│  │                    └─────┬─────┘                                 │   │
│  │                          │                                       │   │
│  │  ┌──────────────────┐    │    ┌──────────────────┐              │   │
│  │  │  Local Storage   │────┴────│  Cloud Service   │              │   │
│  │  │  (SQLite/JSON)   │         │     Client       │              │   │
│  │  └──────────────────┘         └────────┬─────────┘              │   │
│  └─────────────────────────────────────────┼────────────────────────┘   │
└────────────────────────────────────────────┼────────────────────────────┘
                                             │ HTTPS
                                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Cloud (Supabase)                              │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐              │
│  │  Auth Service │  │  PostgreSQL   │  │    Storage    │              │
│  │  (Supabase)   │  │  + pgvector   │  │  (Playbooks)  │              │
│  └───────────────┘  └───────────────┘  └───────────────┘              │
│                                                                         │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐              │
│  │  Edge Func.   │  │  Claude API   │  │   RAG/Vector  │              │
│  │  (API Routes) │  │   Gateway     │  │    Search     │              │
│  └───────────────┘  └───────────────┘  └───────────────┘              │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 기술 스택

| 계층 | 기술 | 버전 | 용도 |
|------|------|------|------|
| **Desktop** | Electron | 28.x | 데스크톱 앱 프레임워크 |
| **UI** | React | 18.x | 사용자 인터페이스 |
| **UI 라이브러리** | shadcn/ui | latest | 컴포넌트 라이브러리 |
| **상태관리** | Zustand | 4.x | 글로벌 상태 관리 |
| **브라우저 제어** | Playwright | 1.40+ | 브라우저 자동화 |
| **로컬 DB** | SQLite (better-sqlite3) | 9.x | 로컬 캐시/설정 |
| **빌드** | Vite | 5.x | 번들링, 개발 서버 |
| **언어** | TypeScript | 5.x | 타입 안전성 |
| **Cloud** | Supabase | - | Auth, DB, Storage, Edge Functions |
| **AI** | Claude API | 2024-01 | LLM 처리 |
| **벡터 검색** | pgvector | 0.5+ | 유사도 검색 |

---

## 2. 로컬앱 상세 설계

### 2.1 프로젝트 구조

```
botame-guide-app/
├── electron/                    # Electron 메인 프로세스
│   ├── main.ts                  # 앱 엔트리포인트
│   ├── preload.ts               # 컨텍스트 브릿지
│   ├── ipc/                     # IPC 핸들러
│   │   ├── playbook.handler.ts
│   │   ├── playwright.handler.ts
│   │   ├── auth.handler.ts
│   │   └── sync.handler.ts
│   ├── playwright/              # Playwright 컨트롤러
│   │   ├── browser.controller.ts
│   │   ├── page.controller.ts
│   │   └── highlight.controller.ts
│   ├── playbook/                # 플레이북 엔진
│   │   ├── parser.ts            # YAML 파서
│   │   ├── validator.ts         # 스키마 검증
│   │   └── engine.ts            # 상태 머신
│   ├── services/                # 서비스 계층
│   │   ├── step-verifier.ts     # Step 검증 (DOM + Vision)
│   │   ├── claude-vision.service.ts  # Vision API 호출
│   │   └── botame.automation.ts # 브라우저 자동화
│   └── storage/                 # 로컬 저장소
│       ├── sqlite.ts
│       └── config.ts
├── src/                         # React 렌더러 프로세스
│   ├── components/              # UI 컴포넌트
│   │   ├── chat/                # 채팅 UI
│   │   ├── guide/               # 가이드 오버레이
│   │   ├── workflow/            # 워크플로우 표시
│   │   └── common/              # 공통 컴포넌트
│   ├── hooks/                   # 커스텀 훅
│   │   ├── usePlaybook.ts
│   │   ├── useChat.ts
│   │   └── useAuth.ts
│   ├── stores/                  # Zustand 스토어
│   │   ├── app.store.ts
│   │   ├── playbook.store.ts
│   │   └── chat.store.ts
│   ├── services/                # 서비스 계층
│   │   ├── api.service.ts
│   │   ├── sync.service.ts
│   │   └── analytics.service.ts
│   ├── pages/                   # 페이지 컴포넌트
│   │   ├── Home.tsx
│   │   ├── Chat.tsx
│   │   ├── Settings.tsx
│   │   └── Login.tsx
│   ├── types/                   # 타입 정의
│   │   ├── playbook.types.ts
│   │   ├── chat.types.ts
│   │   └── api.types.ts
│   └── utils/                   # 유틸리티
│       ├── format.ts
│       └── validation.ts
├── shared/                      # 공유 코드
│   ├── constants.ts
│   └── types.ts
├── tests/                       # 테스트
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── playbooks/                   # 로컬 플레이북 (개발/테스트용)
│   └── examples/
├── package.json
├── electron-builder.yml
├── vite.config.ts
└── tsconfig.json
```

### 2.2 Electron 프로세스 구조

#### 2.2.1 메인 프로세스 (electron/main.ts)

```typescript
// electron/main.ts
import { app, BrowserWindow, ipcMain } from 'electron';
import { PlaywrightController } from './playwright/browser.controller';
import { PlaybookEngine } from './playbook/engine';
import { registerIpcHandlers } from './ipc';

class Application {
  private mainWindow: BrowserWindow | null = null;
  private playwrightController: PlaywrightController;
  private playbookEngine: PlaybookEngine;

  async initialize(): Promise<void> {
    await app.whenReady();

    this.playwrightController = new PlaywrightController();
    this.playbookEngine = new PlaybookEngine(this.playwrightController);

    registerIpcHandlers(ipcMain, {
      playwrightController: this.playwrightController,
      playbookEngine: this.playbookEngine,
    });

    this.createMainWindow();
  }

  private createMainWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 400,
      height: 600,
      frame: false,
      alwaysOnTop: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
  }
}
```

#### 2.2.2 IPC 통신 인터페이스

```typescript
// shared/types.ts
export interface IpcChannels {
  // Playbook
  'playbook:load': (id: string) => Promise<Playbook>;
  'playbook:execute': (id: string, params?: Record<string, unknown>) => Promise<void>;
  'playbook:stop': () => Promise<void>;
  'playbook:list': () => Promise<PlaybookSummary[]>;

  // Playwright
  'browser:launch': (options?: BrowserOptions) => Promise<void>;
  'browser:navigate': (url: string) => Promise<void>;
  'browser:highlight': (selector: string) => Promise<void>;
  'browser:click': (selector: string) => Promise<void>;
  'browser:screenshot': () => Promise<string>; // base64

  // Auth
  'auth:login': (credentials: LoginCredentials) => Promise<AuthResult>;
  'auth:logout': () => Promise<void>;
  'auth:getSession': () => Promise<Session | null>;

  // Sync
  'sync:playbooks': () => Promise<SyncResult>;
  'sync:status': () => Promise<SyncStatus>;

  // Chat
  'chat:send': (message: ChatMessage) => Promise<ChatResponse>;
  'chat:history': () => Promise<ChatMessage[]>;
}
```

### 2.3 플레이북 엔진

#### 2.3.1 상태 머신

```typescript
// electron/playbook/engine.ts
import { createMachine, interpret, State } from 'xstate';

type PlaybookState =
  | 'idle'
  | 'loading'
  | 'executing'
  | 'waiting_user'
  | 'paused'
  | 'completed'
  | 'error';

interface PlaybookContext {
  playbook: Playbook | null;
  currentStep: number;
  variables: Record<string, unknown>;
  errors: Error[];
}

type PlaybookEvent =
  | { type: 'LOAD'; playbook: Playbook }
  | { type: 'START' }
  | { type: 'NEXT' }
  | { type: 'USER_ACTION'; data: unknown }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'STOP' }
  | { type: 'ERROR'; error: Error };

export class PlaybookEngine {
  private machine;
  private service;

  constructor(private playwright: PlaywrightController) {
    this.machine = createMachine<PlaybookContext, PlaybookEvent>({
      id: 'playbook',
      initial: 'idle',
      context: {
        playbook: null,
        currentStep: 0,
        variables: {},
        errors: [],
      },
      states: {
        idle: {
          on: { LOAD: 'loading' },
        },
        loading: {
          invoke: {
            src: 'loadPlaybook',
            onDone: 'executing',
            onError: 'error',
          },
        },
        executing: {
          invoke: {
            src: 'executeStep',
            onDone: [
              { target: 'waiting_user', cond: 'needsUserAction' },
              { target: 'completed', cond: 'isLastStep' },
              { target: 'executing', actions: 'nextStep' },
            ],
            onError: 'error',
          },
          on: {
            PAUSE: 'paused',
            STOP: 'idle',
          },
        },
        waiting_user: {
          on: {
            USER_ACTION: 'executing',
            STOP: 'idle',
          },
        },
        paused: {
          on: {
            RESUME: 'executing',
            STOP: 'idle',
          },
        },
        completed: {
          on: { LOAD: 'loading' },
          entry: 'onComplete',
        },
        error: {
          on: { LOAD: 'loading' },
          entry: 'onError',
        },
      },
    });

    this.service = interpret(this.machine);
  }
}
```

#### 2.3.2 스텝 실행기

```typescript
// electron/playbook/step-executor.ts
export class StepExecutor {
  constructor(private playwright: PlaywrightController) {}

  async execute(step: PlaybookStep, context: ExecutionContext): Promise<StepResult> {
    switch (step.action) {
      case 'navigate':
        return this.executeNavigate(step);
      case 'click':
        return this.executeClick(step);
      case 'type':
        return this.executeType(step);
      case 'wait':
        return this.executeWait(step);
      case 'highlight':
        return this.executeHighlight(step);
      case 'assert':
        return this.executeAssert(step);
      case 'guide':
        return this.executeGuide(step);
      default:
        throw new Error(`Unknown action: ${step.action}`);
    }
  }

  private async executeHighlight(step: PlaybookStep): Promise<StepResult> {
    const { selector, message, position } = step.params;

    // 하이라이트 오버레이 표시
    await this.playwright.highlight({
      selector,
      message,
      position: position || 'auto',
      style: {
        color: '#FF6B35',
        pulse: true,
      },
    });

    return { success: true, waitForUser: true };
  }

  private async executeGuide(step: PlaybookStep): Promise<StepResult> {
    const { text, options } = step.params;

    // 가이드 메시지 표시 (채팅 UI로 전송)
    this.emitGuideMessage({
      text,
      options,
      stepNumber: step.order,
    });

    return { success: true, waitForUser: false };
  }
}
```

### 2.4 Playwright 컨트롤러

```typescript
// electron/playwright/browser.controller.ts
import { chromium, Browser, Page, BrowserContext } from 'playwright';

export class PlaywrightController {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  async launch(options: LaunchOptions = {}): Promise<void> {
    this.browser = await chromium.launch({
      headless: false,
      args: ['--start-maximized'],
      ...options,
    });

    this.context = await this.browser.newContext({
      viewport: null, // 전체 화면
      ...options.contextOptions,
    });

    this.page = await this.context.newPage();
  }

  async navigate(url: string): Promise<void> {
    if (!this.page) throw new Error('Browser not launched');
    await this.page.goto(url, { waitUntil: 'networkidle' });
  }

  async highlight(options: HighlightOptions): Promise<void> {
    if (!this.page) throw new Error('Browser not launched');

    const { selector, message, position, style } = options;

    // 요소 찾기
    const element = await this.page.locator(selector).first();
    const box = await element.boundingBox();

    if (!box) throw new Error(`Element not found: ${selector}`);

    // 하이라이트 오버레이 주입
    await this.page.evaluate(
      ({ box, message, position, style }) => {
        // 기존 하이라이트 제거
        document.querySelectorAll('.botame-highlight').forEach(el => el.remove());

        // 하이라이트 요소 생성
        const overlay = document.createElement('div');
        overlay.className = 'botame-highlight';
        overlay.innerHTML = `
          <div class="botame-highlight-box" style="
            position: absolute;
            left: ${box.x - 4}px;
            top: ${box.y - 4}px;
            width: ${box.width + 8}px;
            height: ${box.height + 8}px;
            border: 3px solid ${style.color};
            border-radius: 4px;
            pointer-events: none;
            z-index: 10000;
            animation: ${style.pulse ? 'botame-pulse 1.5s infinite' : 'none'};
          "></div>
          <div class="botame-highlight-message" style="
            position: absolute;
            left: ${box.x}px;
            top: ${box.y + box.height + 10}px;
            background: ${style.color};
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 14px;
            z-index: 10001;
          ">${message}</div>
        `;

        document.body.appendChild(overlay);
      },
      { box, message, position, style }
    );
  }

  async waitForUserClick(selector: string, timeout = 30000): Promise<void> {
    if (!this.page) throw new Error('Browser not launched');
    await this.page.locator(selector).click({ timeout });
  }

  async screenshot(): Promise<string> {
    if (!this.page) throw new Error('Browser not launched');
    const buffer = await this.page.screenshot({ type: 'png' });
    return buffer.toString('base64');
  }

  async close(): Promise<void> {
    await this.browser?.close();
    this.browser = null;
    this.context = null;
    this.page = null;
  }
}
```

#### 2.4.2 자동 고침 (Self-Healing) 엔진

플레이북 실행 중 셀렉터가 실패하면 자동으로 대체 셀렉터를 탐색하고, 실패 시 수동 고침을 지원합니다.

```typescript
// electron/services/playbook-runner.service.ts

export interface StepResult {
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

// 자동 고침 정보 추적
private lastHealingInfo: {
  healed: boolean;
  healedSelector?: string;
  originalSelector?: string;
  healMethod?: 'fallback' | 'text' | 'aria' | 'dynamic' | 'manual';
} | null = null;

// 동적 텍스트 탐색 (step.message 기반)
private async tryDynamicTextSearch(
  step: PlaybookStep,
  page: Page
): Promise<{ success: boolean; locator?: Locator; selector?: string }> {
  if (!step.message) return { success: false };

  const keywords = this.extractKeywords(step.message);

  for (const keyword of keywords) {
    // 1. 정확한 텍스트 매칭: text="키워드"
    // 2. 부분 텍스트 매칭: text=키워드
    // 3. aria-label 부분 매칭: [aria-label*="키워드"]
  }
  return { success: false };
}

// 한국어 메시지에서 키워드 추출
private extractKeywords(message: string): string[] {
  const exactStopWords = ['클릭', '입력', '선택', '메뉴', '버튼', '필드', '링크', '탭', '이동', '완료'];
  const suffixStopWords = ['으로', '에서', '까지', '부터'];

  return message.split(/\s+/).filter(word => {
    const cleaned = word.trim();
    if (cleaned.length < 2) return false;
    if (exactStopWords.includes(cleaned)) return false;
    for (const suffix of suffixStopWords) {
      if (cleaned.endsWith(suffix) && cleaned.length > suffix.length) {
        return false;
      }
    }
    return true;
  });
}
```

**자동 고침 전략 우선순위:**

1. **폴백 셀렉터** (`fallback`)
   - `smartSelector.fallback` 배열의 셀렉터를 순차적으로 시도
   - `self-healing.ts`의 `findElement()` 메서드 활용

2. **동적 텍스트 탐색** (`dynamic`)
   - `step.message`에서 키워드 추출 ("교부관리 클릭" → "교부관리")
   - `text="키워드"` (정확), `text=키워드` (부분), `[aria-label*="키워드"]` 순서로 시도

3. **수동 고침** (`manual`)
   - 자동 고침 실패 시 사용자가 브라우저에서 직접 요소 클릭
   - `pickElement()` IPC 핸들러로 셀렉터 추출

**관련 파일:**
- [playbook-runner.service.ts](../../botame-admin/electron/services/playbook-runner.service.ts) - 자동 고침 로직
- [self-healing.ts](../../botame-admin/electron/core/self-healing.ts) - 폴백 셀렉터 엔진
- [runner.store.ts](../../botame-admin/src/stores/runner.store.ts) - StepResult 타입 정의
- [RunnerPanel.tsx](../../botame-admin/src/components/runner/RunnerPanel.tsx) - 고침 UI 표시

#### 2.4.3 StepVerifier (Interactive Watch & Guide)

사용자 작업 완료 후 결과를 검증하는 서비스. DOM 검증을 우선 사용하고, 실패 시 Vision API를 폴백으로 사용하여 비용을 최적화합니다.

```typescript
// electron/services/step-verifier.ts
import { Page } from 'playwright';
import { ClaudeVisionService } from './claude-vision.service';
import { PlaybookStep } from '../playbook/types';

interface VerifyResult {
  success: boolean;
  method: 'dom' | 'vision';
  message?: string;
  guidance?: string;
  retryCount: number;
}

export class StepVerifier {
  private visionService: ClaudeVisionService;
  private visionFailCount = 0;
  private readonly MAX_VISION_RETRIES = 3;

  constructor(visionService: ClaudeVisionService) {
    this.visionService = visionService;
  }

  async verify(step: PlaybookStep, page: Page): Promise<VerifyResult> {
    // 1단계: DOM 검증 (무료)
    const domResult = await this.verifyByDOM(step, page);
    if (domResult.success) {
      this.visionFailCount = 0; // 성공 시 리셋
      return { success: true, method: 'dom', retryCount: 0 };
    }

    // Vision 비활성화된 경우
    if (step.verify?.fallback_vision === false) {
      return {
        success: false,
        method: 'dom',
        message: domResult.message,
        guidance: '화면을 확인하고 다시 시도해주세요.',
        retryCount: 0
      };
    }

    // 2단계: Vision 검증 (연속 실패 3회 미만일 때만)
    if (this.visionFailCount < this.MAX_VISION_RETRIES) {
      const visionResult = await this.verifyByVision(step, page);
      if (!visionResult.success) {
        this.visionFailCount++;
      } else {
        this.visionFailCount = 0;
      }
      return visionResult;
    }

    // 3단계: Vision 한도 초과 → 수동 안내
    return {
      success: false,
      method: 'dom',
      message: '자동 검증 한도 초과',
      guidance: '화면을 직접 확인 후 "건너뛰기"를 눌러주세요.',
      retryCount: this.visionFailCount
    };
  }

  private async verifyByDOM(step: PlaybookStep, page: Page): Promise<VerifyResult> {
    const verify = step.verify;
    if (!verify) {
      return { success: true, method: 'dom', retryCount: 0 };
    }

    try {
      // URL 검증
      if (verify.success_url_contains) {
        const url = page.url();
        if (!url.includes(verify.success_url_contains)) {
          return { success: false, method: 'dom', message: 'URL이 일치하지 않습니다', retryCount: 0 };
        }
      }

      // Selector 검증
      if (verify.success_selector) {
        const element = await page.locator(verify.success_selector).first();
        const isVisible = await element.isVisible().catch(() => false);
        if (!isVisible) {
          return { success: false, method: 'dom', message: '예상 요소가 화면에 없습니다', retryCount: 0 };
        }
      }

      // 텍스트 검증
      if (verify.success_text) {
        const bodyText = await page.locator('body').textContent();
        if (!bodyText?.includes(verify.success_text)) {
          return { success: false, method: 'dom', message: '예상 텍스트가 화면에 없습니다', retryCount: 0 };
        }
      }

      return { success: true, method: 'dom', retryCount: 0 };
    } catch (error) {
      return { success: false, method: 'dom', message: String(error), retryCount: 0 };
    }
  }

  private async verifyByVision(step: PlaybookStep, page: Page): Promise<VerifyResult> {
    try {
      const screenshot = await page.screenshot({ type: 'png' });
      const result = await this.visionService.verifyScreenshot(screenshot, step);

      if (result.success) {
        return { success: true, method: 'vision', retryCount: this.visionFailCount };
      }

      // 실패 시 가이드 생성
      const guidance = await this.visionService.generateGuidance(screenshot, step, result.reason);
      return {
        success: false,
        method: 'vision',
        message: result.reason,
        guidance,
        retryCount: this.visionFailCount
      };
    } catch (error) {
      return {
        success: false,
        method: 'vision',
        message: String(error),
        guidance: '화면을 확인하고 다시 시도해주세요.',
        retryCount: this.visionFailCount
      };
    }
  }

  resetFailCount(): void {
    this.visionFailCount = 0;
  }
}
```

#### 2.4.3 플레이북 verify 스키마 확장

```typescript
// electron/playbook/types.ts (StepVerify 추가)
interface StepVerify {
  // DOM 검증 (무료)
  success_selector?: string;      // 이 요소 존재 시 성공
  success_url_contains?: string;  // URL에 문자열 포함 시 성공
  success_text?: string;          // 화면에 텍스트 존재 시 성공

  // Vision 검증 (폴백)
  condition?: string;             // AI에게 전달할 검증 조건
  fallback_vision?: boolean;      // false면 Vision 사용 안 함 (기본: true)
}

interface PlaybookStep {
  id: string;
  action: StepAction;
  selector?: string;
  value?: string;
  message?: string;
  wait_for?: WaitForType;
  timeout?: number;
  verify?: StepVerify;  // 추가됨
  // ...
}
```

### 2.5 React UI 컴포넌트

#### 2.5.1 채팅 인터페이스

```typescript
// src/components/chat/ChatContainer.tsx
import { useState, useRef, useEffect } from 'react';
import { useChatStore } from '@/stores/chat.store';
import { usePlaybookStore } from '@/stores/playbook.store';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { PlaybookSuggestions } from './PlaybookSuggestions';

export function ChatContainer() {
  const { messages, sendMessage, isLoading } = useChatStore();
  const { currentPlaybook, executeStep } = usePlaybookStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (text: string) => {
    await sendMessage(text);
  };

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <header className="flex items-center justify-between p-4 border-b">
        <h1 className="text-lg font-semibold">보탬e 가이드</h1>
        <button className="p-2 rounded hover:bg-gray-100">
          <SettingsIcon />
        </button>
      </header>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {/* 현재 실행 중인 플레이북 표시 */}
        {currentPlaybook && (
          <PlaybookProgress playbook={currentPlaybook} />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 플레이북 추천 */}
      <PlaybookSuggestions />

      {/* 입력 영역 */}
      <ChatInput
        onSend={handleSend}
        disabled={isLoading}
        placeholder="무엇을 도와드릴까요?"
      />
    </div>
  );
}
```

#### 2.5.2 상태 관리 (Zustand)

```typescript
// src/stores/playbook.store.ts
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface PlaybookState {
  // 상태
  playbooks: PlaybookSummary[];
  currentPlaybook: Playbook | null;
  currentStep: number;
  isExecuting: boolean;
  isPaused: boolean;

  // 액션
  loadPlaybooks: () => Promise<void>;
  selectPlaybook: (id: string) => Promise<void>;
  startExecution: () => Promise<void>;
  pauseExecution: () => void;
  resumeExecution: () => void;
  stopExecution: () => void;
  nextStep: () => void;
  userActionCompleted: () => void;
}

export const usePlaybookStore = create<PlaybookState>()(
  subscribeWithSelector((set, get) => ({
    playbooks: [],
    currentPlaybook: null,
    currentStep: 0,
    isExecuting: false,
    isPaused: false,

    loadPlaybooks: async () => {
      const playbooks = await window.electron.invoke('playbook:list');
      set({ playbooks });
    },

    selectPlaybook: async (id: string) => {
      const playbook = await window.electron.invoke('playbook:load', id);
      set({ currentPlaybook: playbook, currentStep: 0 });
    },

    startExecution: async () => {
      const { currentPlaybook } = get();
      if (!currentPlaybook) return;

      set({ isExecuting: true, isPaused: false });
      await window.electron.invoke('playbook:execute', currentPlaybook.id);
    },

    pauseExecution: () => {
      set({ isPaused: true });
      window.electron.invoke('playbook:pause');
    },

    resumeExecution: () => {
      set({ isPaused: false });
      window.electron.invoke('playbook:resume');
    },

    stopExecution: () => {
      set({ isExecuting: false, isPaused: false, currentStep: 0 });
      window.electron.invoke('playbook:stop');
    },

    nextStep: () => {
      set((state) => ({ currentStep: state.currentStep + 1 }));
    },

    userActionCompleted: () => {
      window.electron.invoke('playbook:userAction');
    },
  }))
);
```

---

## 3. 클라우드 상세 설계

### 3.1 Supabase 스키마

```sql
-- 사용자 관련
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT UNIQUE NOT NULL,
  organization TEXT,
  plan_type TEXT DEFAULT 'free' CHECK (plan_type IN ('free', 'basic', 'pro')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 플레이북
CREATE TABLE playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  version TEXT DEFAULT '1.0.0',
  content JSONB NOT NULL,  -- YAML을 JSON으로 변환 저장
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'published')),
  is_premium BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 플레이북 버전 히스토리
CREATE TABLE playbook_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id UUID REFERENCES playbooks(id),
  version TEXT NOT NULL,
  content JSONB NOT NULL,
  change_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Q&A 캐시
CREATE TABLE qa_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_hash TEXT NOT NULL,  -- 질문 해시 (검색용)
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  embedding vector(1536),  -- OpenAI embedding 또는 Claude embedding
  category TEXT,
  hit_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 사용자 피드백
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  playbook_id UUID REFERENCES playbooks(id),
  qa_cache_id UUID REFERENCES qa_cache(id),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 사용 통계
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  action_type TEXT NOT NULL,  -- 'playbook_run', 'qa_query', 'chat'
  playbook_id UUID REFERENCES playbooks(id),
  tokens_used INTEGER DEFAULT 0,
  model_used TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 결제/구독
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  plan_type TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'expired')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 벡터 검색 인덱스
CREATE INDEX qa_cache_embedding_idx ON qa_cache
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- RLS 정책
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_cache ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 프로필만 접근
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Published 플레이북은 모든 인증 사용자가 접근 가능
CREATE POLICY "Published playbooks are viewable" ON playbooks
  FOR SELECT USING (status = 'published');

-- Approved Q&A는 모든 인증 사용자가 접근 가능
CREATE POLICY "Approved QA are viewable" ON qa_cache
  FOR SELECT USING (status = 'approved');
```

### 3.2 Edge Functions (API)

#### 3.2.1 채팅 API

```typescript
// supabase/functions/chat/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
});

serve(async (req: Request) => {
  const { message, context, userId } = await req.json();

  // 1. 의도 분류 (L0: 규칙 기반)
  const ruleMatch = matchRules(message);
  if (ruleMatch) {
    return new Response(JSON.stringify(ruleMatch), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Q&A 캐시 검색 (L1: 벡터 유사도)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_KEY')!
  );

  const embedding = await getEmbedding(message);
  const { data: cachedQA } = await supabase.rpc('match_qa', {
    query_embedding: embedding,
    match_threshold: 0.85,
    match_count: 1,
  });

  if (cachedQA && cachedQA.length > 0) {
    // 캐시 히트 카운트 증가
    await supabase
      .from('qa_cache')
      .update({ hit_count: cachedQA[0].hit_count + 1 })
      .eq('id', cachedQA[0].id);

    return new Response(JSON.stringify({
      type: 'cached',
      answer: cachedQA[0].answer,
      source: 'qa_cache',
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 3. Claude API 호출 (L2: Haiku)
  const response = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: message }],
  });

  const answer = response.content[0].text;

  // 4. 새 Q&A 캐시 저장 (DRAFT 상태)
  await supabase.from('qa_cache').insert({
    question: message,
    question_hash: hashQuestion(message),
    answer,
    embedding,
    status: 'draft',
  });

  // 5. 사용량 기록
  await supabase.from('usage_logs').insert({
    user_id: userId,
    action_type: 'chat',
    tokens_used: response.usage.input_tokens + response.usage.output_tokens,
    model_used: 'claude-3-haiku',
  });

  return new Response(JSON.stringify({
    type: 'ai',
    answer,
    source: 'claude',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

function matchRules(message: string): RuleMatch | null {
  // 키워드 기반 빠른 매칭
  const rules = [
    { pattern: /예산.*등록/, playbook: 'budget-register' },
    { pattern: /지출.*결의/, playbook: 'expense-approval' },
    { pattern: /정산.*보고/, playbook: 'settlement-report' },
  ];

  for (const rule of rules) {
    if (rule.pattern.test(message)) {
      return {
        type: 'playbook',
        playbookSlug: rule.playbook,
      };
    }
  }
  return null;
}
```

#### 3.2.2 플레이북 동기화 API

```typescript
// supabase/functions/sync-playbooks/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from '@supabase/supabase-js';

serve(async (req: Request) => {
  const { lastSyncTime, userId } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_KEY')!
  );

  // 사용자 플랜 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan_type')
    .eq('id', userId)
    .single();

  // 업데이트된 플레이북 조회
  let query = supabase
    .from('playbooks')
    .select('id, slug, title, description, category, version, content, updated_at')
    .eq('status', 'published')
    .gt('updated_at', lastSyncTime || '1970-01-01');

  // 무료 플랜은 프리미엄 제외
  if (profile?.plan_type === 'free') {
    query = query.eq('is_premium', false);
  }

  const { data: playbooks, error } = await query;

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    playbooks,
    syncTime: new Date().toISOString(),
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

### 3.3 벡터 검색 함수

```sql
-- supabase/migrations/001_vector_search.sql

-- 질문 유사도 검색 함수
CREATE OR REPLACE FUNCTION match_qa(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  question text,
  answer text,
  hit_count int,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    qa_cache.id,
    qa_cache.question,
    qa_cache.answer,
    qa_cache.hit_count,
    1 - (qa_cache.embedding <=> query_embedding) AS similarity
  FROM qa_cache
  WHERE
    qa_cache.status = 'approved'
    AND 1 - (qa_cache.embedding <=> query_embedding) > match_threshold
  ORDER BY qa_cache.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 플레이북 검색 함수
CREATE OR REPLACE FUNCTION search_playbooks(
  search_query text,
  category_filter text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  slug text,
  title text,
  description text,
  category text,
  rank real
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.slug,
    p.title,
    p.description,
    p.category,
    ts_rank(
      to_tsvector('korean', p.title || ' ' || COALESCE(p.description, '')),
      plainto_tsquery('korean', search_query)
    ) AS rank
  FROM playbooks p
  WHERE
    p.status = 'published'
    AND (category_filter IS NULL OR p.category = category_filter)
    AND to_tsvector('korean', p.title || ' ' || COALESCE(p.description, ''))
        @@ plainto_tsquery('korean', search_query)
  ORDER BY rank DESC
  LIMIT 10;
END;
$$;
```

---

## 4. API 명세

### 4.1 인증 API

| 엔드포인트 | 메서드 | 설명 |
|------------|--------|------|
| `/auth/signup` | POST | 회원가입 |
| `/auth/login` | POST | 로그인 |
| `/auth/logout` | POST | 로그아웃 |
| `/auth/refresh` | POST | 토큰 갱신 |
| `/auth/reset-password` | POST | 비밀번호 재설정 |

### 4.2 플레이북 API

| 엔드포인트 | 메서드 | 설명 |
|------------|--------|------|
| `/playbooks` | GET | 플레이북 목록 |
| `/playbooks/:slug` | GET | 플레이북 상세 |
| `/playbooks/sync` | POST | 플레이북 동기화 |
| `/playbooks/search` | GET | 플레이북 검색 |

### 4.3 채팅 API

| 엔드포인트 | 메서드 | 설명 |
|------------|--------|------|
| `/chat` | POST | 메시지 전송 |
| `/chat/classify` | POST | 의도 분류 |
| `/chat/feedback` | POST | 응답 피드백 |

### 4.4 관리자 API

| 엔드포인트 | 메서드 | 설명 |
|------------|--------|------|
| `/admin/qa/pending` | GET | 검토 대기 Q&A |
| `/admin/qa/:id/approve` | POST | Q&A 승인 |
| `/admin/playbooks/pending` | GET | 검토 대기 플레이북 |
| `/admin/stats` | GET | 통계 조회 |

---

## 5. 보안 설계

### 5.1 인증/인가

```typescript
// 인증 흐름
const authFlow = {
  // 1. 로그인
  login: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return data.session;
  },

  // 2. 토큰 갱신 (자동)
  refreshToken: async () => {
    const { data } = await supabase.auth.refreshSession();
    return data.session;
  },

  // 3. API 호출 시 토큰 첨부
  apiCall: async (endpoint: string, options: RequestInit) => {
    const session = await supabase.auth.getSession();
    return fetch(endpoint, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${session.data.session?.access_token}`,
      },
    });
  },
};
```

### 5.2 데이터 암호화

```typescript
// 로컬 저장소 암호화
import { safeStorage } from 'electron';

const secureStorage = {
  set: (key: string, value: string) => {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(value);
      localStorage.setItem(key, encrypted.toString('base64'));
    }
  },

  get: (key: string): string | null => {
    const encrypted = localStorage.getItem(key);
    if (encrypted && safeStorage.isEncryptionAvailable()) {
      const buffer = Buffer.from(encrypted, 'base64');
      return safeStorage.decryptString(buffer);
    }
    return null;
  },
};
```

### 5.3 API 보안

```typescript
// Rate Limiting (Supabase Edge Function)
const rateLimiter = {
  limits: {
    free: { requests: 100, window: '1h' },
    basic: { requests: 500, window: '1h' },
    pro: { requests: 2000, window: '1h' },
  },

  check: async (userId: string, planType: string) => {
    const key = `ratelimit:${userId}`;
    const current = await redis.incr(key);

    if (current === 1) {
      await redis.expire(key, 3600);
    }

    const limit = rateLimiter.limits[planType].requests;
    return current <= limit;
  },
};
```

---

## 6. 성능 최적화

### 6.1 로컬 캐싱 전략

```typescript
// 캐시 계층
const cacheStrategy = {
  // L1: 메모리 캐시 (즉시 응답)
  memory: new Map<string, CacheEntry>(),

  // L2: SQLite 캐시 (앱 재시작 후에도 유지)
  sqlite: {
    get: async (key: string) => {
      const db = await getDatabase();
      return db.prepare('SELECT value FROM cache WHERE key = ?').get(key);
    },
    set: async (key: string, value: string, ttl: number) => {
      const db = await getDatabase();
      db.prepare(
        'INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)'
      ).run(key, value, Date.now() + ttl);
    },
  },

  // 조회 순서: Memory → SQLite → Network
  get: async (key: string) => {
    // 1. 메모리
    if (cacheStrategy.memory.has(key)) {
      return cacheStrategy.memory.get(key);
    }

    // 2. SQLite
    const sqliteResult = await cacheStrategy.sqlite.get(key);
    if (sqliteResult && sqliteResult.expires_at > Date.now()) {
      cacheStrategy.memory.set(key, sqliteResult.value);
      return sqliteResult.value;
    }

    return null;
  },
};
```

### 6.2 플레이북 프리로딩

```typescript
// 자주 사용하는 플레이북 미리 로드
const preloader = {
  start: async () => {
    const frequentPlaybooks = await getFrequentPlaybooks();

    for (const playbook of frequentPlaybooks) {
      // 백그라운드에서 로드
      await playbookEngine.preload(playbook.id);
    }
  },
};
```

---

## 7. 에러 처리

### 7.1 에러 타입 정의

```typescript
// shared/errors.ts
export class BotameError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'BotameError';
  }
}

export class PlaybookError extends BotameError {
  constructor(message: string, details?: unknown) {
    super(message, 'PLAYBOOK_ERROR', 400, details);
    this.name = 'PlaybookError';
  }
}

export class PlaywrightError extends BotameError {
  constructor(message: string, details?: unknown) {
    super(message, 'PLAYWRIGHT_ERROR', 500, details);
    this.name = 'PlaywrightError';
  }
}

export class AuthError extends BotameError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR', 401);
    this.name = 'AuthError';
  }
}

export class NetworkError extends BotameError {
  constructor(message: string) {
    super(message, 'NETWORK_ERROR', 503);
    this.name = 'NetworkError';
  }
}
```

### 7.2 글로벌 에러 핸들러

```typescript
// electron/error-handler.ts
export function setupErrorHandling() {
  // 미처리 예외
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    showErrorDialog(error);
  });

  // 미처리 Promise 거부
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection:', reason);
  });

  // 렌더러 프로세스 에러
  ipcMain.on('renderer-error', (event, error) => {
    logger.error('Renderer Error:', error);
  });
}

function showErrorDialog(error: Error) {
  dialog.showErrorBox(
    '오류가 발생했습니다',
    `${error.message}\n\n문제가 지속되면 고객센터에 문의해주세요.`
  );
}
```

---

## 8. 모니터링

### 8.1 로깅

```typescript
// shared/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    // 콘솔
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
    // 파일 (로컬)
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),
  ],
});
```

### 8.2 분석 이벤트

```typescript
// src/services/analytics.service.ts
export const analytics = {
  track: async (event: string, properties?: Record<string, unknown>) => {
    // 익명화된 이벤트만 전송
    await fetch('/api/analytics', {
      method: 'POST',
      body: JSON.stringify({
        event,
        properties: {
          ...properties,
          timestamp: Date.now(),
          appVersion: APP_VERSION,
        },
      }),
    });
  },

  events: {
    PLAYBOOK_STARTED: 'playbook_started',
    PLAYBOOK_COMPLETED: 'playbook_completed',
    PLAYBOOK_FAILED: 'playbook_failed',
    CHAT_MESSAGE_SENT: 'chat_message_sent',
    CACHE_HIT: 'cache_hit',
    CACHE_MISS: 'cache_miss',
  },
};
```

---

## 9. 배포

### 9.1 앱 빌드 설정

```yaml
# electron-builder.yml
appId: com.botame.guide
productName: 보탬e 가이드
directories:
  output: dist
  buildResources: build

win:
  target:
    - target: nsis
      arch:
        - x64
  icon: build/icon.ico

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  installerIcon: build/icon.ico
  uninstallerIcon: build/icon.ico
  createDesktopShortcut: true

publish:
  provider: github
  releaseType: release

electronDownload:
  cache: .cache/electron
```

### 9.2 자동 업데이트

```typescript
// electron/updater.ts
import { autoUpdater } from 'electron-updater';

export function setupAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    // 사용자에게 업데이트 알림
    showUpdateNotification(info.version);
  });

  autoUpdater.on('update-downloaded', () => {
    // 재시작 권유
    showRestartPrompt();
  });

  // 주기적 업데이트 확인 (6시간마다)
  setInterval(() => {
    autoUpdater.checkForUpdates();
  }, 6 * 60 * 60 * 1000);
}
```

---

## 10. 부록

### 10.1 환경 변수

```env
# .env.example

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_KEY=xxx  # 서버만

# Claude API
ANTHROPIC_API_KEY=xxx

# App
APP_VERSION=1.0.0
NODE_ENV=development

# Analytics (optional)
SENTRY_DSN=xxx
```

### 10.2 의존성 목록

```json
{
  "dependencies": {
    "electron": "^28.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.4.0",
    "playwright": "^1.40.0",
    "@supabase/supabase-js": "^2.39.0",
    "xstate": "^5.0.0",
    "better-sqlite3": "^9.2.0",
    "yaml": "^2.3.0",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "electron-builder": "^24.9.0",
    "electron-vite": "^2.0.0",
    "@types/react": "^18.2.0",
    "jest": "^29.7.0",
    "@testing-library/react": "^14.1.0",
    "eslint": "^8.56.0",
    "prettier": "^3.2.0"
  }
}
```

---

*문서 끝*
