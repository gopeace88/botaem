# 보탬e 프로젝트 마스터 설계 문서

> **버전**: 2.1.0
> **작성일**: 2025-12-05
> **상태**: 정합성 검토 완료

---

## 1. 프로젝트 비전

### 1.1 한 문장 요약

```
"사전 지식 기반의 지능형 업무 자동화 가이드"
```

### 1.2 핵심 가치

| 가치 | 설명 |
|------|------|
| **사전 지식** | 코드 작성 전에 문서 분석 → 계층구조 파악 → 업무흐름 수립 |
| **녹화 검증** | 추측하지 않고 실제 녹화로 검증, 사전 지식과 불일치 시에만 AI 사용 |
| **사용자 주도** | 자동 실행보다 가이드 우선, 사용자가 직접 조작하며 학습 |
| **선택적 수정** | 단계별 미리보기로 잘못된 부분만 사용자가 직접 수정 가능 |

---

## 2. 시스템 구성요소

### 2.1 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              보탬e 시스템 구조                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐           │
│  │  botame-admin   │   │   Supabase DB   │   │ botame-guide-app│           │
│  │  (관리자 도구)   │──▶│   (원본 저장소)  │◀──│   (사용자 앱)    │           │
│  └─────────────────┘   └─────────────────┘   └─────────────────┘           │
│         │                      │                      │                     │
│         │                      │                      │                     │
│  플레이북 작성           원본 플레이북 저장        DB 동기화                   │
│  사이트 분석            실행 이력 저장          Lazy Sync                   │
│  승인/배포              사용자 설정             로컬 캐시                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             대상 시스템                                      │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    보탬e (www.losims.go.kr)                          │   │
│  │                    지방보조금관리시스템                                │   │
│  │                                                                     │   │
│  │  - Framework: eXBuilder6 (Cleopatra)                               │   │
│  │  - 동적 UUID 요소 ID                                                │   │
│  │  - SPA 구조                                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 3개의 앱

| 앱 | 역할 | 사용자 |
|----|------|--------|
| **botame-admin** | 플레이북 작성, 사이트 분석, 승인/배포 | 관리자 |
| **botame-guide-app** | 플레이북 실행, 가이드 제공, 사용자 지원 | 일반 사용자 |
| **Supabase** | 데이터 원본 저장, 인증, 동기화 | (백엔드) |

---

## 3. 핵심 개념 정의

### 3.1 플레이북 (Playbook)

```yaml
# 정의: 업무 자동화 시나리오를 정의한 YAML/JSON 파일
# 구성: id + version + metadata + variables + preconditions + steps + error_handlers
# 참조: Docs/specs/PLAYBOOK-SPEC.md

id: "botame-login"           # 고유 식별자 (slug, pattern: ^[a-z0-9-]+$)
version: "1.0.0"             # 시맨틱 버전

metadata:
  title: "보탬e 로그인"       # 표시 제목 (PRD에서는 name으로 표기하기도 함)
  description: "보탬e 시스템에 로그인합니다"
  category: "회원관리"        # enum: 회원관리, 사업선정, 교부관리, 집행관리, 정산관리, 사후관리, 기타
  difficulty: "쉬움"          # enum: 쉬움, 보통, 어려움
  estimated_time: "1분"
  tags: ["로그인", "기초"]

variables:
  user_id:
    type: string
    label: "사용자 ID"
    required: true
  password:
    type: string
    label: "비밀번호"
    required: true

preconditions:
  - check: "브라우저가 실행되어 있어야 합니다"
    message: "브라우저를 먼저 실행해주세요"
    action: "block"           # enum: warn, block

steps:
  - id: "step1"
    action: "navigate"        # enum: navigate, click, type, select, wait, assert, highlight, guide, condition, loop
    value: "https://www.losims.go.kr/lss.do"
    wait_for: "navigation"    # enum: element, navigation, network, user
    timeout: 30000
    verify:                   # Step 검증 (Interactive Watch & Guide)
      success_url_contains: "lss.do"
      fallback_vision: true   # DOM 검증 실패 시 Vision API 사용 여부

error_handlers:
  - match: "timeout"
    action: "retry"           # enum: retry, skip, abort, guide
    message: "다시 시도합니다..."
```

> **Note**: `metadata.title`과 `metadata.name`은 동일한 의미로 사용됩니다. DB 스키마에서는 `name`을 사용합니다.

### 3.2 실행 모드 3단계

| 모드 | 설명 | 사용자 역할 |
|------|------|------------|
| **가이드 모드** | 화면에 하이라이트만 표시, 사용자가 직접 클릭 | 높음 (직접 조작) |
| **반자동 모드** | 각 단계 확인 후 앱이 클릭 대행 | 중간 (확인만) |
| **자동 모드** | 전체 자동 실행 | 낮음 (모니터링) |

### 3.3 검증 시스템 (Interactive Watch & Guide)

```
사용자 작업 완료 후 검증 흐름:

┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  사용자가    │     │   Step      │     │  다음 단계  │
│  "완료" 클릭 │────▶│   검증      │────▶│   진행      │
└─────────────┘     └─────────────┘     └─────────────┘
                          │
                          │ 검증 실패
                          ▼
                    ┌─────────────┐
                    │  가이드     │
                    │  메시지     │────▶ 재시도
                    └─────────────┘
                          │
                          │ 3회 연속 실패
                          ▼
                    ┌─────────────┐
                    │  수동 모드  │
                    │  전환 안내  │
                    └─────────────┘
```

검증 계층:
1. **DOM 검증** (무료): selector, URL, 텍스트 확인
2. **Vision 검증** (유료 폴백): Claude Vision으로 스크린샷 분석
3. **수동 진행**: 연속 3회 실패 시 사용자가 직접 확인 후 진행

### 3.4 동기화 전략 (Partial Update)

```
┌─────────────────────────────────────────────────────────────────┐
│                     Lazy Sync 전략                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  앱 시작 시:                                                     │
│  ├─ 로컬 캐시 인덱스 로드                                        │
│  ├─ 원격 메타 캐시 조회 (checksum, updated_at만)                  │
│  └─ 실제 플레이북 다운로드 X (목록만)                             │
│                                                                 │
│  플레이북 사용 시:                                               │
│  ├─ needsUpdate(playbookId) 체크                                │
│  │   ├─ 캐시 없음 → 다운로드                                    │
│  │   ├─ checksum 불일치 → 다운로드                              │
│  │   └─ 일치 → 캐시에서 로드 (네트워크 0회)                      │
│  └─ 변경된 것만 동기화                                          │
│                                                                 │
│  효과:                                                          │
│  ├─ 앱 시작 속도 향상 (전체 다운로드 X)                          │
│  ├─ 네트워크 비용 절감                                          │
│  └─ 오프라인 지원 (캐시)                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. 새로운 개념: 단계별 미리보기 & 선택적 수정

### 4.1 문제 인식

```
현재 문제:
- 플레이북 실행 중 한 단계가 실패하면 전체 중단
- 사용자가 어떤 부분이 잘못되었는지 모름
- 전체를 다시 녹화하거나 코드를 수정해야 함
```

### 4.2 해결책: Step Preview & Selective Fix

```
새로운 접근:
1. 각 단계 실행 전에 "이 작업을 할 것입니다" 미리보기
2. 사용자가 확인 후 진행/수정 선택
3. 잘못된 단계만 사용자가 브라우저에서 직접 선택해서 수정
```

### 4.3 동작 흐름

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        Step Preview & Selective Fix                        │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  [Step 3/7] 로그인 버튼을 클릭합니다                                        │
│                                                                            │
│  ┌──────────────────────────────────────────┐                              │
│  │  Preview:                                 │                              │
│  │  ┌─────────────────────────────────────┐ │                              │
│  │  │         브라우저 화면               │ │                              │
│  │  │                                     │ │                              │
│  │  │         [로그인]  ←── 하이라이트   │ │                              │
│  │  │                                     │ │                              │
│  │  └─────────────────────────────────────┘ │                              │
│  │                                          │                              │
│  │  셀렉터: .btn-login:visible >> text=로그인│                              │
│  │  예상 위치: (450, 320)                   │                              │
│  └──────────────────────────────────────────┘                              │
│                                                                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐                          │
│  │   확인   │  │  건너뛰기 │  │  이 단계 수정하기 │                          │
│  └──────────┘  └──────────┘  └──────────────────┘                          │
│                                     │                                      │
│                                     ▼                                      │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  수정 모드:                                                          │  │
│  │                                                                      │  │
│  │  브라우저에서 올바른 요소를 클릭하세요.                                │  │
│  │  현재 선택: (없음)                                                   │  │
│  │                                                                      │  │
│  │  [요소 선택 중...] [취소] [저장]                                      │  │
│  │                                                                      │  │
│  │  * 새로 선택한 셀렉터가 이 단계에 저장됩니다.                          │  │
│  │  * 원본 플레이북은 유지되고, 사용자 오버라이드로 저장됩니다.            │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 4.4 데이터 구조

```typescript
// 사용자 오버라이드 저장 구조
interface UserStepOverride {
  playbook_id: string;
  step_id: string;
  user_id: string;

  // 원본 vs 수정
  original_selector: string;
  override_selector: string;

  // 메타데이터
  override_reason?: string;  // "자동 감지 실패", "다른 요소 선호" 등
  created_at: Date;
  success_count: number;     // 이 오버라이드로 성공한 횟수
}

// 실행 시 오버라이드 적용 로직
async function getEffectiveSelector(step: PlaybookStep, userId: string): Promise<string> {
  // 1. 사용자 오버라이드 확인
  const override = await getUserOverride(step.playbook_id, step.id, userId);
  if (override && override.success_count > 0) {
    return override.override_selector;
  }

  // 2. 원본 셀렉터 사용
  return step.selector;
}
```

### 4.5 UI 상태 머신

```
[대기] ──▶ [미리보기] ──▶ [확인 대기] ──▶ [실행] ──▶ [검증] ──▶ [다음 단계]
              │              │                          │
              │              ├──[수정 모드]──┐           │
              │              │              │           │
              │              └──[건너뛰기]──┘           │
              │                                        │
              └────────────────────────────────────────┘
                          (검증 실패 시)
```

---

## 5. 멤버십 플랜

> 참조: Docs/plans/PRD-botame-guide-assistant.md (Section 5)

### 5.1 플랜 구조

| 구분 | Free | Basic | Pro |
|------|------|-------|-----|
| **월 가격** | 무료 | $30/월 | $65/월 |
| **플레이북** | 기본 10개 | 전체 | 전체 + 커스텀 |
| **Q&A** | 월 50회 | 월 500회 | 무제한 |
| **가이드 모드** | ✅ | ✅ | ✅ |
| **반자동 모드** | ❌ | ✅ | ✅ |
| **자동 모드** | ❌ | ❌ | ✅ |
| **우선 지원** | ❌ | ❌ | ✅ |

### 5.2 비용 제어 전략

```
API 비용 최적화 계층:
├─ L0: 규칙 기반 매칭 (무료)
│   └─ 키워드 패턴으로 플레이북 직접 매칭
├─ L1: Q&A 캐시 (거의 무료)
│   └─ pgvector 유사도 검색
├─ L2: Claude Haiku (저비용)
│   └─ 캐시 미스 시 사용
└─ L3: Claude Vision (고비용)
    └─ DOM 검증 실패 시 폴백
    └─ 연속 3회 실패 시 수동 모드 전환
```

---

## 6. 업무 프로세스 계층구조

### 6.1 전체 업무 흐름

```
보탬e 전체 업무 프로세스 (사전 지식 기반)
│
├── 1. 회원관리
│   ├── 회원가입 (본인인증 → 회원정보입력 → 인증서등록)
│   ├── 단체정보관리 (기관정보등록, 부가세여부설정)
│   └── 구성원관리 (가입승인, 권한부여)
│
├── 2. 사업선정
│   ├── 공모형 (공모신청 → 세부정보입력 → 제출 → 선정)
│   └── 지정형 (수행사업계획신청 → 예산집행계획 → 제출)
│
├── 3. 교부관리
│   ├── 교부신청 (금액입력 → 신청서제출)
│   └── 교부결정 (승인/반려)
│
├── 4. 집행관리  ★ 자동화 핵심
│   ├── 사전준비 (이체인증서, 이체비밀번호, 거래처계좌)
│   ├── 집행등록 (전자세금계산서 / 기타증빙 / 신용카드)
│   └── 집행이체관리 (이체요청 → 비밀번호검증 → 인증 → 이체)
│
└── 5. 정산관리
    ├── 집행마감 (94001)
    ├── 정산검토 (94002)
    ├── 정산마감
    ├── 실적보고서 (94008)
    └── 정산반환/징수처리
```

### 6.2 자동화 우선순위

| 순위 | 작업명 | 자동화 수준 | 효과 |
|------|--------|------------|------|
| 1 | 전자세금계산서 집행등록 | 완전 자동화 | 90% 수작업 감소 |
| 2 | 카드사용내역 집행등록 | 완전 자동화 | 80% 수작업 감소 |
| 3 | 집행이체 일괄처리 | 반자동화 | 70% 시간 단축 |
| 4 | 이자/수익금 등록 | 완전 자동화 | 오류 0% |
| 5 | 정산검토 자동분류 | 규칙 기반 | 30% 사전 분류 |

---

## 7. 데이터베이스 스키마 (통합)

### 7.1 핵심 테이블

```sql
-- 플레이북 (원본)
CREATE TABLE playbooks (
  id UUID PRIMARY KEY,
  playbook_id TEXT UNIQUE NOT NULL,  -- 'botame-login'
  name TEXT NOT NULL,
  category TEXT,
  version TEXT DEFAULT '1.0.0',

  -- 내용
  steps JSONB NOT NULL,
  variables JSONB DEFAULT '{}',
  preconditions JSONB DEFAULT '[]',
  error_handlers JSONB DEFAULT '[]',

  -- 동기화용
  checksum TEXT,
  is_published BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 사용자별 단계 오버라이드 (선택적 수정)
CREATE TABLE user_step_overrides (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  playbook_id TEXT NOT NULL,
  step_id TEXT NOT NULL,

  original_selector TEXT,
  override_selector TEXT NOT NULL,
  override_reason TEXT,

  success_count INT DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, playbook_id, step_id)
);

-- 동기화 상태
CREATE TABLE user_playbook_sync (
  user_id UUID NOT NULL,
  playbook_id UUID NOT NULL,
  synced_version TEXT,
  cache_checksum TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, playbook_id)
);

-- 실행 이력
CREATE TABLE playbook_executions (
  id UUID PRIMARY KEY,
  user_id UUID,
  playbook_id TEXT NOT NULL,
  status TEXT NOT NULL,  -- started, completed, failed

  -- 실패 정보
  failed_step_id TEXT,
  error_message TEXT,

  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

---

## 8. 개념 간 관계 정리

### 8.1 용어 통일

| 용어 | 정의 | 관련 파일/위치 |
|------|------|---------------|
| **플레이북** | 업무 자동화 시나리오 (YAML) | playbooks/*.yaml |
| **스텝** | 플레이북 내 단일 작업 단위 | steps[] |
| **셀렉터** | DOM 요소 식별자 | step.selector |
| **검증** | 스텝 완료 후 성공 확인 | step.verify |
| **오버라이드** | 사용자 커스텀 셀렉터 | user_step_overrides |
| **동기화** | DB ↔ 로컬 캐시 | playbook-sync.service.ts |

### 8.2 실행 흐름 전체도

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            전체 실행 흐름                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [1] 플레이북 선택                                                           │
│       │                                                                     │
│       ▼                                                                     │
│  [2] Lazy Sync (needsUpdate 체크)                                           │
│       │                                                                     │
│       ├─── 최신 → 캐시에서 로드                                              │
│       └─── 구버전 → DB에서 동기화                                            │
│             │                                                               │
│             ▼                                                               │
│  [3] 변수 입력 (사용자)                                                      │
│       │                                                                     │
│       ▼                                                                     │
│  [4] 각 스텝 실행                                                           │
│       │                                                                     │
│       ├─── [4.1] 미리보기 표시 (하이라이트)                                  │
│       │          │                                                          │
│       │          ├─── 확인 → 다음                                           │
│       │          ├─── 수정 → 요소 재선택 → 오버라이드 저장                    │
│       │          └─── 건너뛰기 → 다음                                       │
│       │                                                                     │
│       ├─── [4.2] 사용자 작업 / 자동 실행                                     │
│       │                                                                     │
│       ├─── [4.3] 검증 (DOM 우선, Vision 폴백)                                │
│       │          │                                                          │
│       │          ├─── 성공 → 다음 스텝                                      │
│       │          └─── 실패 → 가이드 → 재시도 또는 수동 진행                   │
│       │                                                                     │
│       └─── [4.4] 다음 스텝으로                                              │
│             │                                                               │
│             ▼                                                               │
│  [5] 완료 / 실패                                                            │
│       │                                                                     │
│       ▼                                                                     │
│  [6] 실행 이력 저장                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. 미해결 과제 & 결정 필요 사항

### 9.1 아직 정의되지 않은 것들

| 항목 | 현재 상태 | 결정 필요 |
|------|----------|----------|
| 플레이북 승인 워크플로우 | 개념만 존재 | 구체적 상태 전이 정의 |
| 멤버십/결제 | PRD에 정의 | 실제 구현 범위 |
| 오프라인 모드 범위 | 캐시만 존재 | 충돌 해결 전략 |
| 버전 롤백 | 테이블만 존재 | UI/UX |
| 팀 기능 | Phase 3 | 권한 모델 |

### 9.2 오늘 추가된 개념

1. **단계별 미리보기** - 실행 전 하이라이트로 확인
2. **선택적 수정** - 잘못된 단계만 사용자가 직접 수정
3. **오버라이드 저장** - 원본 유지, 사용자별 커스텀 저장

### 9.3 검토 필요 사항

- [ ] 오버라이드가 많아지면 원본 플레이북 업데이트 필요성 판단
- [ ] 미리보기 모드에서 성능 (매 단계 하이라이트)
- [ ] 수정 모드에서 요소 선택 UX (Playwright recording 활용?)

---

## 10. 문서 구조

```
보탬e/
├── README.md                      # 프로젝트 진입점
├── Docs/
│   ├── MASTER_DESIGN.md          # ★ 본 문서 (Single Source of Truth)
│   ├── PLAYBOOK_CATALOG.md       # 플레이북 전체 목록 (역할/상태)
│   ├── PLAYBOOK_SYNC_DESIGN.md   # 동기화 상세 설계
│   ├── plans/
│   │   ├── PRD-*.md              # 제품 요구사항 상세
│   │   └── TECHNICAL-SPEC.md     # 기술 구현 상세
│   └── specs/
│       └── PLAYBOOK-SPEC.md      # 플레이북 YAML 스키마
├── analysis_output/               # 보탬e 업무 분석 (매뉴얼 기반)
└── botame-*/                      # 각 앱 디렉토리
    └── .claude/CLAUDE.md         # 앱별 실행 컨텍스트
```

| 문서 | 역할 | 언제 참조 |
|------|------|----------|
| **MASTER_DESIGN.md** | 전체 아키텍처/개념 | 항상 먼저 |
| **PLAYBOOK_CATALOG.md** | 53개 플레이북 목록, 역할, 구현상태 | 플레이북 개발 우선순위 |
| PLAYBOOK-SPEC.md | 플레이북 YAML 스키마 | 플레이북 작성 시 |
| PLAYBOOK_SYNC_DESIGN.md | 동기화 로직 | 동기화 구현 시 |
| .claude/CLAUDE.md | 앱 실행, 환경설정 | 앱 개발 시 |

---

## 11. 버전 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 1.0 | 2025-12-05 | 초기 아키텍처 |
| 2.0 | 2025-12-05 | 통합 설계 문서로 확장, 단계별 미리보기 & 선택적 수정 추가 |
| 2.1 | 2025-12-05 | 정합성 검토, 멤버십 플랜 추가 |
| 2.2 | 2025-12-05 | 문서 정리, 중복 문서 삭제, 계층 구조 단순화 |
| 2.3 | 2025-12-05 | 플레이북 카탈로그 추가 (53개), DB 시드 데이터 생성 |
| 2.4 | 2025-12-05 | Bottom-up 플레이북 설계 원칙 추가 |

---

## 12. Bottom-up 플레이북 설계 원칙 ★★★

### 12.1 핵심 철학

```
사용자의 자연어 요청 → LLM이 적절한 플레이북 체인을 찾아 실행

이를 위해서는:
1. 최하위 원자적 플레이북부터 만들고
2. 이것들을 조합하여 상위 플레이북을 구성하고
3. 최상위에서 자연어와 매핑해야 함
```

### 12.2 계층 구조 (4단계)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     플레이북 계층 구조 (Bottom-up)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Level 4: 자연어 인텐트 (Natural Language Intent)                            │
│  ───────────────────────────────────────────────────────────────────────    │
│  │ "세금계산서 처리해줘"                                                     │
│  │ "이번 달 카드값 정리 좀"                                                  │
│  │ "정산 마감해야 하는데"                                                    │
│  │                                                                          │
│  │  → LLM이 의도 파악 → Level 3 플레이북 선택                                │
│  └──────────────────────────────────────────────────────────────────────    │
│                                      │                                      │
│                                      ▼                                      │
│  Level 3: 업무 시나리오 (Business Scenario)                                  │
│  ───────────────────────────────────────────────────────────────────────    │
│  │ 전자세금계산서_집행등록_시나리오                                           │
│  │ 카드사용내역_집행등록_시나리오                                            │
│  │ 정산마감_시나리오                                                        │
│  │                                                                          │
│  │  구성: Level 2 플레이북들의 순차 조합                                     │
│  │  예: 세금계산서_집행 = [로그인 → 메뉴이동 → 세금계산서조회 → 등록 → 저장]  │
│  └──────────────────────────────────────────────────────────────────────    │
│                                      │                                      │
│                                      ▼                                      │
│  Level 2: 기능 단위 (Functional Unit)                                       │
│  ───────────────────────────────────────────────────────────────────────    │
│  │ 로그인                    = [아이디입력 → 비밀번호입력 → 로그인버튼클릭]    │
│  │ 메뉴이동_집행관리          = [집행관리클릭 → 집행등록클릭]                  │
│  │ 전자세금계산서_조회        = [조회조건입력 → 조회버튼클릭 → 결과대기]       │
│  │ 거래처정보_입력            = [사업자번호입력 → 확인클릭 → 계좌입력]         │
│  │                                                                          │
│  │  구성: Level 1 원자적 액션들의 조합                                       │
│  │  특징: 재사용 가능한 기능 블록                                            │
│  └──────────────────────────────────────────────────────────────────────    │
│                                      │                                      │
│                                      ▼                                      │
│  Level 1: 원자적 액션 (Atomic Action) ★ 가장 중요                            │
│  ───────────────────────────────────────────────────────────────────────    │
│  │ click_button              selector: '[role="button"][aria-label="조회"]'│
│  │ type_input                selector: '#userId', value: '{{user_id}}'     │
│  │ select_dropdown           selector: '#yearSelect', value: '2024'        │
│  │ wait_for_element          selector: '.loading-complete'                 │
│  │ assert_text               selector: '.result-count', contains: '건'     │
│  │                                                                          │
│  │  특징:                                                                   │
│  │  - 단일 DOM 조작                                                        │
│  │  - 명확한 성공/실패 판단                                                 │
│  │  - 녹화로 생성 가능                                                     │
│  │  - 모든 상위 레벨의 기반                                                 │
│  └──────────────────────────────────────────────────────────────────────    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 12.3 왜 Bottom-up인가?

```
❌ Top-down 접근의 문제:
   "집행등록" 이라는 큰 플레이북을 한번에 만들면
   → 중간에 실패 시 전체 재작성 필요
   → 재사용 불가 (로그인 부분만 다른 곳에서 쓸 수 없음)
   → LLM이 부분 실행 불가

✅ Bottom-up 접근의 장점:
   최하위 원자적 액션부터 검증하며 쌓아올리면
   → 실패 지점 명확히 특정 가능
   → 조합으로 새로운 시나리오 쉽게 생성
   → LLM이 상황에 맞게 체인 구성 가능
```

### 12.4 플레이북 참조 구조

```yaml
# Level 1: 원자적 액션 (예: atomic/click-login-button.yaml)
id: "atomic-click-login-button"
level: 1
steps:
  - action: "click"
    selector: '[role="button"][aria-label="로그인"]'
    wait_for: "navigation"

---
# Level 2: 기능 단위 (예: functions/login.yaml)
id: "func-login"
level: 2
includes:                          # Level 1 참조
  - "atomic-type-userid"
  - "atomic-type-password"
  - "atomic-click-login-button"

---
# Level 3: 업무 시나리오 (예: scenarios/tax-invoice-register.yaml)
id: "scenario-tax-invoice-register"
level: 3
includes:                          # Level 2 참조
  - "func-login"
  - "func-navigate-execution"
  - "func-search-tax-invoice"
  - "func-register-execution"
  - "func-save-and-request"

aliases:                           # Level 4: 자연어 매핑
  - "세금계산서 처리"
  - "전자세금계산서 집행"
  - "세금계산서 등록"
  - "집행등록 해줘"
```

### 12.5 데이터베이스 스키마 확장

```sql
-- 플레이북 레벨 추가
ALTER TABLE playbooks ADD COLUMN level INT DEFAULT 2;
-- 1: atomic, 2: function, 3: scenario

-- 플레이북 참조 관계
CREATE TABLE playbook_references (
  id UUID PRIMARY KEY,
  parent_playbook_id TEXT NOT NULL,   -- 상위 플레이북
  child_playbook_id TEXT NOT NULL,    -- 하위 플레이북
  execution_order INT NOT NULL,        -- 실행 순서

  FOREIGN KEY (parent_playbook_id) REFERENCES playbooks(playbook_id),
  FOREIGN KEY (child_playbook_id) REFERENCES playbooks(playbook_id)
);

-- 자연어 별칭 테이블
CREATE TABLE playbook_aliases (
  id UUID PRIMARY KEY,
  playbook_id TEXT NOT NULL,
  alias TEXT NOT NULL,                 -- "세금계산서 처리해줘"
  language TEXT DEFAULT 'ko',

  FOREIGN KEY (playbook_id) REFERENCES playbooks(playbook_id)
);

-- 인덱스 (LLM 검색용)
CREATE INDEX idx_playbook_aliases_alias ON playbook_aliases USING gin(alias gin_trgm_ops);
```

### 12.6 LLM 실행 흐름

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     LLM 자연어 → 플레이북 실행 흐름                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  사용자: "이번 달 세금계산서 좀 정리해줘"                                     │
│                                                                             │
│  [1] 자연어 파싱 (LLM)                                                       │
│       │                                                                     │
│       ├─ 의도: 집행등록                                                     │
│       ├─ 대상: 전자세금계산서                                               │
│       └─ 범위: 이번 달                                                      │
│             │                                                               │
│             ▼                                                               │
│  [2] 플레이북 검색                                                          │
│       │                                                                     │
│       ├─ playbook_aliases에서 "세금계산서", "집행", "정리" 검색              │
│       ├─ 매칭: scenario-tax-invoice-register                                │
│       └─ 신뢰도: 0.92                                                       │
│             │                                                               │
│             ▼                                                               │
│  [3] 플레이북 체인 구성                                                      │
│       │                                                                     │
│       ├─ scenario-tax-invoice-register 로드                                 │
│       ├─ includes 해석:                                                     │
│       │   [func-login]                                                      │
│       │      ├─ atomic-type-userid                                         │
│       │      ├─ atomic-type-password                                       │
│       │      └─ atomic-click-login-button                                  │
│       │   [func-navigate-execution]                                        │
│       │      ├─ atomic-click-menu-execution                                │
│       │      └─ atomic-click-submenu-register                              │
│       │   [func-search-tax-invoice]                                        │
│       │      ├─ atomic-select-year                                         │
│       │      ├─ atomic-select-month (이번 달로 설정)                        │
│       │      └─ atomic-click-search                                        │
│       │   ...                                                               │
│       │                                                                     │
│       └─ 실행 순서 확정: 12개 atomic 액션                                    │
│             │                                                               │
│             ▼                                                               │
│  [4] 순차 실행 & 검증                                                        │
│       │                                                                     │
│       └─ 각 atomic 액션별 실행 → 검증 → 다음                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 12.7 구현 우선순위

```
Phase 1: Level 1 원자적 액션 라이브러리 구축
─────────────────────────────────────────
□ 녹화 도구로 보탬e의 모든 버튼/입력/선택 액션 수집
□ 셀렉터 정규화 (동적 UUID 대응)
□ 각 액션별 검증 조건 정의
□ 예상: 100~200개 원자적 액션

Phase 2: Level 2 기능 단위 조합
─────────────────────────────────────────
□ 자주 사용되는 기능 패턴 분석
□ 원자적 액션 조합으로 기능 플레이북 생성
□ 재사용성 검증
□ 예상: 30~50개 기능 플레이북

Phase 3: Level 3 업무 시나리오 구성
─────────────────────────────────────────
□ 분석된 업무 흐름 기반 시나리오 작성
□ 기능 플레이북 체인으로 구성
□ 예상: 20~30개 시나리오

Phase 4: Level 4 자연어 매핑
─────────────────────────────────────────
□ 각 시나리오에 자연어 별칭 추가
□ 유사어/동의어 확장
□ LLM 프롬프트 최적화
□ 예상: 시나리오당 5~10개 별칭
```

### 12.8 플레이북 시작 페이지 (Start URL)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     플레이북 시작 페이지 원칙                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ★★★ 핵심 원칙 ★★★                                                        │
│  ─────────────────                                                          │
│  플레이북은 항상 특정 페이지에서 시작해야 한다.                                │
│  어떤 페이지에서 시작하느냐에 따라 실행 결과가 달라질 수 있기 때문.            │
│                                                                             │
│  [시작 URL 결정 우선순위]                                                    │
│  1. 플레이북에 명시된 start_url 필드 값                                      │
│  2. 첫 번째 navigate 스텝의 URL                                             │
│  3. 기본값: 홈페이지 (https://www.losims.go.kr/lss.do)                      │
│                                                                             │
│  [수동 실행 시]                                                              │
│  사용자가 이미 특정 페이지에 있는 상태에서 플레이북을 실행하면                 │
│  → 현재 페이지를 시작 페이지로 인식                                          │
│  → 이 경우 플레이북의 start_url보다 사용자 지정 URL 우선                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

```sql
-- 시작 URL 컬럼 추가
ALTER TABLE playbooks ADD COLUMN start_url TEXT;
-- 플레이북은 항상 특정 페이지에서 시작해야 함
-- 값이 없으면 홈페이지 URL 사용
```

```yaml
# 플레이북 예시 (Level 3 시나리오)
id: "scenario-tax-invoice-register"
level: 3
start_url: "https://www.losims.go.kr/lss.do"  # 시작 페이지 명시

steps:
  - action: "navigate"
    value: "{{start_url}}"   # 또는 변수로 처리
    message: "보탬e 업무시스템 접속"
  - action: "click"
    selector: "text=집행관리"
    ...
```

---

## 13. 구현 현황 (2025-12-06 기준)

### 13.1 완료된 구현

```
[✓] 플레이북 스키마 확장
    - level 컬럼 추가 (1=atomic, 2=function, 3=scenario)
    - start_url 컬럼 추가 (시작 페이지)
    - playbook_references 테이블 (상위-하위 관계)
    - playbook_aliases 테이블 (자연어 별칭)

[✓] 플레이북 생성 스크립트 (generate-playbooks.js)
    - 45개 Level 1 원자적 액션 생성
    - 12개 Level 2 기능 단위 생성
    - 4개 Level 3 시나리오 생성
    - 24개 자연어 별칭 등록
    - 47개 플레이북 참조 관계 등록

[✓] Admin UI 카탈로그 뷰
    - 레벨별/카테고리별 뷰 모드 전환
    - 플레이북 검색 기능
    - 실행 버튼 추가 (카탈로그에서 직접 실행)

[✓] 플레이북 실행 기능
    - runner:runFromCatalog IPC 핸들러
    - DB에서 플레이북 조회 → 즉시 실행
    - start_url 기반 시작 페이지 자동 이동
```

### 13.2 Supabase 연결 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Main ↔ Renderer 동기화 흐름                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Main Process]                     [Renderer Process]                      │
│  ──────────────                     ───────────────────                     │
│  1. App 시작                                                                │
│  2. Supabase 자동 연결 (.env)       3. 500ms 후 상태 체크                   │
│     ↓                                  ↓                                    │
│  4. supabase:connected 이벤트  ───▶ 5. 상태 업데이트                        │
│     전송                               connected = true                     │
│                                        ↓                                    │
│                                     6. 카탈로그 자동 로드                   │
│                                                                             │
│  [IPC 채널]                                                                 │
│  - supabase:configure     : 수동 연결 설정                                  │
│  - supabase:getStatus     : 연결 상태 조회                                  │
│  - supabase:getCatalog    : 플레이북 카탈로그 조회                          │
│  - supabase:getPlaybook   : 플레이북 상세 조회                              │
│  - runner:runFromCatalog  : 카탈로그에서 직접 실행                          │
│  - supabase:connected     : 연결 완료 알림 (Main → Renderer)               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 13.3 다음 단계

```
[ ] 원자적 플레이북 녹화 기능 개선
    - 녹화 시 자동으로 Level 1 플레이북 생성
    - 셀렉터 정규화 자동화

[ ] Level 2/3 플레이북 조합 UI
    - 드래그 앤 드롭으로 하위 플레이북 조합
    - 실행 순서 편집

[ ] 자연어 별칭 관리 UI
    - 별칭 추가/삭제/수정
    - LLM 검색 테스트

[ ] DB Single Source of Truth 전환
    - 로컬 파일 저장소 제거
    - 모든 CRUD를 DB에서 처리
```
