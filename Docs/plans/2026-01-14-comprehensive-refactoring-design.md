# 보탬e 전면 리팩토링 설계 문서

**버전:** 1.0.0
**날짜:** 2026-01-14
**작성자:** Claude Sonnet + 사용자
**상태:** 제안됨

---

## 1. 개요

### 1.1 목적

보탬e 프로젝트를 **프로덕션 레디 상태**로 전면 개선하여 실제 사용자에게 안정적으로 배포 가능하게 만든다.

### 1.2 범위

**4대 축:**
1. **보안 & 안정성** - API Key 보안, 업데이트 배포, 에러 처리
2. **코드 품질** - 테스트, 로거, 타입 안전성
3. **기능 완성** - 오프라인 모드, 모니터링, 회로 차단기
4. **운영 준비** - 문서화, 설정, 데이터 보존

### 1.3 제외 항목

- Vision API: ✅ 완료 (제거됨, commit 5004186)
- 다국어 지원: 한국어 전용 v1.0
- 모바일 지원: 데스크톱 전용
- 멀티 사이트: losims.go.kr 전용

---

## 2. 현재 상태 분석

### 2.1 강점

- ✅ 잘 정의된 아키텍처 (monorepo, packages 분리)
- ✅ Self-healing이 잘 작동 (8/8 스텝 성공)
- ✅ 포괄적인 문서 (MASTER_DESIGN.md, 스펙)
- ✅ 타입 안전성 (TypeScript strict mode)

### 2.2 취약점

**보안:**
- 🔴 API Key가 process.env에 평문 저장
- 🔴 Electron sandbox 비활성화

**안정성:**
- 🔴 업데이트 배포 시스템 없음
- 🟡 에러 처리 불균형 (일부는 예외 처리, 일부는 무시)

**코드 품질:**
- 🟡 테스트 커버리지 불균형 (admin: 3, guide-app: 18)
- 🟡 57개 파일에 console.log 산재
- 🟡 타입 안전성 위반 (`any[]` 사용)

**운영:**
- 🟢 문서화 누락 (.env.example, 배포 가이드)
- 🟢 데이터 보존 정책 없음
- 🟢 설정 관리 미흡

---

## 3. Phase별 설계

## Phase 1: 보안 & 안정성

### 3.1 API Key 보안

**현재:**
```typescript
// .env
ANTHROPIC_API_KEY=sk-ant-xxx
SUPABASE_URL=https://xxx.supabase.co

// 코드
const apiKey = process.env.ANTHROPIC_API_KEY;
```

**설계:**

```typescript
// services/credentials.service.ts
import { safeStorage } from 'electron';

export class CredentialsService {
  async setApiKey(service: 'anthropic' | 'supabase', key: string) {
    const encrypted = safeStorage.encryptString(key);
    await store.set(`api_key_${service}`, encrypted);
  }

  async getApiKey(service: string): Promise<string | null> {
    const encrypted = await store.get(`api_key_${service}`);
    if (!encrypted) return null;
    return safeStorage.decryptString(encrypted);
  }
}
```

**사용자 플로우:**
1. 앱 최초 실행 시 "API Key 설정" 마법사
2. 키 입력 → safeStorage에 암호화 저장
3. 이후 실행 시 자동 복호화

**적용:**
- botame-guide-app (최종 사용자)
- botame-admin (개발자, 선택적)

---

### 3.2 Electron Sandbox

**현재:**
```typescript
webPreferences: {
  sandbox: false,  // 🔴 취약점
}
```

**설계:**

```typescript
webPreferences: {
  sandbox: true,  // ✅ 보안
  nodeIntegration: false,
  contextIsolation: true,
  preload: path.join(__dirname, 'preload.js')
}
```

**IPC 채널 재설계:**
```typescript
// preload.ts
contextBridge.exposeInMainWorld('electronAPI', {
  runPlaybook: (playbook: Playbook) => ipcRenderer.invoke('playbook:run', playbook),
  // ... 기능별 노출
});
```

---

### 3.3 Auto-Updater

**구조:**

```
[GitHub Releases]
       ↓
[electron-updater 서버]
       ↓
[클라이언트]
  - 시작 시 체크 (1일 1회)
  - 백그라운드 다운로드
  - 다음 시작 시 자동 적용
```

**구현:**

```typescript
// main.ts
import { autoUpdater } from 'electron-updater';

autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'gopeace88',
  repo: 'botaem'
});

autoUpdater.on('update-available', () => {
  // 알림 표시
});

autoUpdater.on('update-downloaded', () => {
  // "재시작 후 업데이트" 대화상자
});
```

**롤백:**
- 이전 버전 유지 (uninstall 시에만 삭제)
- 심각한 버그 발생 시 긴급 패치 배포

---

### 3.4 에러 처리 계층 구조

```typescript
// errors/base.ts
export class RecoverableError extends Error {
  constructor(
    message: string,
    public userAction: string,  // "다시 시도", "페이지 새로고침"
    public retryable: boolean = true
  ) {
    super(message);
  }
}

export class FatalError extends Error {
  constructor(
    message: string,
    public reason: string  // "API Key 없음", "브라우저 설치 실패"
  ) {
    super(message);
  }
}

// errors/handlers.ts
export class ErrorHandler {
  handle(error: Error) {
    if (error instanceof RecoverableError) {
      this.showUserMessage(error.message, error.userAction);
      this.log(error, 'warn');
    } else if (error instanceof FatalError) {
      this.showFatalDialog(error);
      this.log(error, 'error');
      this.reportToServer(error);
    }
  }
}
```

---

## Phase 2: 코드 품질

### 3.5 테스트 전략

**Unit Tests (Vitest):**
```typescript
// services/playbook-runner.service.test.ts
describe('PlaybookRunnerService', () => {
  it('should execute playbook successfully', async () => {
    const service = new PlaybookRunnerService(mockBrowser);
    const result = await service.runPlaybook(mockPlaybook);
    expect(result.success).toBe(true);
  });

  it('should heal failed selectors', async () => {
    // Mock selector failure
    // Verify self-healing invoked
    // Assert recovery success
  });
});
```

**목표 커버리지:**
- services/: 80%+
- components/: 70%+
- packages/: 90%+

---

### 3.6 로거 시스템

**Winston 기반:**

```typescript
// logger/index.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: 'error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: 'combined.log',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 10
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

**마이그레이션 스크립트:**
```bash
# console.log → logger 변환
# Before
console.log('[PlaybookRunner] Step completed', index);

# After
logger.info('Step completed', { stepIndex: index });
```

---

### 3.7 타입 안전성

**제거:**
```typescript
// ❌ 금지
const elements: any[] = await page.$$(selector);

// ✅ 대신
interface ElementInfo {
  tagName: string;
  textContent?: string;
}
const elements: ElementInfo[] = await page.$$(selector);
```

**ESLint 규칙:**
```json
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-unsafe-member-access": "error"
  }
}
```

---

## Phase 3: 기능 완성

### 3.8 오프라인 모드

**아키텍처:**

```
[Renderer Process]
        ↓
[IndexedDB Local Cache] ← 1차 확인
        ↓
[Network Check]
        ↓
[Supabase API] ← 온라인 시만
```

**구현:**
```typescript
// services/playbook-cache.service.ts
export class PlaybookCacheService {
  private db: IDBDatabase;

  async getPlaybook(id: string): Promise<Playbook> {
    // 1. 로컬 확인
    const local = await this.db.get('playbooks', id);
    if (local) {
      logger.info('Cache hit', { id });
      return local;
    }

    // 2. 오프라인 체크
    if (!navigator.onLine) {
      throw new OfflineError('오프라인 상태입니다');
    }

    // 3. 서버에서 가져오기
    const remote = await this.api.fetch(id);
    await this.db.put('playbooks', remote);
    return remote;
  }

  async syncWhenOnline() {
    window.addEventListener('online', async () => {
      const pending = await this.db.getAll('pending-sync');
      for (const item of pending) {
        try {
          await this.api.sync(item);
          await this.db.delete('pending-sync', item.id);
        } catch (error) {
          logger.error('Sync failed', { item, error });
        }
      }
    });
  }
}
```

---

### 3.9 성능 모니터링

**메트릭:**
```typescript
// telemetry/metrics.ts
export class MetricsCollector {
  trackPlaybookExecution(playbookId: string, duration: number, success: boolean) {
    this.emit('playbook:executed', {
      playbookId,
      duration,
      success,
      timestamp: Date.now()
    });
  }

  trackSelfHealing(strategy: string, success: boolean, attempts: number) {
    this.emit('self-healing:attempt', {
      strategy,
      success,
      attempts,
      timestamp: Date.now()
    });
  }

  getStats() {
    return {
      avgExecutionTime: this.calculateAverage(),
      healingSuccessRate: this.calculateHealingRate(),
      mostFailedSteps: this.getTopFailures()
    };
  }
}
```

**대시보드 UI:**
- 최근 7일 실행 통계
- Self-healing 전략별 성공률
- API 호출 비용
- 평균 실행 시간 추이

---

### 3.10 Circuit Breaker

**구현:**
```typescript
// patterns/circuit-breaker.ts
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private threshold = 5,
    private timeout = 60000  // 1분
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
        logger.info('Circuit breaker entering HALF_OPEN');
      } else {
        throw new CircuitOpenError('API 호출이 일시 중단되었습니다');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      logger.info('Circuit breaker recovered');
    }
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      logger.error('Circuit breaker opened', { failures: this.failures });
    }
  }
}
```

**적용:**
```typescript
const claudeBreaker = new CircuitBreaker(5, 60000);

async function callClaudeAPI(prompt: string) {
  return claudeBreaker.execute(async () => {
    return anthropic.messages.create({ model: 'claude-3-haiku', messages: prompt });
  });
}
```

---

## Phase 4: 운영 준비

### 3.11 문서화 구조

**생성할 파일:**
```
botame-admin/
  .env.example           ← 추가
  DEPLOYMENT.md          ← 추가
  CONTRIBUTING.md        ← 추가
  automation/
    README.md            ← 추가
```

**배포 가이드 (DEPLOYMENT.md):**
```markdown
# 배포 가이드

## 개발 빌드
npm run dev

## 프로덕션 빌드
npm run build

## Windows 패키징
npm run build:win

## 설치자 생성
npm run dist

## GitHub Release
1. 버전 bump: npm version patch
2. 빌드: npm run build && npm run dist
3. Release: gh release create v1.0.0 ./dist/*.exe
```

---

### 3.12 설정 관리

**중앙화:**
```typescript
// config/index.ts
export const config = {
  app: {
    name: '보탬e 가이드',
    version: app.getVersion(),
    isDev: process.env.NODE_ENV !== 'production'
  },

  api: {
    anthropic: {
      baseUrl: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
      timeout: parseInt(process.env.API_TIMEOUT || '30000'),
      maxRetries: parseInt(process.env.API_MAX_RETRIES || '3')
    },
    supabase: {
      url: process.env.SUPABASE_URL!,
      anonKey: process.env.SUPABASE_ANON_KEY!
    }
  },

  browser: {
    headless: process.env.HEADLESS === 'true',
    viewport: {
      width: parseInt(process.env.VIEWPORT_WIDTH || '1280'),
      height: parseInt(process.env.VIEWPORT_HEIGHT || '800')
    }
  },

  retention: {
    screenshots: parseInt(process.env.RETENTION_SCREENSHOTS || '604800000'), // 7일
    logs: parseInt(process.env.RETENTION_LOGS || '2592000000') // 30일
  }
};

// 검증
export function validateConfig() {
  const required = [
    ['api.supabase.url', config.api.supabase.url],
    ['api.supabase.anonKey', config.api.supabase.anonKey]
  ];

  for (const [key, value] of required) {
    if (!value) {
      throw new FatalError(`${key} is not set`);
    }
  }
}
```

---

### 3.13 데이터 보존 정책

```typescript
// services/retention.service.ts
export class RetentionService {
  private policies = {
    screenshots: 7 * 24 * 60 * 60 * 1000,  // 7일
    domSnapshots: 1 * 24 * 60 * 60 * 1000, // 1일
    logs: 30 * 24 * 60 * 60 * 1000         // 30일
  };

  async cleanup() {
    const now = Date.now();
    const deleted = {
      screenshots: 0,
      domSnapshots: 0,
      logs: 0
    };

    // Screenshots
    const oldScreenshots = await this.db.screenshots.find({
      createdAt: { $lt: now - this.policies.screenshots }
    });
    for (const screenshot of oldScreenshots) {
      await this.fs.unlink(screenshot.path);
      await this.db.screenshots.delete(screenshot.id);
      deleted.screenshots++;
    }

    // DOM snapshots
    deleted.domSnapshots = await this.db.domSnapshots.deleteMany({
      createdAt: { $lt: now - this.policies.domSnapshots }
    });

    // Logs
    deleted.logs = await this.db.logs.deleteMany({
      timestamp: { $lt: now - this.policies.logs }
    });

    logger.info('Cleanup completed', deleted);
  }

  async enforceSizeLimit(maxBytes: number) {
    const totalSize = await this.calculateTotalSize();

    if (totalSize > maxBytes) {
      logger.warn('Size limit exceeded, cleaning oldest', { totalSize, maxBytes });
      await this.cleanupOldestUntil(maxBytes * 0.8); // 80% 목표
    }
  }
}
```

---

### 3.14 First-Run Wizard

**UI 플로우:**
```
1. 환영 메시지
   ↓
2. API Key 입력
   - Anthropic Claude API Key
   - Supabase URL (기본값 제공)
   - Supabase Anon Key
   ↓
3. 브라우저 설치 확인
   - Playwright 브라우저 다운로드
   - 진행률 표시
   ↓
4. 테스트 실행
   - 데모 플레이북 실행
   - 성공 메시지
   ↓
5. 완료
   - 메인 화면으로 이동
```

---

## Phase 5: 테스트 & 릴리스

### 3.15 통합 테스트 시나리오

```typescript
// e2e/complete-user-journey.spec.ts
import { test, expect } from '@playwright/test';

test.describe('User Journey', () => {
  test('신규 사용자 설치 및 첫 실행', async ({ page }) => {
    // 1. 앱 설치
    await page.goto('app://');

    // 2. First-run wizard
    await expect(page.locator('text=환영합니다')).toBeVisible();
    await page.fill('#api-key', 'sk-ant-xxx');
    await page.click('button:has-text("다음")');

    // 3. 브라우저 설치
    await expect(page.locator('text=브라우저 설치 중')).toBeVisible();
    await expect(page.locator('text=설치 완료')).toBeVisible({ timeout: 60000 });

    // 4. 테스트 실행
    await page.click('button:has-text("테스트 실행")');
    await expect(page.locator('text=성공')).toBeVisible();

    // 5. 메인 화면
    await expect(page.locator('text=플레이북 카탈로그')).toBeVisible();
  });

  test('플레이북 실행 및 자동 고침', async () => {
    // 카탈로그에서 플레이북 선택
    // 실행 버튼 클릭
    // 자동 고침 발생 시나리오 주입
    // 복구 성공 확인
  });

  test('오프라인 모드', async () => {
    // 오프라인 시뮬레이션
    // 로컬 캐시된 플레이북 실행
    // 온라인 복귀 시 동기화
  });
});
```

---

### 3.16 성능 벤치마크

**목표:**
- 10스텝 플레이북: <60초
- 앱 시작 시간: <3초
- 메모리 사용: <500MB
- 첫 플레이북 로딩: <2초

**측정:**
```typescript
// benchmarks/playbook-execution.bench.ts
import { benchmark } from 'vitest';

benchmark('플레이북 실행', async () => {
  const service = new PlaybookRunnerService(browser);
  await service.runPlaybook(testPlaybook);
}, { iterations: 10 });

benchmark('Self-healing', async () => {
  const service = new PlaybookRunnerService(browser);
  await service.runPlaybook(failingSelectorPlaybook);
});
```

---

### 3.17 보안 체크리스트

**Electron 보안:**
- [ ] ✅ Sandbox 활성화
- [ ] ✅ Context isolation 활성화
- [ ] ✅ Node integration 비활성화
- [ ] ✅ CSP (Content Security Policy) 설정
- [ ] ✅ preload script만 통한 IPC

**데이터 보안:**
- [ ] ✅ API Key 암호화 저장
- [ ] ✅ HTTPS만 사용 (외부 API)
- [ ] ✅ 스크린샷/DOM 암호화 (옵션)

**코드 보안:**
- [ ] `npm audit` 취약점 없음
- [ ] Dependency 최신 상태
- [ ]_eval(), new Function() 없음
- [ ] 사용자 입력 검증

---

## 4. 일정 및 마일스톤

| 주차 | Phase | 주요 작업 | 산출물 |
|------|-------|-----------|--------|
| 1주차 | 1 | API Key 보안, Sandbox, Auto-updater, 에러 처리 | 보안 강화된 앱 |
| 2주차 | 2 | 테스트 확대, 로거, 타입 안전성, 기술 부채 | 테스트 커버리지 70%+ |
| 3주차 | 3 | 오프라인 모드, 모니터링, Circuit Breaker | 오프라인 지원 |
| 4주차 | 4 | 문서화, 설정 관리, 데이터 보존, 온보딩 | 운영 문서 완성 |
| 5주차 | 5 | 통합 테스트, 성능 벤치마크, 보안 감사, 릴리스 | v1.0.0 릴리스 |

**총 예상 기간:** 5주

---

## 5. 리스크 및 완화

### 5.1 기술적 리스크

**리스크 1: Sandbox 활성화 시 IPC 리팩토맅 과부하**
- **확률:** 중간
- **영향:** 2-3일 지연
- **완화:** IPC 리팩토링을 별도 태스크로 분리, 사전 테스트

**리스크 2: 오프라인 모드 IndexedDB 호환성 문제**
- **확률:** 낮음
- **영향:** 1일 지연
- **완화:** NeDB 등 fallback 고려

**리스크 3: Auto-updater 서버 운영 비용**
- **확률:** 낮음
- **영향:** 월 $5-10
- **완화:** GitHub Releases 무료 사용

### 5.2 일정적 리스크

**리스크: 전체 일정 5주 초과 가능성**
- **확률:** 중간
- **완화:** Phase별 우선순위 조정, 필수 항목 먼저 완료

---

## 6. 성공 기준

### 6.1 기술적 지표

- [ ] 테스트 커버리지: 70% 이상
- [ ] TypeScript 에러: 0개
- [ ] ESLint 경고: 0개
- [ ] 성능 벤치마크: 모든 목표 달성
- [ ] 보안 감사: 모든 항목 통과

### 6.2 사용자 경험

- [ ] First-run wizard 이탈률: <10%
- [ ] 오프라인 모드 작동: 100%
- [ ] 업데이트 성공률: >95%
- [ ] 에러 복구률: >90%

### 6.3 운영

- [ ] 문서 완결도: 100%
- [ ] 배포 자동화: 완료
- [ ] 모니터링: 운영 중

---

## 7. 다음 단계

1. **이 문서 검토 및 승인**
2. **Phase 1부터 순차적 구현**
3. **주간 진행 상황 검토**
4. **필요 시 계획 조정**

---

## 부록: 기술 참고

### A.1 Electron Security Checklist
https://www.electronjs.org/docs/latest/tutorial/security

### A.2 electron-updater 문서
https://www.electron.build/auto-update

### A.3 Winston 로거
https://github.com/winstonjs/winston

### A.4 Circuit Breaker 패턴
https://martinfowler.com/bliki/CircuitBreaker.html
