# Site Graph DB 아키텍처

## 개요

보탬e 가이드 앱의 데이터 구조로, 플레이북 실행에 필요한 최소한의 웹사이트 구조만 저장합니다.

## 핵심 설계 원칙

### 원칙 1: 페이지 전이가 핵심
- 한 페이지에서 다음 페이지로 이동하는 경로가 플레이북 시나리오의 본질
- 버튼/탭 클릭으로 페이지가 이동하면 반드시 추적

### 원칙 2: 시나리오 필수 요소만
- 플레이북 실행에 필요한 DOM 요소만 저장
- 페이지의 모든 요소를 저장하지 않음

### 원칙 3: 불필요한 관계 제외
- Element 간 상호 연결 저장하지 않음
- 외부 링크, 장식용 요소 저장하지 않음

## 데이터 모델

```
┌─────────────────────────────────────────────────────────────────┐
│                         Playbook                                │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ playbook_id: "auto-login"                                 │  │
│  │ name: "자동 로그인"                                        │  │
│  │ steps: [                                                  │  │
│  │   ┌─────────────────────────────────────────────────────┐ │  │
│  │   │ Step 1: navigate → Page(로그인)                     │ │  │
│  │   │ Step 2: click → Element(아이디 로그인 탭)           │ │  │
│  │   │ Step 3: type → Element(아이디 입력)                 │ │  │
│  │   │ Step 4: type → Element(비밀번호 입력)               │ │  │
│  │   │ Step 5: click → Element(로그인 버튼) → Page(대시보드)│ │  │
│  │   └─────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
│                          │                                      │
│            ┌─────────────┴─────────────┐                       │
│            ▼                           ▼                       │
│     ┌─────────────┐             ┌─────────────┐                │
│     │    Page     │             │   Element   │                │
│     │ (시나리오에 │             │ (시나리오에 │                │
│     │  등장하는   │◄────────────│  필요한 것) │                │
│     │  페이지만)  │   page_id   │             │                │
│     └─────────────┘             └─────────────┘                │
└─────────────────────────────────────────────────────────────────┘

※ Element 간 관계 없음
※ 외부 링크 저장 안함
```

## 테이블 구조

### 1. Pages - 시나리오에 등장하는 페이지

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| url | TEXT | 페이지 URL (고유) |
| title | TEXT | 페이지 제목 |
| page_type | TEXT | LOGIN, DASHBOARD, FORM, LIST, DETAIL |
| screenshot_path | TEXT | 스크린샷 경로 (선택) |
| verified | BOOLEAN | 검증 여부 |

### 2. Elements - 시나리오 필수 요소

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| page_id | UUID | FK → pages |
| name | TEXT | 사람이 읽기 쉬운 이름 ("로그인 버튼") |
| element_type | TEXT | BUTTON, INPUT_TEXT, INPUT_PASSWORD, LINK |
| selectors | JSONB | 다중 셀렉터 {primary, fallbacks[]} |
| role | TEXT | LOGIN_BUTTON, USERNAME_INPUT 등 |
| verified | BOOLEAN | 검증 여부 |

### 3. Playbooks - 시나리오 정의 (핵심)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| playbook_id | TEXT | 고유 ID (auto-login) |
| name | TEXT | 표시 이름 |
| steps | JSONB | 시나리오 단계 배열 |
| variables | JSONB | 필요한 변수 정의 |
| start_page_id | UUID | 시작 페이지 |
| end_page_id | UUID | 종료 페이지 |

### 4. Credentials - 암호화된 인증 정보

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| user_id | UUID | 소유자 |
| domain | TEXT | 대상 도메인 |
| encrypted_data | TEXT | 암호화된 로그인 정보 |
| is_default | BOOLEAN | 기본 사용 여부 |

### 5. Execution_logs - 실행 로그

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| playbook_id | UUID | 실행한 플레이북 |
| status | TEXT | started, completed, failed |
| failed_step_id | TEXT | 실패한 단계 |
| error_message | TEXT | 에러 메시지 |

## Steps 구조 (Playbook의 핵심)

```json
{
  "steps": [
    {
      "id": "step1",
      "action": "navigate",
      "value": "https://www.losims.go.kr/lss.do",
      "message": "보탬e 페이지로 이동합니다",
      "next_page_id": "uuid-of-login-page"
    },
    {
      "id": "step2",
      "action": "click",
      "page_id": "uuid-of-login-page",
      "element_id": "uuid-of-tab",
      "selector": "text=아이디 로그인",
      "message": "아이디 로그인 탭을 클릭합니다"
    },
    {
      "id": "step3",
      "action": "type",
      "page_id": "uuid-of-login-page",
      "element_id": "uuid-of-input",
      "selector": "input[type='text']",
      "value": "${username}",
      "message": "아이디를 입력합니다"
    },
    {
      "id": "step4",
      "action": "click",
      "page_id": "uuid-of-login-page",
      "element_id": "uuid-of-button",
      "selector": "role=button[name='로그인 버튼']",
      "message": "로그인 버튼을 클릭합니다",
      "next_page_id": "uuid-of-dashboard"
    }
  ]
}
```

### Step Action 타입

| Action | 설명 | 필수 필드 |
|--------|------|-----------|
| navigate | URL 이동 | value (URL), next_page_id |
| click | 요소 클릭 | element_id 또는 selector |
| type | 텍스트 입력 | element_id 또는 selector, value |
| wait | 대기 | timeout (ms) |
| guide | 안내 메시지 | message |

## 셀렉터 안정성 전략

```json
{
  "selectors": {
    "primary": "role=button[name='로그인 버튼']",
    "fallbacks": [
      "text=로그인",
      "#login-btn",
      "button[type='submit']"
    ]
  }
}
```

### 우선순위 (안정성 높음 → 낮음)
1. Role 기반: `role=button[name='...']`
2. Data 속성: `[data-testid='...']`
3. 텍스트 기반: `text=...`
4. ID: `#id`
5. CSS 조합: `form button[type='submit']`

### 실행 로직
```typescript
async function findElement(selectors: Selectors) {
  // 1. Primary 시도
  let el = await page.locator(selectors.primary);
  if (await el.isVisible()) return el;

  // 2. Fallbacks 순차 시도
  for (const fallback of selectors.fallbacks) {
    el = await page.locator(fallback);
    if (await el.isVisible()) return el;
  }

  throw new Error('Element not found');
}
```

## 페이지 전이 추적

페이지 전이는 `links` 테이블 없이 **Playbook steps**에서 관리:

```
Step with action=click + next_page_id
      │
      ▼
┌──────────────────────────────────────────┐
│  현재 요소 클릭 → 다음 페이지로 이동      │
│                                          │
│  page_id: "로그인 페이지"                 │
│  element_id: "로그인 버튼"                │
│  next_page_id: "대시보드 페이지"          │
└──────────────────────────────────────────┘
```

이렇게 하면:
- 별도 `links` 테이블 불필요
- 플레이북 시나리오 내에서만 페이지 전이 추적
- 불필요한 링크 수집 방지

## 저장하지 않는 것

| 항목 | 이유 |
|------|------|
| 모든 DOM 요소 | 시나리오에 불필요 |
| Element 간 관계 | 복잡성만 증가 |
| 외부 링크 | 시나리오 범위 외 |
| 전체 DOM 스냅샷 | 용량, 유지보수 부담 |
| 크롤링 큐 | 필요시 별도 관리 |

## YAML ↔ DB 동기화

### 현재 (YAML 기반)
```yaml
# ~/.config/botame-guide-app/playbooks/auto-login.yaml
metadata:
  id: auto-login
  name: 자동 로그인
steps:
  - action: navigate
    value: "https://www.losims.go.kr/lss.do"
  - action: click
    selector: "text=아이디 로그인"
```

### 목표 (DB 기반 + YAML 호환)
```
┌─────────────┐      동기화      ┌─────────────┐
│  Supabase   │ ◄──────────────► │  Local YAML │
│  (원본)     │                  │  (캐시)     │
└─────────────┘                  └─────────────┘
       │
       │ 오프라인 시
       ▼
┌─────────────┐
│  Local YAML │
│  에서 실행   │
└─────────────┘
```

## 다음 단계

1. **Supabase 프로젝트 생성**
2. **마이그레이션 적용** (`001_site_graph_schema.sql`)
3. **앱에 Supabase 클라이언트 연동**
4. **YAML ↔ DB 동기화 구현**
5. **Recording Mode UI 구현**
