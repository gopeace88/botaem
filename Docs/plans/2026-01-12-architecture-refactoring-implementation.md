# Architecture Refactoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor 보탬e project to eliminate code duplication and ensure stability by extracting shared code into standalone packages (@botame/types, @botame/player, @botame/recorder).

**Architecture:**
- Create three new packages: @botame/types (stable type definitions), @botame/player (shared playbook execution engine), @botame/recorder (admin-only recording engine)
- Implement BrowserAdapter interface to abstract browser control differences between admin and guide apps
- Use fixed versioning for guide app (stability) and caret versioning for admin app (flexibility)

**Tech Stack:**
- TypeScript 5.x, pnpm workspace, Node.js native modules
- Playwright (browser control), Vitest (testing)
- Existing packages: better-sqlite3, Electron, Zustand

---

## Task 1: Package Scaffolding

**Files:**
- Create: `packages/@botame/types/package.json`
- Create: `packages/@botame/types/tsconfig.json`
- Create: `packages/@botame/types/src/index.ts`
- Create: `packages/@botame/player/package.json`
- Create: `packages/@botame/player/tsconfig.json`
- Create: `packages/@botame/player/src/index.ts`
- Create: `packages/@botame/recorder/package.json`
- Create: `packages/@botame/recorder/tsconfig.json`
- Create: `packages/@botame/recorder/src/index.ts`
- Modify: `pnpm-workspace.yaml`

---

### Step 1.1: Create pnpm workspace configuration

**Action:** Create or update `pnpm-workspace.yaml` to include new packages

Create file: `pnpm-workspace.yaml`

```yaml
packages:
  - 'packages/*'
  - 'botame-admin'
  - 'botame-guide-app'
```

**Command:**
```bash
mkdir -p packages/@botame/{types,player,recorder}
```

**Expected:** directories created

---

### Step 1.2: Initialize @botame/types package

**Create file:** `packages/@botame/types/package.json`

```json
{
  "name": "@botame/types",
  "version": "1.0.0",
  "description": "Shared type definitions for 보탬e",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "typecheck": "tsc --noEmit"
  },
  "keywords": ["botame", "types"],
  "author": "",
  "license": "MIT",
  "devDependencies": {
    "typescript": "^5.7.3"
  }
}
```

**Command:**
```bash
cd packages/@botame/types && cat > package.json << 'EOF'
[above JSON]
EOF
```

**Expected:** package.json created

---

### Step 1.3: Create @botame/types tsconfig

**Create file:** `packages/@botame/types/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**Expected:** tsconfig.json created

---

### Step 1.4: Create @botame/types entry point

**Create file:** `packages/@botame/types/src/index.ts`

```typescript
// Placeholder - will be populated in Task 2
export * from './playbook';
export * from './selector';
export * from './execution';
export * from './healing';
export * from './recording';
export * from './ipc';
```

**Expected:** index.ts created (will fail until submodules are created)

---

### Step 1.5: Initialize @botame/player package

**Create file:** `packages/@botame/player/package.json`

```json
{
  "name": "@botame/player",
  "version": "2.1.0",
  "description": "Playbook execution engine for 보탬e",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "typecheck": "tsc --noEmit",
    "test": "vitest"
  },
  "keywords": ["botame", "player", "playbook"],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "@botame/types": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.7.3",
    "vitest": "^2.0.0"
  }
}
```

**Expected:** package.json created

---

### Step 1.6: Create @botame/player tsconfig

**Create file:** `packages/@botame/player/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**Expected:** tsconfig.json created

---

### Step 1.7: Create @botame/player entry point

**Create file:** `packages/@botame/player/src/index.ts`

```typescript
// Placeholder - will be populated in Task 3
export * from './engine';
export * from './parser';
export * from './interpolator';
export * from './validator';
```

**Expected:** index.ts created

---

### Step 1.8: Initialize @botame/recorder package

**Create file:** `packages/@botame/recorder/package.json`

```json
{
  "name": "@botame/recorder",
  "version": "1.0.0",
  "description": "Playbook recording engine for 보탬e (admin only)",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "typecheck": "tsc --noEmit",
    "test": "vitest"
  },
  "keywords": ["botame", "recorder"],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "@botame/types": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.7.3",
    "vitest": "^2.0.0"
  }
}
```

**Expected:** package.json created

---

### Step 1.9: Create @botame/recorder tsconfig

**Create file:** `packages/@botame/recorder/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**Expected:** tsconfig.json created

---

### Step 1.10: Create @botame/recorder entry point

**Create file:** `packages/@botame/recorder/src/index.ts`

```typescript
// Placeholder - will be populated in Task 4
export * from './capture';
export * from './smart-selector';
```

**Expected:** index.ts created

---

### Step 1.11: Verify workspace setup

**Command:**
```bash
pnpm install
```

**Expected:** All packages installed successfully, workspace linked

**Command:**
```bash
pnpm -r typecheck
```

**Expected:** Type errors (expected - placeholders not implemented yet)

---

### Step 1.12: Commit package scaffolding

**Command:**
```bash
git add pnpm-workspace.yaml packages/@botame
git commit -m "feat: add package scaffolding for @botame/{types,player,recorder}

- Create workspace configuration
- Add package.json and tsconfig for each package
- Add placeholder entry points"
```

**Expected:** Commit successful

---

## Task 2: Extract and Unify Type Definitions

**Files:**
- Create: `packages/@botame/types/src/playbook.ts`
- Create: `packages/@botame/types/src/selector.ts`
- Create: `packages/@botame/types/src/execution.ts`
- Create: `packages/@botame/types/src/healing.ts`
- Create: `packages/@botame/types/src/recording.ts`
- Create: `packages/@botame/types/src/ipc.ts`
- Modify: `botame-admin/shared/types.ts` (replace with re-export)
- Modify: `botame-guide-app/electron/playbook/types.ts` (replace with re-export)
- Reference: `botame-admin/shared/types.ts` (existing)
- Reference: `botame-guide-app/electron/playbook/types.ts` (existing)

---

### Step 2.1: Read existing type definitions

**Command:**
```bash
# Read botame-admin types for reference
cat botame-admin/shared/types.ts

# Read botame-guide-app types for reference
cat botame-guide-app/electron/playbook/types.ts

# Read packages/core types for reference
cat packages/core/src/types/playbook.ts
cat packages/core/src/types/selector.ts
```

**Expected:** Understand the differences between the three type definitions

---

### Step 2.2: Create unified playbook.ts

**Create file:** `packages/@botame/types/src/playbook.ts`

```typescript
/**
 * Playbook Types - 플레이북 관련 타입 정의
 * @module @botame/types/playbook
 */

// ============================================
// 기본 타입
// ============================================

/** 지원하는 액션 타입 */
export const ACTION_TYPES = [
  'navigate',
  'click',
  'type',
  'select',
  'wait',
  'guide',
  'scroll',
  'hover',
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

/** 난이도 */
export const DIFFICULTY_LEVELS = ['쉬움', '보통', '어려움'] as const;
export type Difficulty = (typeof DIFFICULTY_LEVELS)[number];

/** 카테고리 (사이트 프로필에 따라 동적 정의) */
export type Category = string;

// ============================================
// 셀렉터 타입
// ============================================

/** 셀렉터 전략 */
export const SELECTOR_STRATEGIES = [
  'css',
  'xpath',
  'text',
  'role',
  'testId',
  'placeholder',
  'label',
] as const;

export type SelectorStrategy = (typeof SELECTOR_STRATEGIES)[number];

/** 셀렉터 정보 */
export interface SelectorInfo {
  strategy: SelectorStrategy;
  value: string;
  priority: number; // 낮을수록 높은 우선순위
}

// ============================================
// 가이드 앱 확장 타입
// ============================================

export type WaitFor = 'element' | 'navigation' | 'network' | 'user' | 'user_input';
export type OnError = 'retry' | 'skip' | 'abort';
export type ErrorAction = 'retry' | 'skip' | 'abort' | 'guide';
export type PreconditionAction = 'warn' | 'block';
export type VariableType = 'string' | 'number' | 'date' | 'select' | 'boolean';

/** 스텝 검증 (Interactive Watch & Guide) */
export interface StepVerify {
  success_selector?: string;
  success_url_contains?: string;
  success_text?: string;
  condition?: string;
  fallback_vision?: boolean;
}

export type VerifyMethod = 'dom' | 'vision';

export interface VerifyResult {
  success: boolean;
  method: VerifyMethod;
  message?: string;
  guidance?: string;
  retryCount: number;
}

/** 변수 정의 */
export interface VariableDefinition {
  type: VariableType;
  label: string;
  required?: boolean;
  default?: string;
  options?: string[] | Array<{ value: string; label: string }>;
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
}

/** 사전 조건 */
export interface Precondition {
  check: string;
  message: string;
  action: PreconditionAction;
}

/** 에러 핸들러 */
export interface ErrorHandler {
  match: string;
  action: ErrorAction;
  message?: string;
}

// ============================================
// 플레이북 구조
// ============================================

/**
 * 플레이북 스텝 (통합 버전)
 * admin과 guide 앱 모두에서 사용
 */
export interface PlaybookStep {
  // === 기본 필드 (모든 앱 공통) ===
  id: string;
  action: ActionType;
  selector?: string; // Primary selector (하위 호환)
  selectors?: SelectorInfo[]; // Multiple fallback selectors
  value?: string;
  message?: string;
  timeout?: number;
  optional?: boolean;
  waitAfter?: number;

  // === 가이드 앱 확장 (선택적) ===
  wait_for?: WaitFor;
  condition?: string;
  on_error?: OnError;
  then?: PlaybookStep[];
  else?: PlaybookStep[];
  variable?: string;
  steps?: PlaybookStep[];
  verify?: StepVerify;

  // === 실행 히스토리 (런타임 전용) ===
  healingHistory?: HealingRecord[];

  [key: string]: unknown; // Index signature for interpolation
}

/**
 * 플레이북 메타데이터
 */
export interface PlaybookMetadata {
  id: string;
  name: string;
  version: string;
  description?: string;
  category?: Category;
  difficulty?: Difficulty;
  keywords?: string[];
  estimatedTime?: string;
  estimated_time?: string; // 가이드 앱 호환용
  createdAt?: string;
  updatedAt?: string;
  last_updated?: string; // 가이드 앱 호환용
  startUrl?: string;
  start_url?: string; // 가이드 앱 호환용
  author?: string;
  /** 자연어 별칭 (2~3레벨 단순화 구조) */
  aliases?: string[];
}

/**
 * 플레이북 (통합 버전)
 */
export interface Playbook {
  metadata: PlaybookMetadata;
  steps: PlaybookStep[];

  // === 가이드 앱 확장 ===
  variables?: Record<string, VariableDefinition>;
  preconditions?: Precondition[];
  error_handlers?: ErrorHandler[];
}

/**
 * 플레이북 목록 아이템
 */
export interface PlaybookListItem {
  id: string;
  name: string;
  description?: string;
  category?: Category;
  difficulty?: Difficulty;
  stepCount: number;
  filePath: string;
  updatedAt?: string;
}

/**
 * 플레이북 카탈로그 아이템 (Supabase)
 */
export interface PlaybookCatalogItem {
  id: string;
  playbook_id: string;
  name: string;
  description: string;
  category: string;
  difficulty: string;
  estimated_time: string;
  version: string;
  is_published: boolean;
  status: string;
  keywords: string[];
  updated_at: string;
  step_count: number;
  level: number;
  start_url: string;
  aliases?: string[];
}

// ============================================
// 녹화 타입
// ============================================

/** 녹화 상태 */
export type RecordingState = 'idle' | 'recording' | 'paused';

/** 녹화된 액션 */
export interface RecordedAction {
  type: ActionType;
  selector?: string;
  selectors?: SelectorInfo[];
  value?: string;
  timestamp: number;
  clickX?: number;
  clickY?: number;
  elementInfo?: ElementInfo;
}

/** 요소 정보 */
export interface ElementInfo {
  tagName: string;
  id?: string;
  className?: string;
  text?: string;
  placeholder?: string;
  type?: string;
  role?: string;
  ariaLabel?: string;
  name?: string;
  dataTestId?: string;
}
```

**Expected:** File created with unified playbook types

---

### Step 2.3: Create selector.ts

**Create file:** `packages/@botame/types/src/selector.ts`

```typescript
/**
 * Selector Types - 셀렉터 관련 타입 정의
 * @module @botame/types/selector
 */

import { ActionType } from './playbook';

/** 신뢰도가 포함된 셀렉터 */
export interface SelectorWithScore {
  strategy: import('./playbook').SelectorStrategy;
  value: string;
  confidence: number; // 0-100, 높을수록 안정적
}

// ============================================
// v2: SmartSelector
// ============================================

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** AI 생성 셀렉터 정보 */
export interface AIGeneratedSelectors {
  selectors: SelectorWithScore[];
  generatedAt: string;
  model: string;
  confidence: number;
  reasoning?: string;
  domContext?: string;
}

/** 스마트 셀렉터 */
export interface SmartSelector {
  primary: SelectorWithScore;
  fallbacks: SelectorWithScore[];
  coordinates: BoundingBox;
  elementHash: string;
  snapshot?: ElementSnapshot;
  aiGenerated?: AIGeneratedSelectors;
}

/** 요소 스냅샷 */
export interface ElementSnapshot {
  nodeId: number;
  backendNodeId: number;
  tagName: string;
  attributes: Record<string, string>;
  textContent?: string;
  boundingBox: BoundingBox;
  isVisible: boolean;
  isInViewport: boolean;
  xpath: string;
  cssPath: string;
  parentNodeId?: number;
  role?: string;
  name?: string;
  description?: string;
}

// ============================================
// v3: ElementIdentity
// ============================================

/** 요소 식별자 (v3) */
export interface ElementIdentity {
  axRole?: string;
  axName?: string;
  ariaLabel?: string;
  dataTestId?: string;
  name?: string;
  tagName: string;
  id?: string;
  type?: string;
  placeholder?: string;
  boundingBox: BoundingBox;
  visualHash?: string;
  backendNodeId: number;
  textContent?: string;
  capturedAt: number;
  parentRole?: string;
  parentName?: string;
}

// ============================================
// v4: Enhanced Fallbacks
// ============================================

/** 텍스트 기반 셀렉터 */
export interface TextBasedSelector {
  type: 'exact' | 'contains' | 'regex';
  value: string;
  pattern?: string;
  selector: string;
  confidence: number;
}

/** 부모 체인 기반 셀렉터 */
export interface ParentChainSelector {
  parentSelector: string;
  childSelector: string;
  fullSelector: string;
  depth: number;
  confidence: number;
}

/** 근처 라벨 기반 셀렉터 */
export interface NearbyLabelSelector {
  labelText: string;
  relationship: 'for' | 'sibling' | 'preceding' | 'following' | 'parent';
  targetSelector: string;
  confidence: number;
}

/** 확장된 폴백 셀렉터 (v4) */
export interface EnhancedFallbacks {
  textSelectors: TextBasedSelector[];
  parentChainSelectors: ParentChainSelector[];
  nearbyLabelSelectors: NearbyLabelSelector[];
}

/** 구조적 위치 정보 */
export interface StructuralPosition {
  parentChain: ParentInfo[];
  siblingInfo: SiblingInfo;
  nthChild: number;
  nthOfType: number;
  formElementIndex?: number;
}

/** 부모 요소 정보 */
export interface ParentInfo {
  tagName: string;
  id?: string;
  role?: string;
  ariaLabel?: string;
  className?: string;
  selector: string;
  isLandmark: boolean;
  isForm: boolean;
}

/** 형제 요소 정보 */
export interface SiblingInfo {
  prevSiblingText?: string;
  nextSiblingText?: string;
  prevSiblingTag?: string;
  nextSiblingTag?: string;
  totalSiblings: number;
  position: number;
}

/** 텍스트 패턴 */
export interface TextPatterns {
  original: string;
  normalized: string;
  variations: TextVariation[];
  regexPattern: string;
  keywords: string[];
}

/** 텍스트 변형 */
export interface TextVariation {
  type: 'korean' | 'english' | 'mixed' | 'abbreviated';
  value: string;
  pattern: string;
}

export type MatchingStrategy =
  | 'accessibility'
  | 'ariaLabel'
  | 'name'
  | 'testId'
  | 'placeholder'
  | 'text'
  | 'css'
  | 'xpath'
  | 'visual'
  | 'coordinates';

export type HealMethodV4 =
  | 'fallback'
  | 'text'
  | 'aria'
  | 'dynamic'
  | 'manual'
  | 'parentChain'
  | 'nearbyLabel'
  | 'textPattern'
  | 'structural'
  | 'coordinates';
```

**Expected:** File created with selector types

---

### Step 2.4: Create execution.ts

**Create file:** `packages/@botame/types/src/execution.ts`

```typescript
/**
 * Execution Types - 실행 컨텍스트 및 결과 타입
 * @module @botame/types/execution
 */

import { MatchingStrategy, SelectorWithScore } from './selector';

// ============================================
// 실행 컨텍스트
// ============================================

export interface ExecutionContext {
  variables: Record<string, unknown>;
  currentUrl: string;
  healingEnabled: boolean;

  // 브라우저 제어는 각 앱이 제공
  browserAdapter: BrowserAdapter;
}

/** 브라우저 어댑터 인터페이스 */
export interface BrowserAdapter {
  click(selector: string, options?: ClickOptions): Promise<ActionResult>;
  type(selector: string, text: string): Promise<ActionResult>;
  select(selector: string, value: string): Promise<ActionResult>;
  navigate(url: string): Promise<ActionResult>;
  waitFor(selector: string, timeout?: number): Promise<ActionResult>;

  getUrl(): string;
  getTitle(): string;

  getTextContent(selector: string): Promise<string>;
  getAriaLabel(selector: string): Promise<string>;
  isVisible(selector: string): Promise<boolean>;
}

export interface ClickOptions {
  timeout?: number;
  force?: boolean;
}

export interface ActionResult {
  success: boolean;
  error?: Error;
  duration?: number;
  screenshot?: string;
}

// ============================================
// 스텝 결과
// ============================================

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

  // 가이드 앵 확장
  waitForUser?: boolean;
  data?: unknown;
}

export interface ExecutionResult {
  success: boolean;
  steps: StepResult[];
  duration: number;
  error?: string;
}

// ============================================
// 자동 고침 기록
// ============================================

export interface HealingRecord {
  timestamp: number;
  originalSelector: string;
  healedSelector: string;
  strategy: import('./playbook').SelectorStrategy;
  success: boolean;
}

export interface MatchResult {
  success: boolean;
  strategy: MatchingStrategy;
  selector?: string;
  confidence: number;
  elementFound?: boolean;
  error?: string;
}

export interface HealingRecordV3 extends HealingRecord {
  matchingStrategy: MatchingStrategy;
  identity?: import('./selector').ElementIdentity;
  attemptedStrategies: MatchingStrategy[];
}

// ============================================
// 실행 상태
// ============================================

export type ExecutionStatus =
  | 'idle'
  | 'loading'
  | 'validating'
  | 'executing'
  | 'waiting_user'
  | 'verifying'
  | 'paused'
  | 'completed'
  | 'error';

export interface ExecutionError {
  stepId: string;
  message: string;
  code?: string;
  timestamp: Date;
}
```

**Expected:** File created with execution types

---

### Step 2.5: Create healing.ts

**Create file:** `packages/@botame/types/src/healing.ts`

```typescript
/**
 * Healing Types - 자동 고침 관련 타입
 * @module @botame/types/healing
 */

import { SelectorWithScore } from './selector';

/** 치유 전략 */
export type HealStrategy =
  | 'fallback'
  | 'text'
  | 'aria'
  | 'dynamic'
  | 'manual'
  | 'parentChain'
  | 'nearbyLabel'
  | 'textPattern'
  | 'structural'
  | 'coordinates';

/** 치유 결과 */
export interface HealResult {
  success: boolean;
  strategy?: HealStrategy;
  selector?: string;
  confidence?: number;
  error?: string;
}

/** 치유 컨텍스트 */
export interface HealContext {
  originalSelector: string;
  currentUrl: string;
  stepMessage?: string;
  elementHints?: string[];
}

/** 폴백 셀렉터 시도 결과 */
export interface FallbackAttempt {
  selector: string;
  strategy: import('./playbook').SelectorStrategy;
  success: boolean;
  error?: string;
}

/** DOM 스냅샵 */
export interface DOMSnapshot {
  timestamp: number;
  url: string;
  viewport: { width: number; height: number };
  elements: ElementSnapshot[];
}

export interface ElementSnapshot {
  nodeId: number;
  backendNodeId: number;
  tagName: string;
  attributes: Record<string, string>;
  textContent?: string;
  boundingBox: import('./selector').BoundingBox;
  isVisible: boolean;
  isInViewport: boolean;
  xpath: string;
  cssPath: string;
  parentNodeId?: number;
  role?: string;
  name?: string;
  description?: string;
}
```

**Expected:** File created with healing types

---

### Step 2.6: Create recording.ts

**Create file:** `packages/@botame/types/src/recording.ts`

```typescript
/**
 * Recording Types - 녹화 관련 타입
 * @module @botame/types/recording
 */

import { ActionType } from './playbook';

/** 녹화 상태 */
export type RecordingState = 'idle' | 'recording' | 'paused';

/** 액션 캡처 */
export interface ActionCapture {
  action: ActionType;
  timestamp: number;

  primarySelector: string;
  fallbackSelectors: import('./playbook').SelectorInfo[];

  identity: import('./selector').ElementIdentity;

  clickX?: number;
  clickY?: number;
}

export interface CDPEvent {
  type: string;
  [key: string]: unknown;
}

export interface Recorder {
  start(): void;
  recordAction(cdpEvent: CDPEvent): ActionCapture;
  generatePlaybook(): import('./playbook').Playbook;
  stop(): import('./playbook').RecordedAction[];
}
```

**Expected:** File created with recording types

---

### Step 2.7: Create ipc.ts

**Create file:** `packages/@botame/types/src/ipc.ts`

```typescript
/**
 * IPC Types - IPC 공통 타입
 * @module @botame/types/ipc
 */

/** IPC 결과 */
export interface IpcResult<T = unknown> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}

/** IPC 채널 */
export type IpcChannel =
  | 'playbook:execute'
  | 'playbook:stop'
  | 'playbook:pause'
  | 'playbook:resume'
  | 'recording:start'
  | 'recording:stop'
  | 'recording:pause'
  | 'browser:navigate'
  | 'browser:click'
  | 'supabase:sync';
```

**Expected:** File created with IPC types

---

### Step 2.8: Update botame-admin to re-export from @botame/types

**Modify file:** `botame-admin/shared/types.ts`

Replace entire content with:

```typescript
/**
 * botame-admin Type Definitions
 *
 * This file re-exports types from @botame/types for backward compatibility.
 * New code should import directly from @botame/types.
 */

export * from '@botame/types';
```

**Expected:** File replaced with re-export

---

### Step 2.9: Update botame-guide-app to re-export from @botame/types

**Modify file:** `botame-guide-app/electron/playbook/types.ts`

Replace entire content with:

```typescript
/**
 * botame-guide-app Type Definitions
 *
 * This file re-exports types from @botame/types for backward compatibility.
 * New code should import directly from @botame/types.
 */

export * from '@botame/types';

// Re-export any guide-app specific types that don't exist in @botame/types
// (Add them here if needed)
```

**Expected:** File replaced with re-export

---

### Step 2.10: Build @botame/types

**Command:**
```bash
cd packages/@botame/types && pnpm run build
```

**Expected:** Build succeeds, dist/ folder created with .js and .d.ts files

---

### Step 2.11: Add @botame/types to botame-admin dependencies

**Modify file:** `botame-admin/package.json`

Add to dependencies:
```json
"@botame/types": "workspace:*"
```

**Command:**
```bash
cd botame-admin && pnpm install
```

**Expected:** Package linked to workspace

---

### Step 2.12: Add @botame/types to botame-guide-app dependencies

**Modify file:** `botame-guide-app/package.json`

Add to dependencies:
```json
"@botame/types": "workspace:*"
```

**Command:**
```bash
cd botame-guide-app && pnpm install
```

**Expected:** Package linked to workspace

---

### Step 2.13: Verify type checking for both apps

**Command:**
```bash
cd botame-admin && pnpm run typecheck
```

**Expected:** No type errors

**Command:**
```bash
cd botame-guide-app && pnpm run typecheck
```

**Expected:** No type errors

---

### Step 2.14: Commit type unification

**Command:**
```bash
git add packages/@botame/types botame-admin/shared/types.ts botame-guide-app/electron/playbook/types.ts
git commit -m "feat: extract and unify type definitions into @botame/types

- Create unified type definitions across admin and guide apps
- Re-export from @botame/types for backward compatibility
- Add playbook, selector, execution, healing, recording, IPC types"
```

**Expected:** Commit successful

---

## Task 3: Extract @botame/player (Playbook Execution Engine)

**Files:**
- Create: `packages/@botame/player/src/engine.ts`
- Create: `packages/@botame/player/src/parser.ts`
- Create: `packages/@botame/player/src/interpolator.ts`
- Create: `packages/@botame/player/src/validator.ts`
- Reference: `botame-guide-app/electron/playbook/engine.ts` (existing)
- Reference: `botame-guide-app/electron/playbook/parser.ts` (existing)
- Reference: `botame-guide-app/electron/playbook/interpolator.ts` (existing)
- Reference: `botame-guide-app/electron/playbook/validator.ts` (existing)

---

### Step 3.1: Read existing guide-app playbook engine

**Command:**
```bash
cat botame-guide-app/electron/playbook/engine.ts
```

**Expected:** Understand the current engine implementation

---

### Step 3.2: Create PlaybookEngine interface and implementation

**Create file:** `packages/@botame/player/src/engine.ts`

```typescript
/**
 * Playbook Execution Engine
 * @module @botame/player/engine
 */

import {
  Playbook,
  PlaybookStep,
  ExecutionContext,
  ExecutionResult,
  StepResult,
  ExecutionStatus,
} from '@botame/types';

export type EngineEvent =
  | { type: 'loaded'; playbook: Playbook }
  | { type: 'started' }
  | { type: 'step_started'; stepIndex: number; step: PlaybookStep }
  | { type: 'step_completed'; stepIndex: number; result: StepResult }
  | { type: 'completed'; result: ExecutionResult }
  | { type: 'error'; error: Error }
  | { type: 'stopped' };

type EventCallback = (event: EngineEvent) => void;

export class PlaybookEngine {
  private playbook: Playbook | null = null;
  private context: ExecutionContext | null = null;
  private status: ExecutionStatus = 'idle';
  private eventCallbacks: Map<string, EventCallback[]> = new Map();

  load(playbook: Playbook): void {
    this.playbook = playbook;
    this.status = 'idle';
    this.emit({ type: 'loaded', playbook });
  }

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    if (!this.playbook) {
      throw new Error('No playbook loaded. Call load() first.');
    }

    this.context = context;
    this.status = 'executing';
    this.emit({ type: 'started' });

    const startTime = Date.now();
    const results: StepResult[] = [];

    try {
      for (let i = 0; i < this.playbook.steps.length; i++) {
        const step = this.playbook.steps[i];
        this.emit({ type: 'step_started', stepIndex: i, step });

        const result = await this.executeStep(step, i, context);
        results.push(result);
        this.emit({ type: 'step_completed', stepIndex: i, result });

        if (result.status === 'failed' && !step.optional) {
          this.status = 'error';
          return {
            success: false,
            steps: results,
            duration: Date.now() - startTime,
            error: result.error,
          };
        }
      }

      this.status = 'completed';
      const result: ExecutionResult = {
        success: true,
        steps: results,
        duration: Date.now() - startTime,
      };
      this.emit({ type: 'completed', result });
      return result;
    } catch (error) {
      this.status = 'error';
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit({ type: 'error', error: err });
      return {
        success: false,
        steps: results,
        duration: Date.now() - startTime,
        error: err.message,
      };
    }
  }

  private async executeStep(
    step: PlaybookStep,
    index: number,
    context: ExecutionContext
  ): Promise<StepResult> {
    const startTime = Date.now();

    try {
      switch (step.action) {
        case 'navigate':
          await context.browserAdapter.navigate(step.value || '');
          return {
            stepId: step.id,
            stepIndex: index,
            status: 'success',
            duration: Date.now() - startTime,
          };

        case 'click':
          await context.browserAdapter.click(step.selector || '');
          return {
            stepId: step.id,
            stepIndex: index,
            status: 'success',
            duration: Date.now() - startTime,
          };

        case 'type':
          await context.browserAdapter.type(step.selector || '', step.value || '');
          return {
            stepId: step.id,
            stepIndex: index,
            status: 'success',
            duration: Date.now() - startTime,
          };

        case 'wait':
          await context.browserAdapter.waitFor(step.selector || '', step.timeout);
          return {
            stepId: step.id,
            stepIndex: index,
            status: 'success',
            duration: Date.now() - startTime,
          };

        default:
          return {
            stepId: step.id,
            stepIndex: index,
            status: 'skipped',
            message: `Action ${step.action} not implemented`,
            duration: Date.now() - startTime,
          };
      }
    } catch (error) {
      return {
        stepId: step.id,
        stepIndex: index,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  pause(): void {
    this.status = 'paused';
  }

  resume(): void {
    if (this.status === 'paused') {
      this.status = 'executing';
    }
  }

  stop(): void {
    this.status = 'idle';
    this.playbook = null;
    this.context = null;
    this.emit({ type: 'stopped' });
  }

  on(event: string, callback: EventCallback): void {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, []);
    }
    this.eventCallbacks.get(event)!.push(callback);
  }

  off(event: string, callback: EventCallback): void {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private emit(event: EngineEvent): void {
    const callbacks = this.eventCallbacks.get(event.type);
    if (callbacks) {
      callbacks.forEach((cb) => cb(event));
    }
  }

  getStatus(): ExecutionStatus {
    return this.status;
  }
}
```

**Expected:** File created with PlaybookEngine implementation

---

### Step 3.3: Create parser.ts

**Create file:** `packages/@botame/player/src/parser.ts`

```typescript
/**
 * Playbook Parser
 * @module @botame/player/parser
 */

import { Playbook, ValidationError } from '@botame/types';

export function parsePlaybook(json: string): Playbook {
  try {
    const parsed = JSON.parse(json);
    return validatePlaybook(parsed);
  } catch (error) {
    throw new Error(`Failed to parse playbook: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function validatePlaybook(data: unknown): Playbook {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid playbook: not an object');
  }

  const playbook = data as Partial<Playbook>;

  if (!playbook.metadata) {
    throw new Error('Invalid playbook: missing metadata');
  }

  if (!playbook.steps || !Array.isArray(playbook.steps)) {
    throw new Error('Invalid playbook: missing or invalid steps');
  }

  return playbook as Playbook;
}
```

**Expected:** File created with parser implementation

---

### Step 3.4: Create interpolator.ts

**Create file:** `packages/@botame/player/src/interpolator.ts`

```typescript
/**
 * Variable Interpolator
 * @module @botame/player/interpolator
 */

import { PlaybookStep, ExecutionContext } from '@botame/types';

export function interpolateStep(
  step: PlaybookStep,
  context: ExecutionContext
): PlaybookStep {
  const variables = context.variables;

  let result = JSON.stringify(step);
  result = replaceVariables(result, variables);
  return JSON.parse(result);
}

function replaceVariables(str: string, variables: Record<string, unknown>): string {
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = variables[key];
    return value !== undefined ? String(value) : `{{${key}}}`;
  });
}
```

**Expected:** File created with interpolator implementation

---

### Step 3.5: Create validator.ts

**Create file:** `packages/@botame/player/src/validator.ts`

```typescript
/**
 * Playbook Validator
 * @module @botame/player/validator
 */

import { Playbook, ValidationResult, ValidationError } from '@botame/types';

export function validatePlaybookSchema(playbook: Playbook): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate metadata
  if (!playbook.metadata.id) {
    errors.push({
      path: 'metadata.id',
      message: 'Required field missing',
      keyword: 'required',
    });
  }

  if (!playbook.metadata.name) {
    errors.push({
      path: 'metadata.name',
      message: 'Required field missing',
      keyword: 'required',
    });
  }

  // Validate steps
  if (!playbook.steps || playbook.steps.length === 0) {
    errors.push({
      path: 'steps',
      message: 'At least one step is required',
      keyword: 'minItems',
    });
  } else {
    playbook.steps.forEach((step, index) => {
      if (!step.id) {
        errors.push({
          path: `steps[${index}].id`,
          message: 'Required field missing',
          keyword: 'required',
        });
      }

      if (!step.action) {
        errors.push({
          path: `steps[${index}].action`,
          message: 'Required field missing',
          keyword: 'required',
        });
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

**Expected:** File created with validator implementation

---

### Step 3.6: Build @botame/player

**Command:**
```bash
cd packages/@botame/player && pnpm run build
```

**Expected:** Build succeeds

---

### Step 3.7: Add @botame/player to botame-guide-app dependencies

**Modify file:** `botame-guide-app/package.json`

Add to dependencies:
```json
"@botame/player": "2.1.0"  // Fixed version for stability
```

**Command:**
```bash
cd botame-guide-app && pnpm install
```

**Expected:** Package installed

---

### Step 3.8: Update botame-guide-app to use @botame/player

**Create file:** `botame-guide-app/electron/player/guide-player.ts`

```typescript
/**
 * Guide App Player Wrapper
 * wraps @botame/player with Playwright adapter
 */

import { PlaybookEngine } from '@botame/player';
import { PlaywrightAdapter } from './playwright-adapter';
import { Playbook, ExecutionContext } from '@botame/types';
import { Page } from 'playwright';

export class GuidePlayer {
  private engine = new PlaybookEngine();
  private adapter: PlaywrightAdapter;

  constructor(private page: Page) {
    this.adapter = new PlaywrightAdapter(page);
  }

  async execute(playbook: Playbook): Promise<void> {
    const context: ExecutionContext = {
      variables: {},
      currentUrl: this.page.url(),
      healingEnabled: true,
      browserAdapter: this.adapter,
    };

    await this.engine.load(playbook);
    await this.engine.execute(context);
  }

  on(event: string, callback: (data: any) => void) {
    this.engine.on(event, callback);
  }

  stop() {
    this.engine.stop();
  }
}
```

**Expected:** File created

---

### Step 3.9: Create PlaywrightAdapter

**Create file:** `botame-guide-app/electron/player/playwright-adapter.ts`

```typescript
/**
 * Playwright Browser Adapter
 * implements BrowserAdapter for Playwright
 */

import {
  BrowserAdapter,
  ActionResult,
  ClickOptions,
} from '@botame/types';
import { Page } from 'playwright';

export class PlaywrightAdapter implements BrowserAdapter {
  constructor(private page: Page) {}

  async click(selector: string, options?: ClickOptions): Promise<ActionResult> {
    const start = Date.now();
    try {
      await this.page.click(selector, {
        timeout: options?.timeout || 30000,
        force: options?.force,
      });
      return { success: true, duration: Date.now() - start };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        duration: Date.now() - start,
      };
    }
  }

  async type(selector: string, text: string): Promise<ActionResult> {
    const start = Date.now();
    try {
      await this.page.fill(selector, text);
      return { success: true, duration: Date.now() - start };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        duration: Date.now() - start,
      };
    }
  }

  async select(selector: string, value: string): Promise<ActionResult> {
    const start = Date.now();
    try {
      await this.page.selectOption(selector, value);
      return { success: true, duration: Date.now() - start };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        duration: Date.now() - start,
      };
    }
  }

  async navigate(url: string): Promise<ActionResult> {
    const start = Date.now();
    try {
      await this.page.goto(url);
      return { success: true, duration: Date.now() - start };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        duration: Date.now() - start,
      };
    }
  }

  async waitFor(selector: string, timeout = 30000): Promise<ActionResult> {
    const start = Date.now();
    try {
      await this.page.waitForSelector(selector, { timeout });
      return { success: true, duration: Date.now() - start };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        duration: Date.now() - start,
      };
    }
  }

  getUrl(): string {
    return this.page.url();
  }

  getTitle(): string {
    return this.page.title();
  }

  async getTextContent(selector: string): Promise<string> {
    const element = await this.page.$(selector);
    if (!element) return '';
    return element.textContent() || '';
  }

  async getAriaLabel(selector: string): Promise<string> {
    const element = await this.page.$(selector);
    if (!element) return '';
    return element.evaluate((el) => el.getAttribute('aria-label') || '');
  }

  async isVisible(selector: string): Promise<boolean> {
    const element = await this.page.$(selector);
    if (!element) return false;
    return element.isVisible();
  }
}
```

**Expected:** File created

---

### Step 3.10: Verify guide-app builds successfully

**Command:**
```bash
cd botame-guide-app && pnpm run typecheck
```

**Expected:** No type errors

---

### Step 3.11: Commit @botame/player extraction

**Command:**
```bash
git add packages/@botame/player botame-guide-app
git commit -m "feat: extract playbook execution engine into @botame/player

- Extract engine, parser, interpolator, validator from guide-app
- Create PlaywrightAdapter for browser abstraction
- Update guide-app to use @botame/player with fixed version"
```

**Expected:** Commit successful

---

## Task 4: Update botame-admin to use @botame/player

**Files:**
- Modify: `botame-admin/package.json`
- Create: `botame-admin/electron/services/admin-browser-adapter.ts`
- Modify: `botame-admin/electron/services/playbook-runner.service.ts`
- Reference: `botame-admin/electron/services/playbook-runner.service.ts` (existing)

---

### Step 4.1: Add @botame/player to admin dependencies

**Modify file:** `botame-admin/package.json`

Add to dependencies:
```json
"@botame/player": "^2.1.0"  // Caret version for flexibility
```

**Command:**
```bash
cd botame-admin && pnpm install
```

**Expected:** Package installed

---

### Step 4.2: Create AdminBrowserAdapter

**Create file:** `botame-admin/electron/services/admin-browser-adapter.ts`

```typescript
/**
 * Admin App Browser Adapter
 * implements BrowserAdapter for admin's browser service
 */

import {
  BrowserAdapter,
  ActionResult,
  ClickOptions,
} from '@botame/types';
import { BrowserService } from './browser.service';

export class AdminBrowserAdapter implements BrowserAdapter {
  constructor(private browserService: BrowserService) {}

  async click(selector: string, options?: ClickOptions): Promise<ActionResult> {
    return this.browserService.click(selector);
  }

  async type(selector: string, text: string): Promise<ActionResult> {
    return this.browserService.type(selector, text);
  }

  async select(selector: string, value: string): Promise<ActionResult> {
    return this.browserService.select(selector, value);
  }

  async navigate(url: string): Promise<ActionResult> {
    return this.browserService.navigate(url);
  }

  async waitFor(selector: string, timeout?: number): Promise<ActionResult> {
    return this.browserService.waitFor(selector, timeout);
  }

  getUrl(): string {
    return this.browserService.getCurrentUrl();
  }

  getTitle(): string {
    return this.browserService.getTitle();
  }

  async getTextContent(selector: string): Promise<string> {
    return this.browserService.getTextContent(selector);
  }

  async getAriaLabel(selector: string): Promise<string> {
    return this.browserService.getAriaLabel(selector);
  }

  async isVisible(selector: string): Promise<boolean> {
    return this.browserService.isVisible(selector);
  }
}
```

**Expected:** File created

---

### Step 4.3: Update PlaybookRunnerService to use @botame/player

**Read existing file:**
```bash
cat botame-admin/electron/services/playbook-runner.service.ts | head -100
```

**Expected:** Understand current implementation

**Modify file:** `botame-admin/electron/services/playbook-runner.service.ts`

Update imports and use PlaybookEngine:

```typescript
/**
 * Playbook Runner Service
 * uses @botame/player for execution
 */

import { PlaybookEngine } from '@botame/player';
import { AdminBrowserAdapter } from './admin-browser-adapter';
import { Playbook, ExecutionContext } from '@botame/types';
import { BrowserService } from './browser.service';

export class PlaybookRunnerService {
  private engine = new PlaybookEngine();
  private adapter: AdminBrowserAdapter;

  constructor(private browserService: BrowserService) {
    this.adapter = new AdminBrowserAdapter(browserService);
  }

  async executePlaybook(playbook: Playbook): Promise<void> {
    const context: ExecutionContext = {
      variables: {},
      currentUrl: this.browserService.getCurrentUrl(),
      healingEnabled: true,
      browserAdapter: this.adapter,
    };

    await this.engine.load(playbook);
    await this.engine.execute(context);
  }

  // ... rest of the service methods
}
```

**Expected:** Service updated to use @botame/player

---

### Step 4.4: Verify admin builds successfully

**Command:**
```bash
cd botame-admin && pnpm run typecheck
```

**Expected:** No type errors

---

### Step 4.5: Commit admin integration

**Command:**
```bash
git add botame-admin
git commit -m "feat: integrate @botame/player into admin app

- Create AdminBrowserAdapter wrapping browser.service
- Update PlaybookRunnerService to use @botame/player
- Use caret versioning for flexibility"
```

**Expected:** Commit successful

---

## Task 5: Extract @botame/recorder (Admin Only)

**Files:**
- Create: `packages/@botame/recorder/src/capture.ts`
- Create: `packages/@botame/recorder/src/smart-selector.ts`
- Modify: `botame-admin/electron/services/recording.service.ts`
- Reference: `botame-admin/electron/core/smart-selector.ts` (existing)
- Reference: `botame-admin/electron/services/recording.service.ts` (existing)

---

### Step 5.1: Read existing recorder implementation

**Command:**
```bash
cat botame-admin/electron/services/recording.service.ts | head -150
```

**Expected:** Understand current recording implementation

---

### Step 5.2: Create capture.ts

**Create file:** `packages/@botame/recorder/src/capture.ts`

```typescript
/**
 * Action Capture Module
 * @module @botame/recorder/capture
 */

import {
  ActionCapture,
  CDPEvent,
  Playbook,
  RecordedAction,
  ActionType,
} from '@botame/types';

export class Recorder {
  private recording = false;
  private actions: ActionCapture[] = [];
  private startTime = 0;

  start(): void {
    this.recording = true;
    this.actions = [];
    this.startTime = Date.now();
  }

  recordAction(cdpEvent: CDPEvent): ActionCapture {
    if (!this.recording) {
      throw new Error('Recorder is not started');
    }

    // Extract action info from CDP event
    const capture: ActionCapture = {
      action: this.extractActionType(cdpEvent),
      timestamp: Date.now() - this.startTime,
      primarySelector: cdpEvent.selector as string || '',
      fallbackSelectors: [],
      identity: cdpEvent.identity as any,
      clickX: cdpEvent.clickX as number | undefined,
      clickY: cdpEvent.clickY as number | undefined,
    };

    this.actions.push(capture);
    return capture;
  }

  generatePlaybook(): Playbook {
    return {
      metadata: {
        id: `playbook-${Date.now()}`,
        name: 'Recorded Playbook',
        version: '1.0.0',
      },
      steps: this.actions.map((action, index) => ({
        id: `step-${index}`,
        action: action.action,
        selector: action.primarySelector,
        selectors: action.fallbackSelectors,
      })),
    };
  }

  stop(): RecordedAction[] {
    this.recording = false;
    return this.actions.map((action) => ({
      type: action.action,
      selector: action.primarySelector,
      selectors: action.fallbackSelectors,
      timestamp: action.timestamp,
      clickX: action.clickX,
      clickY: action.clickY,
    }));
  }

  private extractActionType(cdpEvent: CDPEvent): ActionType {
    // Determine action type from CDP event
    const type = cdpEvent.type as string;

    if (type.includes('click')) return 'click';
    if (type.includes('type') || type.includes('input')) return 'type';
    if (type.includes('navigate')) return 'navigate';
    if (type.includes('select')) return 'select';

    return 'click' as ActionType; // Default
  }
}
```

**Expected:** File created

---

### Step 5.3: Create smart-selector.ts

**Create file:** `packages/@botame/recorder/src/smart-selector.ts`

```typescript
/**
 * Smart Selector Generator
 * @module @botame/recorder/smart-selector
 */

import { SelectorInfo, SelectorStrategy } from '@botame/types';

export interface ElementData {
  tagName: string;
  id?: string;
  className?: string;
  text?: string;
  placeholder?: string;
  type?: string;
  role?: string;
  ariaLabel?: string;
  name?: string;
  dataTestId?: string;
}

export function generateSelectors(element: ElementData): SelectorInfo[] {
  const selectors: SelectorInfo[] = [];
  let priority = 10;

  // 1. Test ID (highest priority)
  if (element.dataTestId) {
    selectors.push({
      strategy: 'testId',
      value: `[data-testid="${element.dataTestId}"]`,
      priority: priority++,
    });
  }

  // 2. ID
  if (element.id && !isDynamicId(element.id)) {
    selectors.push({
      strategy: 'css',
      value: `#${element.id}`,
      priority: priority++,
    });
  }

  // 3. ARIA label
  if (element.ariaLabel) {
    selectors.push({
      strategy: 'ariaLabel',
      value: `[aria-label="${element.ariaLabel}"]`,
      priority: priority++,
    });
  }

  // 4. Role + name
  if (element.role) {
    selectors.push({
      strategy: 'role',
      value: `${element.role}${element.text ? `[name="${element.text}"]` : ''}`,
      priority: priority++,
    });
  }

  // 5. Placeholder
  if (element.placeholder) {
    selectors.push({
      strategy: 'placeholder',
      value: `[placeholder="${element.placeholder}"]`,
      priority: priority++,
    });
  }

  // 6. Name (form elements)
  if (element.name) {
    selectors.push({
      strategy: 'css',
      value: `[name="${element.name}"]`,
      priority: priority++,
    });
  }

  // 7. Text content (last resort)
  if (element.text && element.text.length < 50) {
    selectors.push({
      strategy: 'text',
      value: element.text,
      priority: priority++,
    });
  }

  return selectors;
}

function isDynamicId(id: string): boolean {
  // Check for patterns that suggest dynamically generated IDs
  return /^\w{32,}$/.test(id) || /^\w+-\w+$/.test(id);
}
```

**Expected:** File created

---

### Step 5.4: Build @botame/recorder

**Command:**
```bash
cd packages/@botame/recorder && pnpm run build
```

**Expected:** Build succeeds

---

### Step 5.5: Add @botame/recorder to admin dependencies

**Modify file:** `botame-admin/package.json`

Add to dependencies:
```json
"@botame/recorder": "^1.0.0"  // Caret version for flexibility
```

**Command:**
```bash
cd botame-admin && pnpm install
```

**Expected:** Package installed

---

### Step 5.6: Update RecordingService to use @botame/recorder

**Read existing service:**
```bash
cat botame-admin/electron/services/recording.service.ts | head -100
```

**Modify file:** `botame-admin/electron/services/recording.service.ts`

Update to use Recorder from @botame/recorder:

```typescript
/**
 * Recording Service
 * uses @botame/recorder for capture logic
 */

import { Recorder } from '@botame/recorder';

export class RecordingService {
  private recorder = new Recorder();

  async startRecording() {
    this.recorder.start();
    // ... setup CDP event listeners
  }

  async stopRecording() {
    const actions = this.recorder.stop();
    const playbook = this.recorder.generatePlaybook();
    // ... save playbook
  }
}
```

**Expected:** Service updated

---

### Step 5.7: Verify admin builds successfully

**Command:**
```bash
cd botame-admin && pnpm run typecheck
```

**Expected:** No type errors

---

### Step 5.8: Commit recorder extraction

**Command:**
```bash
git add packages/@botame/recorder botame-admin
git commit -m "feat: extract recording engine into @botame/recorder

- Extract capture and smart-selector logic from admin
- Create @botame/recorder package
- Update RecordingService to use @botame/recorder"
```

**Expected:** Commit successful

---

## Task 6: Testing and Validation

**Files:**
- Create: `packages/@botame/types/src/__tests__/playbook.test.ts`
- Create: `packages/@botame/player/src/__tests__/engine.test.ts`
- Create: `packages/@botame/recorder/src/__tests__/capture.test.ts`

---

### Step 6.1: Create type tests

**Create file:** `packages/@botame/types/src/__tests__/playbook.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { Playbook, PlaybookStep } from '../playbook';

describe('Playbook Types', () => {
  it('should create valid playbook step', () => {
    const step: PlaybookStep = {
      id: 'step-1',
      action: 'click',
      selector: '[data-testid="submit"]',
      message: 'Click submit button',
    };

    expect(step.id).toBe('step-1');
    expect(step.action).toBe('click');
  });

  it('should create valid playbook', () => {
    const playbook: Playbook = {
      metadata: {
        id: 'pb-1',
        name: 'Test Playbook',
        version: '1.0.0',
      },
      steps: [
        {
          id: 'step-1',
          action: 'navigate',
          value: 'https://example.com',
        },
      ],
    };

    expect(playbook.metadata.id).toBe('pb-1');
    expect(playbook.steps.length).toBe(1);
  });
});
```

**Expected:** File created

---

### Step 6.2: Create engine tests

**Create file:** `packages/@botame/player/src/__tests__/engine.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { PlaybookEngine } from '../engine';
import { Playbook, ExecutionContext } from '@botame/types';

describe('PlaybookEngine', () => {
  it('should load playbook', () => {
    const engine = new PlaybookEngine();
    const playbook: Playbook = {
      metadata: { id: 'pb-1', name: 'Test', version: '1.0.0' },
      steps: [],
    };

    engine.load(playbook);
    expect(engine.getStatus()).toBe('idle');
  });

  it('should execute playbook with mock adapter', async () => {
    const engine = new PlaybookEngine();
    const playbook: Playbook = {
      metadata: { id: 'pb-1', name: 'Test', version: '1.0.0' },
      steps: [
        {
          id: 'step-1',
          action: 'navigate',
          value: 'https://example.com',
        },
      ],
    };

    const mockAdapter = {
      navigate: vi.fn().mockResolvedValue({ success: true }),
      click: vi.fn(),
      type: vi.fn(),
      select: vi.fn(),
      waitFor: vi.fn(),
      getUrl: vi.fn().mockReturnValue('https://example.com'),
      getTitle: vi.fn().mockReturnValue('Test'),
      getTextContent: vi.fn(),
      getAriaLabel: vi.fn(),
      isVisible: vi.fn(),
    };

    const context: ExecutionContext = {
      variables: {},
      currentUrl: 'https://example.com',
      healingEnabled: false,
      browserAdapter: mockAdapter as any,
    };

    await engine.load(playbook);
    const result = await engine.execute(context);

    expect(result.success).toBe(true);
    expect(mockAdapter.navigate).toHaveBeenCalledWith('https://example.com');
  });
});
```

**Expected:** File created

---

### Step 6.3: Create recorder tests

**Create file:** `packages/@botame/recorder/src/__tests__/capture.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { Recorder } from '../capture';

describe('Recorder', () => {
  it('should start recording', () => {
    const recorder = new Recorder();
    recorder.start();
    // Should not throw
  });

  it('should record action', () => {
    const recorder = new Recorder();
    recorder.start();

    const capture = recorder.recordAction({
      type: 'click',
      selector: '[data-testid="submit"]',
      clickX: 100,
      clickY: 200,
    } as any);

    expect(capture.action).toBe('click');
    expect(capture.primarySelector).toBe('[data-testid="submit"]');
  });

  it('should generate playbook', () => {
    const recorder = new Recorder();
    recorder.start();

    recorder.recordAction({
      type: 'click',
      selector: '[data-testid="submit"]',
    } as any);

    const playbook = recorder.generatePlaybook();

    expect(playbook.metadata.id).toBeDefined();
    expect(playbook.steps.length).toBe(1);
    expect(playbook.steps[0].action).toBe('click');
  });
});
```

**Expected:** File created

---

### Step 6.4: Run all tests

**Command:**
```bash
pnpm -r test
```

**Expected:** All tests pass

---

### Step 6.5: Integration test - guide app

**Command:**
```bash
cd botame-guide-app && pnpm run dev
```

**Expected:** App starts without errors, can load and execute playbook

---

### Step 6.6: Integration test - admin app

**Command:**
```bash
cd botame-admin && pnpm run dev
```

**Expected:** App starts without errors, can record and play playbook

---

### Step 6.7: Verify version locking works

**Command:**
```bash
# Check guide-app has fixed versions
cat botame-guide-app/package.json | grep -A2 "@botame"

# Check admin has caret versions
cat botame-admin/package.json | grep -A2 "@botame"
```

**Expected:**
- guide-app: `"@botame/types": "1.0.0"`, `"@botame/player": "2.1.0"` (no caret)
- admin: `"@botame/types": "^1.0.0"`, `"@botame/player": "^2.1.0"` (with caret)

---

### Step 6.8: Commit test infrastructure

**Command:**
```bash
git add packages/@botame/*/src/__tests__
git commit -m "test: add unit tests for @botame packages

- Add playbook type tests
- Add engine integration tests
- Add recorder unit tests"
```

**Expected:** Commit successful

---

## Task 7: Documentation

**Files:**
- Create: `packages/@botame/types/README.md`
- Create: `packages/@botame/player/README.md`
- Create: `packages/@botame/recorder/README.md`
- Create: `packages/README.md`

---

### Step 7.1: Create types README

**Create file:** `packages/@botame/types/README.md`

```markdown
# @botame/types

Shared type definitions for 보탬e project.

## Overview

This package contains all shared TypeScript types used across botame-admin and botame-guide-app applications.

## Installation

```bash
pnpm add @botame/types
```

## Usage

```typescript
import { Playbook, PlaybookStep } from '@botame/types';

const step: PlaybookStep = {
  id: 'step-1',
  action: 'click',
  selector: '[data-testid="submit"]',
};
```

## Modules

- `playbook` - Playbook and step definitions
- `selector` - Selector and healing types
- `execution` - Execution context and results
- `healing` - Self-healing types
- `recording` - Recording types
- `ipc` - IPC types

## Versioning

This package follows [Semantic Versioning](https://semver.org/):

- **Major**: Breaking changes (removed/renamed types)
- **Minor**: New optional fields (backward compatible)
- **Patch**: Bug fixes, documentation updates
```

**Expected:** File created

---

### Step 7.2: Create player README

**Create file:** `packages/@botame/player/README.md`

```markdown
# @botame/player

Playbook execution engine for 보탬e.

## Overview

This package provides the core playbook execution logic shared by both admin and guide apps.

## Installation

```bash
# guide-app (fixed version for stability)
pnpm add @botame/player@2.1.0

# admin (caret version for flexibility)
pnpm add @botame/player@^2.1.0
```

## Usage

```typescript
import { PlaybookEngine } from '@botame/player';
import { PlaywrightAdapter } from './playwright-adapter';

const engine = new PlaybookEngine();
const adapter = new PlaywrightAdapter(page);

await engine.load(playbook);
await engine.execute({
  variables: {},
  currentUrl: page.url(),
  healingEnabled: true,
  browserAdapter: adapter,
});
```

## Architecture

The player is designed to be framework-agnostic:

- Uses `BrowserAdapter` interface for browser control
- Each app implements its own adapter (Playwright, Puppeteer, etc.)
- Player only knows about the interface, not the implementation

## Modules

- `engine` - Core execution engine
- `parser` - Playbook parsing
- `interpolator` - Variable interpolation
- `validator` - Schema validation
```

**Expected:** File created

---

### Step 7.3: Create recorder README

**Create file:** `packages/@botame/recorder/README.md`

```markdown
# @botame/recorder

Playbook recording engine for 보탬e (admin only).

## Overview

This package provides the recording functionality used by botame-admin to capture browser actions and generate playbooks.

## Installation

```bash
pnpm add @botame/recorder
```

## Usage

```typescript
import { Recorder } from '@botame/recorder';

const recorder = new Recorder();

recorder.start();

// Capture actions from CDP events
recorder.recordAction({
  type: 'click',
  selector: '[data-testid="submit"]',
  clickX: 100,
  clickY: 200,
});

// Generate playbook
const playbook = recorder.generatePlaybook();

recorder.stop();
```

## Modules

- `capture` - Action capture logic
- `smart-selector` - Smart selector generation with multiple strategies
```

**Expected:** File created

---

### Step 7.4: Create packages README

**Create file:** `packages/README.md`

```markdown
# 보탬e Packages

Monorepo packages for the 보탬e project.

## Structure

```
packages/
├── @botame/types/       # Shared type definitions
├── @botame/player/      # Playbook execution engine
└── @botame/recorder/    # Recording engine (admin only)
```

## Version Management

### guide-app (Fixed Versions)

```json
{
  "dependencies": {
    "@botame/types": "1.0.0",
    "@botame/player": "2.1.0"
  }
}
```

Uses exact versions to prevent accidental updates after deployment.

### admin (Caret Versions)

```json
{
  "dependencies": {
    "@botame/types": "^1.0.0",
    "@botame/player": "^2.1.0",
    "@botame/recorder": "^1.0.0"
  }
}
```

Uses caret versions to get latest compatible changes during development.

## Building

```bash
# Build all packages
pnpm -r build

# Build specific package
cd packages/@botame/types && pnpm build
```

## Testing

```bash
# Test all packages
pnpm -r test

# Test specific package
cd packages/@botame/player && pnpm test
```
```

**Expected:** File created

---

### Step 7.5: Commit documentation

**Command:**
```bash
git add packages README.md
git commit -m "docs: add package documentation

- Add README for each package
- Add packages overview
- Document version management strategy"
```

**Expected:** Commit successful

---

## Task 8: Final Validation

---

### Step 8.1: Full workspace build

**Command:**
```bash
pnpm -r build
```

**Expected:** All packages build successfully

---

### Step 8.2: Full typecheck

**Command:**
```bash
pnpm -r typecheck
```

**Expected:** No type errors in any package or app

---

### Step 8.3: Full test suite

**Command:**
```bash
pnpm -r test
```

**Expected:** All tests pass

---

### Step 8.4: Verify workspace structure

**Command:**
```bash
tree -L 3 packages/ -I 'node_modules|dist'
```

**Expected:** Proper structure with all packages

---

### Step 8.5: Verify dependencies

**Command:**
```bash
pnpm list --depth=0
```

**Expected:** All packages properly linked

---

### Step 8.6: Final commit

**Command:**
```bash
git add .
git commit -m "feat: complete architecture refactoring

- Extract shared code into @botame/{types,player,recorder}
- Implement BrowserAdapter for browser abstraction
- Use fixed versioning for guide-app stability
- Use caret versioning for admin flexibility
- Add comprehensive tests and documentation

Breaking Changes:
- botame-admin/shared/types.ts now re-exports from @botame/types
- botame-guide-app/electron/playbook/types.ts now re-exports from @botame/types
- Both apps now use @botame/player for execution"
```

**Expected:** Final commit successful

---

### Step 8.7: Create migration guide

**Create file:** `packages/MIGRATION.md`

```markdown
# Architecture Refactoring Migration Guide

## Summary

The codebase has been refactored to eliminate duplication and improve stability. Shared code is now in separate packages under `packages/`.

## Changes

### For Developers

**Before:**
```typescript
import { Playbook } from '../../../shared/types';
```

**After:**
```typescript
import { Playbook } from '@botame/types';
```

### For Users

- **guide-app users**: No changes visible, using stable fixed versions
- **admin users**: Gets latest features automatically with caret versions

## Package Matrix

| Package | Version (guide) | Version (admin) | Purpose |
|---------|----------------|-----------------|---------|
| @botame/types | 1.0.0 (fixed) | ^1.0.0 (caret) | Type definitions |
| @botame/player | 2.1.0 (fixed) | ^2.1.0 (caret) | Execution engine |
| @botame/recorder | N/A | ^1.0.0 (caret) | Recording (admin only) |

## Troubleshooting

**Type errors after import changes:**
```bash
cd botame-admin && pnpm install
cd botame-guide-app && pnpm install
```

**Package not found:**
```bash
pnpm install
```

**Build errors:**
```bash
pnpm -r build
```
```

**Expected:** Migration guide created

---

### Step 8.8: Commit migration guide

**Command:**
```bash
git add packages/MIGRATION.md
git commit -m "docs: add migration guide for architecture refactoring"
```

**Expected:** Final documentation commit successful

---

## Completion Criteria

- ✅ All packages build successfully
- ✅ All tests pass
- ✅ No type errors in any app
- ✅ guide-app uses fixed versions
- ✅ admin uses caret versions
- ✅ Documentation complete
- ✅ Migration guide provided

---

**Estimated Total Time:** 10-15 days

**Next Steps:**
1. Create Git worktree for isolation
2. Execute plan step-by-step
3. Test thoroughly after each task
4. Deploy guide-app with fixed versions
