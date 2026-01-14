# 보탬e 전면 리팩토링 구현 계획

**버전:** 1.0.0
**날짜:** 2026-01-14
**관련 문서:** [comprehensive-refactoring-design.md](./2026-01-14-comprehensive-refactoring-design.md)

---

## 개요

이 문서는 설계 문서의 각 Phase를 실행 가능한 작은 단계로 분리한 구현 계획입니다.

---

## Phase 1: 보안 & 안정성 (24시간, ~3일)

### Task 1.1: API Key 보안 강화 (4시간)

**1.1.1 CredentialsService 구현** (2시간)
- [ ] `electron/services/credentials.service.ts` 생성
  - [ ] `setApiKey(service, key)` 메서드
  - [ ] `getApiKey(service)` 메서드
  - [ ] `deleteApiKey(service)` 메서드
  - [ ] Electron safeStorage 사용
- [ ] 단위 테스트 작성
- [ ] TypeScript 컴파일 확인

**1.1.2 First-Run Wizard UI** (1.5시간)
- [ ] `src/components/onboarding/ApiKeySetup.tsx` 생성
  - [ ] API Key 입력 폼
  - [ ] Anthropic/Supebase 키 분리
  - [ ] 표시/숨김 토글
  - [ ] 유효성 검사 버튼
- [ ] 스타일링 (Tailwind)

**1.1.3 Main Process 통합** (30분)
- [ ] `main.ts`에서 CredentialsService 초기화
- [ ] IPC 핸들러 등록
  - [ ] `credentials:set`
  - [ ] `credentials:get`
  - [ ] `credentials:validate`

**산출물:**
- API Key 암호화 저장 시스템
- First-run wizard 첫 화면

---

### Task 1.2: Electron Sandbox 활성화 (6시간)

**1.2.1 현재 상태 분석** (1시간)
- [ ] 모든 IPC 채널 나열
- [ ] nodeDependency 파악
- [ ] preload script 현황 확인

**1.2.2 Preload Script 재설계** (2시간)
- [ ] `electron/preload/index.ts` 작성
  - [ ] contextBridge.exposeInMainWorld 구조
  - [ ] 타입 안전한 API 정의
- [ ] 기존 IPC 호출 이관

**1.2.3 Main Process Sandbox 활성화** (2시간)
- [ ] `main.ts`에서 sandbox: true로 변경
- [ ] webPreferences 업데이트
  ```typescript
  {
    sandbox: true,
    nodeIntegration: false,
    contextIsolation: true,
    preload: path.join(__dirname, 'preload/index.js')
  }
  ```
- [ ] IPC 보안 검증 (allowlist)

**1.2.4 테스트 및 검증** (1시간)
- [ ] 앱 실행 테스트
- [ ] 모든 IPC 통신 확인
- [ ] console.log 제거

**산출물:**
- Sandbox 활성화된 앱
- 보안된 IPC 구조

---

### Task 1.3: Auto-Updater 구현 (8시간)

**1.3.1 electron-builder 설정** (2시간)
- [ ] `electron-builder.yml` 생성/수정
  ```yaml
  publish:
    provider: github
    owner: gopeace88
    repo: botaem
  ```
- [ ] `package.json` scripts 추가
- [ ] Windows/macOS/Linux 별 설정

**1.3.2 Auto-updater 서비스** (3시간)
- [ ] `electron/services/auto-update.service.ts` 생성
  - [ ] `checkForUpdates()` 메서드
  - [ ] `downloadUpdate()` 메서드
  - [ ] `installAndRestart()` 메서드
- [ ] 이벤트 핸들러
  - [ ] update-available
  - [ ] update-downloaded
  - [ ] error

**1.3.3 UI 컴포넌트** (2시간)
- [ ] `src/components/UpdateNotification.tsx` 생성
  - [ ] 업데이트 가능 알림
  - [ ] 다운로드 진행률
  - [ ] "지금 재시업" 버튼
- [ ] 메인 화면에 통합

**1.3.4 GitHub Releases 설정** (1시간)
- [ ] Release workflow 테스트
- [ ] 버전 태그 규칙 정의
- [ ] Changelog 자동화

**산출물:**
- Auto-updater 시스템
- 업데이트 UI

---

### Task 1.4: 에러 처리 시스템 (6시간)

**1.4.1 Error Class 계층 구조** (2시간)
- [ ] `electron/errors/base.ts` 생성
  - [ ] `RecoverableError` 클래스
  - [ ] `FatalError` 클래스
  - [ ] `OfflineError` 클래스
  - [ ] `ValidationError` 클래스
- [ ] 타입 정의

**1.4.2 Error Handler 구현** (2시간)
- [ ] `electron/errors/handler.ts` 생성
  - [ ] `handle(error)` 메서드
  - [ ] 로깅 통합
  - [ ] 사용자 알림 토스트
  - [ ] 서버 전송 (선택)

**1.4.3 에러 UI** (1시간)
- [ ] `src/components/ErrorDialog.tsx` 생성
  - [ ] 친화적인 한글 메시지
  - [ ] 해결 방법 제시
  - [ ] 로그 복사 버튼

**1.4.4 전역 에러 핸들러 등록** (1시간)
- [ ] main.ts uncaughtException
- [ ] renderer unhandledRejection
- [ ] Playbook 실행 에러 처리

**산출물:**
- 계층적 에러 시스템
- 사용자 친화적 에러 UI

---

## Phase 2: 코드 품질 (26시간, ~3일)

### Task 2.1: 테스트 커버리지 확대 (12시간)

**2.1.1 Test Infrastructure 설정** (1시간)
- [ ] Vitest 설정 확인
- [ ] Test utilities 작성
  - [ ] Mock Playwright Browser
  - [ ] Mock IPC
  - [ ] Test fixtures

**2.1.2 botame-admin Service 테스트** (6시간)
- [ ] `playbook-runner.service.test.ts`
  - [ ] 플레이북 실행 성공
  - [ ] 셀렉터 실패 처리
  - [ ] Self-healing 동작
- [ ] `recording.service.test.ts`
- [ ] `browser.service.test.ts`
- [ ] `supabase.service.test.ts`

**2.1.3 Component 테스트** (3시간)
- [ ] `RunnerPanel.test.tsx`
- [ ] `RecordingPanel.test.tsx`
- [ ] `FailureInbox.test.tsx`
- [ ] React Testing Library 설정

**2.1.4 E2E 테스트** (2시간)
- [ ] `playwright/e2e/admin.spec.ts`
  - [ ] 플레이북 생성
  - [ ] 실행 및 검증
- [ ] `playwright/e2e/guide.spec.ts`
  - [ ] 로그인 시나리오

**산출물:**
- 20+ 개의 테스트 파일
- 커버리지 70%+

---

### Task 2.2: 로거 프레임워크 도입 (6시간)

**2.2.1 Winston 설정** (2시간)
- [ ] `npm install winston`
- [ ] `logger/index.ts` 생성
  - [ ] file transport (error.log, combined.log)
  - [ ] console transport (dev only)
  - [ ] format 설정 (json 개발용, text 운영용)
- [ ] log rotation 설정

**2.2.2 마이그레이션 스크립트** (3시간)
- [ ] `scripts/migrate-logs.ts` 작성
  - [ ] console.log → logger.info 변환
  - [ ] console.error → logger.error 변환
  - [ ] console.warn → logger.warn 변환
- [ ] 자동 변환 실행
- [ ] 수동 검토 및 수정

**2.2.3 로거 통합** (1시간)
- [ ] 모든 서비스 파일에서 logger import
- [ ] main.ts 통합
- [ ] 테스트 통합

**산출물:**
- Winston 기반 로거
- 모든 console.log 제거

---

### Task 2.3: 타입 안전성 강화 (4시간)

**2.3.1 any 타입 제거** (3시간)
- [ ] `accessibility.service.ts` 수정
  - [ ] `ElementInfo[]` 인터페이스 정의
  - [ ] `any[]` 제거
- [ ] `playbook-sync.service.ts` 수정
- [ ] `ai-selector.service.ts` 수정
- [ ] 전체 코드베이스 검색 (`any`)

**2.3.2 ESLint 규칙 강화** (1시간)
- [ ] `.eslintrc.js` 수정
  ```javascript
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-call': 'error'
  }
  ```
- [ ] 모든 에러 수정

**산출물:**
- `any` 타입 제거
- 타입 안전성 100%

---

### Task 2.4: 기술 부채 해소 (4시간)

**2.4.1 뷰포트 중앙화** (1시간)
- [ ] `config/viewport.ts` 생성
  ```typescript
  export const VIEWPORT = {
    DEFAULT: { width: 1280, height: 800 },
    FULL_HD: { width: 1920, height: 1080 }
  };
  ```
- [ ] 모든 하드코딩된 뷰포트 교체

**2.4.2 Magic Numbers 제거** (1시간)
- [ ] `config/constants.ts` 생성
  - [ ] TIMEOUT_DEFAULT = 30000
  - [ ] RETRY_MAX = 3
  - [ ] HEALING_THRESHOLD = 5
- [ ] 모든 magic number 교체

**2.4.3 Dead Code 제거** (1시간)
- [ ] 미사용 import 제거
- [ ] 미사용 함수 제거
- [ ] 주석 처리된 코드 제거

**2.4.4 중복 제거** (1시간)
- [ ] 중복된 유틸리티 함수 통합
- [ ] 중복된 타입 정의 통합

**산출물:**
- 중앙화된 설정
- 깔끔한 코드베이스

---

## Phase 3: 기능 완성 (26시간, ~3일)

### Task 3.1: 오프라인 모드 (12시간)

**3.1.1 IndexedDB 설정** (3시간)
- [ ] `npm install idb`
- [ ] `services/storage/indexed-db.ts` 생성
  - [ ] DB 초기화
  - [ ] 스토어 정의 (playbooks, cache, pending-sync)
  - [ ] CRUD 메서드

**3.1.2 Playbook Cache Service** (4시간)
- [ ] `services/playbook-cache.service.ts` 생성
  - [ ] `getPlaybook(id)` - 로컬 우선
  - [ ] `invalidate(id)` - 캐시 무효화
  - [ ] `prefetch(ids)` - 사전 로딩
  - [ ] 오프라인 감지

**3.1.3 동기화 큐** (3시간)
- [ ] `services/sync-queue.service.ts` 생성
  - [ ] `enqueue(action)` - 오프라인 시 큐에 추가
  - [ ] `process()` - 온라인 시 배치 처리
  - [ ] conflict resolution

**3.1.4 오프라인 UI** (2시간)
- [ ] `components/OfflineBanner.tsx` 생성
  - [ ] "오프라인 상태입니다" 메시지
  - [ ] 보류 중인 작업 수 표시
- [ ] 메인 화면에 통합

**산출물:**
- 오프라인 플레이북 실행
- 자동 동기화

---

### Task 3.2: 성능 모니터링 (8시간)

**3.2.1 Telemetry Service** (3시간)
- [ ] `services/telemetry.service.ts` 생성
  - [ ] `trackPlaybookExecution()` 메서드
  - [ ] `trackSelfHealing()` 메서드
  - [ ] `trackAPICall()` 메서드
  - [ ] `getStats()` 메서드

**3.2.2 Metrics Collection** (2시간)
- [ ] PlaybookRunner에서 트래킹 추가
  - [ ] 시작/종료 시간
  - [ ] 성공/실패
  - [ ] 사용된 healing 전략
- [ ] API 호출 트래킹

**3.2.3 Dashboard UI** (3시간)
- [ ] `pages/Dashboard.tsx` 생성
  - [ ] 실행 통계 차트
  - [ ] Healing 성공률
  - [ ] API 비용
  - [ ] 최근 실패 목록

**산출물:**
- 성능 모니터링 시스템
- 분석 대시보드

---

### Task 3.3: Circuit Breaker (6시간)

**3.3.1 CircuitBreaker 구현** (2시간)
- [ ] `patterns/circuit-breaker.ts` 생성
  - [ ] 상태 관리 (CLOSED, OPEN, HALF_OPEN)
  - [ ] `execute()` 메서드
  - [ ] `onSuccess()`, `onFailure()`
  - [ ] 타이머 및 복구 로직

**3.3.2 Claude API에 적용** (2시간)
- [ ] `api/claude-api.ts`에 circuit breaker 래핑
- [ ] AnthropicService에서 사용
- [ ] fallback 동작 정의

**3.3.3 Supabase에 적용** (1시간)
- [ ] SupabaseService에 circuit breaker 추가
- [ ] 로컬 캐시 fallback

**3.3.4 모니터링** (1시간)
- [ ] 상태 변경 로깅
- [ ] 알림 UI (API 일시 중단 메시지)

**산출물:**
- Circuit Breaker 패턴 구현
- API 과도 호출 방지

---

## Phase 4: 운영 준비 (20시간, ~2.5일)

### Task 4.1: 문서화 작성 (6시간)

**4.1.1 .env.example 작성** (30분)
- [ ] `botame-admin/.env.example` 생성
- [ ] 모든 환경변수 나열
- [ ] 주석 추가

**4.1.2 배포 가이드 작성** (2시간)
- [ ] `DEPLOYMENT.md` 생성
  - [ ] 빌드 절차
  - [ ] 패키징 방법
  - [ ] GitHub Release 절차
  - [ ] 트러블슈팅

**4.1.3 CONTRIBUTING.md 작성** (2시간)
- [ ] `CONTRIBUTING.md` 생성
  - [ ] 개발 환경 설정
  - [ ] 커밋 컨벤션
  - [ ] PR 프로세스
  - [ ] 코드 스타일
  - [ ] 테스트 실행 방법

**4.1.4 automation/README.md** (1시간)
- [ ] Python 스크립트 설명
- [ ] 의존성 설치 방법
- [ ] 사용 예시
- [ ] 주의사항

**4.1.5 CHANGELOG.md 시작** (30분)
- [ ] `CHANGELOG.md` 생성
- [ ] 지금까지의 변경사항 정리
- [ ] 포맷 정의

**산출물:**
- 5개의 문서 파일
- 기여자 가이드

---

### Task 4.2: 설정 관리 개선 (4시간)

**4.2.1 config/index.ts 생성** (2시간)
- [ ] `config/index.ts` 생성
  - [ ] app, api, browser, retention 설정
  - [ ] 환경변수 로드
  - [ ] 기본값 정의

**4.2.2 설정 검증** (1시간)
- [ ] `validateConfig()` 함수 작성
- [ ] 필수 항목 체크
- [ ] 앱 시작 시 검증

**4.2.3 설정 UI** (1시간)
- [ ] `pages/Settings.tsx` 생성
  - [ ] API Key 설정
  - [ ] 브라우저 설정
  - [ ] 로그 레벨 설정
  - [ ] 데이터 보존 기간 설정

**산출물:**
- 중앙화된 설정
- 설정 UI

---

### Task 4.3: 데이터 보존 정책 (4시간)

**4.3.1 Retention Service** (2시간)
- [ ] `services/retention.service.ts` 생성
  - [ ] `cleanup()` 메서드
  - [ ] `enforceSizeLimit()` 메서드
  - [ ] 정책 정의 (7일, 1일, 30일)

**4.3.2 스케줄러** (1시간)
- [ ] node-cron 사용
- [ ] 앱 시작 시 cleanup 실행
- [ ] 주기적 cleanup (매일 새벽 3시)

**4.3.3 UI 추가** (1시간)
- [ ] 설정 화면에 보존 기간 표시
- [ ] "지금 정리" 버튼
- [ ] 현재 사용량 표시

**산출물:**
- 데이터 보존 정책
- 자동 cleanup 시스템

---

### Task 4.4: First-Run Wizard 완성 (6시간)

**4.4.1 Wizard Flow** (2시간)
- [ ] `components/onboarding/Welcome.tsx`
- [ ] `components/onboarding/ApiKeySetup.tsx`
- [ ] `components/onboarding/BrowserInstall.tsx`
- [ ] `components/onboarding/TestRun.tsx`
- [ ] `components/onboarding/Complete.tsx`

**4.4.2 State Management** (2시간)
- [ ] onboarding 상태 관리
- [ ] 단계별 진행률
- [ ] 건너뛰기 가능 여부

**4.4.3 브라우저 설치** (1시간)
- [ ] Playwright 브라우저 다운로드
- [ ] 진행률 표시
- [ ] 설치 완료 확인

**4.4.4 데모 플레이북** (1시간)
- [ ] 간단한 테스트 플레이북 작성
- [ ] 자동 실행
- [ ] 성공 메시지

**산출물:**
- First-run wizard
- 신규 사용자 온보딩

---

## Phase 5: 테스트 & 릴리스 (30시간, ~4일)

### Task 5.1: 통합 테스트 (12시간)

**5.1.1 E2E 테스트 작성** (6시간)
- [ ] `e2e/complete-journey.spec.ts`
  - [ ] 신규 사용자 설치
  - [ ] First-run wizard 완료
  - [ ] 플레이북 실행
  - [ ] 자동 고침 발생
  - [ ] 업데이트 설치
- [ ] `e2e/offline-mode.spec.ts`
  - [ ] 오프라인 플레이북 실행
  - [ ] 온라인 복귀 시 동기화

**5.1.2 통합 테스트** (4시간)
- [ ] Playbook 실행 전체 흐름
- [ ] Self-healing 전략별 동작
- [ ] IPC 통신 테스트
- [ ] 오프라인 모드 테스트

**5.1.3 테스트 자동화** (2시간)
- [ ] CI workflow 작성 (GitHub Actions)
- [ ] PR 시 자동 테스트
- [ ] 결과 보고

**산출물:**
- 10+ 개의 E2E 테스트
- CI/CD 파이프라인

---

### Task 5.2: 성능 벤치마크 (8시간)

**5.2.1 Benchmark Suite** (3시간)
- [ ] `benchmarks/playbook-execution.bench.ts`
- [ ] `benchmarks/self-healing.bench.ts`
- [ ] `benchmarks/api-calls.bench.ts`

**5.2.2 최적화** (4시간)
- [ ] 병목 지점 찾기
- [ ] 불필요한 재렌더링 제거
- [ ] 이미지 캐싱
- [ ] 지연 로딩
- [ ] Web Worker 사용 (필요시)

**5.2.3 목표 달성 확인** (1시간)
- [ ] 10스텝 <60초
- [ ] 앱 시작 <3초
- [ ] 메모리 <500MB

**산출물:**
- 성능 최적화
- 벤치마크 결과

---

### Task 5.3: 보안 감사 (6시간)

**5.3.1 Electron Security** (2시간)
- [ ] 체크리스트 확인
  - [ ] Sandbox 활성화 ✅
  - [ ] Context isolation ✅
  - [ ] Node integration disabled ✅
  - [ ] CSP 설정
- [ ] 보안 헤점 점검

**5.3.2 Dependency Audit** (2시간)
- [ ] `npm audit` 실행
- [ ] 취약점 수정
- [ ] 의존성 업데이트
- [ ] License 확인

**5.3.3 Code Security** (2시간)
- [ ] eval(), new Function() 검색
- [ ] 사용자 입력 검증 확인
- [ ] XSS 취약점 점검
- [ ] SQL Injection 확인 (Supabase)

**산출물:**
- 보안 감사 보고서
- 모든 항목 통과

---

### Task 5.4: 릴리스 준비 (4시간)

**5.4.1 체크리스트** (1시간)
- [ ] 모든 테스트 통과 ✅
- [ ] 문서 완성 ✅
- [ ] CHANGELOG 작성 ✅
- [ ] 버전 태그
- [ ] GitHub Release

**5.4.2 버전 관리** (1시간)
- [ ] package.json 버전 bump
- [ ] CHANGELOG.md 업데이트
- [ ] git tag 생성

**5.4.3 Release 빌드** (1시간)
- [ ] Windows 빌드
- [ ] macOS 빌드 (가능시)
- [ ] Linux 빌드
- [ ] 설치자 테스트

**5.4.4 배포** (1시간)
- [ ] GitHub Release 생성
- [ ] 릴리스 노트 작성
- [ ] 사용자 공지

**산출물:**
- v1.0.0 릴리스
- 배포 완료

---

## 이행 계획

### Week 1: Phase 1
- Day 1-2: Task 1.1, 1.2
- Day 3-4: Task 1.3
- Day 5: Task 1.4

### Week 2: Phase 2
- Day 6-7: Task 2.1
- Day 8: Task 2.2
- Day 9: Task 2.3, 2.4

### Week 3: Phase 3
- Day 10-12: Task 3.1
- Day 13: Task 3.2
- Day 14: Task 3.3

### Week 4: Phase 4
- Day 15-16: Task 4.1
- Day 17: Task 4.2
- Day 18: Task 4.3
- Day 19: Task 4.4

### Week 5: Phase 5
- Day 20-22: Task 5.1
- Day 23: Task 5.2
- Day 24: Task 5.3
- Day 25: Task 5.4

---

## 진행 상황 추적

### Phase 완료 기준
- [ ] 모든 Task의 체크박스 완료
- [ ] 관련 테스트 통과
- [ ] Code Review 완료
- [ ] Git commit & push

### 마일스톤
- **M1** (Week 1 말): 보안 강화 완료
- **M2** (Week 2 말): 코드 품질 달성 (70% 커버리지)
- **M3** (Week 3 말): 오프라인 모드 작동
- **M4** (Week 4 말): 운영 문서 완성
- **M5** (Week 5 말): v1.0.0 릴리스

---

## 다음 단계

1. **이 문서 검토**
2. **Phase 1, Task 1.1부터 시작**
3. **매일 진행 상황 기록**
4. **필요 시 계획 조정**
