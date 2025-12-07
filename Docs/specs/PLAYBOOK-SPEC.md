# 플레이북 스펙 정의

> 버전: 1.0
> 작성일: 2025-01-30
> 상태: Draft

---

## 1. 개요

### 1.1 플레이북이란?

플레이북은 보탬e 시스템에서 특정 업무를 수행하기 위한 **사전 정의된 작업 지시서**입니다.
YAML 형식으로 작성되며, 단계별 가이드와 브라우저 자동화 명령을 포함합니다.

```
플레이북 = 업무 흐름 + UI 셀렉터 + 안내 메시지
```

### 1.2 설계 원칙

1. **선언적**: "무엇을" 하는지 명시 (어떻게는 엔진이 처리)
2. **재사용 가능**: 공통 패턴은 템플릿으로 분리
3. **유지보수 용이**: UI 변경 시 셀렉터만 수정
4. **사람이 읽기 쉽게**: 주석과 설명 포함

---

## 2. 스키마 정의

### 2.1 전체 구조

```yaml
# playbook.schema.yaml

type: object
required:
  - id
  - version
  - metadata
  - steps

properties:
  id:
    type: string
    pattern: "^[a-z0-9-]+$"
    description: 고유 식별자 (slug)

  version:
    type: string
    pattern: "^\\d+\\.\\d+\\.\\d+$"
    description: 시맨틱 버전

  metadata:
    type: object
    required:
      - title
      - category
    properties:
      title:
        type: string
        description: 표시 제목
      description:
        type: string
        description: 상세 설명
      category:
        type: string
        enum: [회원관리, 사업선정, 교부관리, 집행관리, 정산관리, 사후관리, 기타]
      tags:
        type: array
        items:
          type: string
      difficulty:
        type: string
        enum: [쉬움, 보통, 어려움]
      estimated_time:
        type: string
        description: 예상 소요 시간

  variables:
    type: object
    description: 사용자 입력 또는 동적 값
    additionalProperties:
      type: object
      properties:
        type:
          type: string
          enum: [string, number, date, select]
        label:
          type: string
        required:
          type: boolean
        default:
          type: string
        options:
          type: array
          items:
            type: string

  preconditions:
    type: array
    description: 실행 전 확인 사항
    items:
      type: object
      properties:
        check:
          type: string
        message:
          type: string
        action:
          type: string
          enum: [warn, block]

  steps:
    type: array
    minItems: 1
    items:
      $ref: "#/definitions/Step"

  error_handlers:
    type: array
    description: 에러 발생 시 처리
    items:
      type: object
      properties:
        match:
          type: string
          description: 에러 텍스트 패턴
        action:
          type: string
          enum: [retry, skip, abort, guide]
        message:
          type: string

definitions:
  Step:
    type: object
    required:
      - id
      - action
    properties:
      id:
        type: string
      action:
        type: string
        enum: [navigate, click, type, select, wait, assert, highlight, guide, condition, loop]
      selector:
        type: string
        description: CSS 또는 XPath 셀렉터
      value:
        type: string
        description: 입력값 (변수 참조 가능)
      message:
        type: string
        description: 사용자에게 표시할 메시지
      wait_for:
        type: string
        enum: [element, navigation, network, user]
      timeout:
        type: number
        default: 30000
      optional:
        type: boolean
        default: false
      condition:
        type: string
        description: 조건식 (실행 여부 결정)
      on_error:
        type: string
        enum: [retry, skip, abort]
        default: abort
```

### 2.2 Step 액션 타입

#### 2.2.1 navigate (페이지 이동)

```yaml
- id: go-to-budget
  action: navigate
  value: "https://botame.mohw.go.kr/budget/register"
  wait_for: navigation
  message: "예산 등록 페이지로 이동합니다."
```

#### 2.2.2 click (클릭)

```yaml
- id: click-new-button
  action: click
  selector: "button.btn-new"
  wait_for: element
  message: "[신규] 버튼을 클릭하세요."
```

#### 2.2.3 type (텍스트 입력)

```yaml
- id: enter-amount
  action: type
  selector: "#budget-amount"
  value: "${amount}"           # 변수 참조
  message: "예산 금액을 입력하세요."
```

#### 2.2.4 select (드롭다운 선택)

```yaml
- id: select-category
  action: select
  selector: "#budget-category"
  value: "인건비"
  message: "예산 과목을 선택하세요."
```

#### 2.2.5 wait (대기)

```yaml
- id: wait-for-save
  action: wait
  wait_for: network
  timeout: 10000
  message: "저장 중입니다..."
```

#### 2.2.6 assert (검증)

```yaml
- id: verify-saved
  action: assert
  selector: ".success-message"
  value: "저장되었습니다"
  on_error: retry
  message: "저장이 완료되었는지 확인합니다."
```

#### 2.2.7 highlight (하이라이트)

```yaml
- id: show-target
  action: highlight
  selector: "#target-element"
  message: "여기를 클릭하세요!"
  wait_for: user            # 사용자가 클릭할 때까지 대기
```

#### 2.2.8 guide (가이드 메시지)

```yaml
- id: explain-step
  action: guide
  message: |
    예산 금액을 입력할 때는 천원 단위로 입력합니다.
    예: 1,000,000원 → 1000
  wait_for: user
```

#### 2.2.9 condition (조건 분기)

```yaml
- id: check-premium
  action: condition
  condition: "${user.plan} == 'premium'"
  then:
    - id: premium-feature
      action: click
      selector: "#premium-btn"
  else:
    - id: show-upgrade
      action: guide
      message: "이 기능은 프리미엄 플랜에서 사용 가능합니다."
```

#### 2.2.10 loop (반복)

```yaml
- id: process-items
  action: loop
  selector: ".item-row"
  variable: item
  steps:
    - id: click-item
      action: click
      selector: "${item} .edit-btn"
    - id: update-item
      action: type
      selector: "#amount"
      value: "${item.amount}"
```

---

## 3. 예제 플레이북

### 3.1 예산 등록 (기본)

```yaml
id: budget-register-basic
version: "1.0.0"

metadata:
  title: 예산 등록
  description: 보탬e 시스템에서 새 예산을 등록하는 방법을 안내합니다.
  category: 교부관리
  tags:
    - 예산
    - 등록
    - 기초
  difficulty: 쉬움
  estimated_time: "5분"

variables:
  budget_year:
    type: select
    label: 회계연도
    required: true
    options:
      - "2024"
      - "2025"
  budget_amount:
    type: number
    label: 예산금액 (천원)
    required: true
  budget_category:
    type: select
    label: 예산과목
    required: true
    options:
      - 인건비
      - 사업비
      - 운영비

preconditions:
  - check: "url.includes('botame.mohw.go.kr')"
    message: "보탬e 시스템에 먼저 로그인해주세요."
    action: block
  - check: "exists('#user-info')"
    message: "로그인 상태를 확인합니다."
    action: warn

steps:
  # 1. 메뉴 이동
  - id: step-1
    action: guide
    message: |
      예산 등록을 시작합니다.
      먼저 교부관리 메뉴로 이동합니다.

  - id: step-2
    action: highlight
    selector: "#menu-grant"
    message: "[교부관리] 메뉴를 클릭하세요."
    wait_for: user

  - id: step-3
    action: click
    selector: "#menu-grant"
    wait_for: navigation

  - id: step-4
    action: highlight
    selector: "#submenu-budget"
    message: "[예산등록] 메뉴를 클릭하세요."
    wait_for: user

  - id: step-5
    action: click
    selector: "#submenu-budget"
    wait_for: navigation

  # 2. 신규 등록
  - id: step-6
    action: guide
    message: |
      예산 등록 화면입니다.
      새 예산을 등록하려면 [신규] 버튼을 클릭합니다.

  - id: step-7
    action: highlight
    selector: "button.btn-new"
    message: "[신규] 버튼을 클릭하세요."
    wait_for: user

  - id: step-8
    action: click
    selector: "button.btn-new"
    wait_for: element
    timeout: 5000

  # 3. 정보 입력
  - id: step-9
    action: guide
    message: |
      예산 정보를 입력합니다.
      회계연도: ${budget_year}
      예산과목: ${budget_category}
      금액: ${budget_amount}천원

  - id: step-10
    action: highlight
    selector: "#select-year"
    message: "회계연도를 선택하세요."
    wait_for: user

  - id: step-11
    action: select
    selector: "#select-year"
    value: "${budget_year}"

  - id: step-12
    action: highlight
    selector: "#select-category"
    message: "예산과목을 선택하세요."
    wait_for: user

  - id: step-13
    action: select
    selector: "#select-category"
    value: "${budget_category}"

  - id: step-14
    action: highlight
    selector: "#input-amount"
    message: "예산금액을 입력하세요."
    wait_for: user

  - id: step-15
    action: type
    selector: "#input-amount"
    value: "${budget_amount}"

  # 4. 저장
  - id: step-16
    action: guide
    message: |
      입력한 내용을 확인한 후 [저장] 버튼을 클릭합니다.

  - id: step-17
    action: highlight
    selector: "button.btn-save"
    message: "[저장] 버튼을 클릭하세요."
    wait_for: user

  - id: step-18
    action: click
    selector: "button.btn-save"
    wait_for: network

  - id: step-19
    action: assert
    selector: ".alert-success"
    value: "저장"
    message: "저장이 완료되었습니다!"
    on_error: retry

  - id: step-20
    action: guide
    message: |
      예산 등록이 완료되었습니다!

      다음 단계:
      - 예산 배정을 진행하려면 [예산배정] 플레이북을 실행하세요.
      - 등록된 예산을 확인하려면 [예산조회] 플레이북을 실행하세요.

error_handlers:
  - match: "중복된 예산"
    action: guide
    message: |
      이미 동일한 조건의 예산이 등록되어 있습니다.
      기존 예산을 수정하시겠습니까?
  - match: "필수 항목"
    action: retry
    message: "입력하지 않은 필수 항목이 있습니다. 다시 확인해주세요."
  - match: "세션 만료"
    action: abort
    message: "로그인 세션이 만료되었습니다. 다시 로그인해주세요."
```

### 3.2 지출결의 등록 (중급)

```yaml
id: expense-approval
version: "1.0.0"

metadata:
  title: 지출결의서 작성
  description: 보탬e 시스템에서 지출결의서를 작성합니다.
  category: 집행관리
  tags:
    - 지출
    - 결의
    - 집행
  difficulty: 보통
  estimated_time: "10분"

variables:
  expense_date:
    type: date
    label: 지출일자
    required: true
    default: "${today}"
  expense_type:
    type: select
    label: 지출구분
    required: true
    options:
      - 인건비
      - 사업비
      - 운영비
      - 기타
  expense_amount:
    type: number
    label: 지출금액 (원)
    required: true
  expense_description:
    type: string
    label: 적요
    required: true
  receipt_attached:
    type: select
    label: 증빙서류 첨부
    options:
      - 있음
      - 없음

preconditions:
  - check: "exists('.user-role-manager')"
    message: "지출결의는 담당자 이상 권한이 필요합니다."
    action: block

steps:
  - id: intro
    action: guide
    message: |
      지출결의서 작성을 시작합니다.

      필요한 정보:
      - 지출일자: ${expense_date}
      - 지출구분: ${expense_type}
      - 금액: ${expense_amount}원
      - 적요: ${expense_description}

  # 메뉴 이동
  - id: nav-menu
    action: navigate
    value: "/execution/expense"
    wait_for: navigation

  - id: click-new
    action: click
    selector: "#btn-new-expense"
    wait_for: element

  # 기본 정보 입력
  - id: input-date
    action: type
    selector: "#expense-date"
    value: "${expense_date}"

  - id: select-type
    action: select
    selector: "#expense-type"
    value: "${expense_type}"

  - id: input-amount
    action: type
    selector: "#expense-amount"
    value: "${expense_amount}"

  - id: input-desc
    action: type
    selector: "#expense-description"
    value: "${expense_description}"

  # 증빙 첨부 (조건부)
  - id: check-receipt
    action: condition
    condition: "${receipt_attached} == '있음'"
    then:
      - id: click-attach
        action: highlight
        selector: "#btn-attach-file"
        message: "[파일첨부] 버튼을 클릭하여 증빙서류를 첨부하세요."
        wait_for: user
      - id: wait-upload
        action: wait
        wait_for: network
        timeout: 30000
        message: "파일 업로드 중..."

  # 결재선 지정
  - id: guide-approval
    action: guide
    message: |
      결재선을 지정합니다.
      기본 결재선: 담당자 → 팀장 → 센터장

  - id: click-approval-line
    action: click
    selector: "#btn-approval-line"
    wait_for: element

  - id: select-default-line
    action: click
    selector: "#default-approval-line"

  - id: confirm-line
    action: click
    selector: "#btn-confirm-line"
    wait_for: element

  # 저장 및 상신
  - id: save-draft
    action: click
    selector: "#btn-save-draft"
    wait_for: network
    message: "임시저장 중..."

  - id: verify-save
    action: assert
    selector: ".toast-success"
    value: "저장"

  - id: guide-submit
    action: guide
    message: |
      임시저장이 완료되었습니다.

      결재를 상신하시겠습니까?
      [상신] 버튼을 클릭하면 결재가 시작됩니다.

  - id: highlight-submit
    action: highlight
    selector: "#btn-submit"
    message: "[상신] 버튼을 클릭하세요."
    wait_for: user

  - id: click-submit
    action: click
    selector: "#btn-submit"
    wait_for: network

  - id: confirm-submit
    action: click
    selector: "#modal-confirm-yes"
    wait_for: network

  - id: complete
    action: guide
    message: |
      지출결의서 상신이 완료되었습니다!

      결재 현황은 [결재현황] 메뉴에서 확인할 수 있습니다.

error_handlers:
  - match: "예산 초과"
    action: guide
    message: |
      예산을 초과하는 지출입니다.
      예산 현황을 확인하고 금액을 조정하거나,
      추가경정예산을 신청하세요.
  - match: "결재선 미지정"
    action: retry
    message: "결재선이 지정되지 않았습니다."
```

---

## 4. 셀렉터 가이드

### 4.1 셀렉터 우선순위

```
1. id 속성 (가장 안정적)
   #budget-amount

2. data-* 속성 (의미적)
   [data-testid="save-button"]

3. 고유 클래스 조합
   .budget-form .btn-primary

4. 텍스트 기반 (변경 가능성 높음)
   button:has-text("저장")

5. XPath (최후 수단)
   //div[@class='container']//button[1]
```

### 4.2 셀렉터 예시

```yaml
selectors:
  # ID 기반 (권장)
  good:
    - "#btn-save"
    - "#input-amount"
    - "#select-category"

  # Data 속성 기반 (권장)
  better:
    - "[data-action='save']"
    - "[data-field='amount']"

  # 클래스 조합 (보통)
  acceptable:
    - ".form-budget .btn-primary"
    - ".modal-content .close-btn"

  # 텍스트 기반 (피하기)
  avoid:
    - "button:has-text('저장')"  # 텍스트 변경 시 깨짐

  # XPath (최후 수단)
  lastResort:
    - "//table[@id='data-grid']//tr[2]//td[3]//button"
```

### 4.3 보탬e 공통 셀렉터

```yaml
# common-selectors.yaml
common:
  # 메뉴
  menu:
    member: "#menu-member"
    project: "#menu-project"
    grant: "#menu-grant"
    execution: "#menu-execution"
    settlement: "#menu-settlement"
    followup: "#menu-followup"

  # 버튼
  buttons:
    new: "button.btn-new, #btn-new"
    save: "button.btn-save, #btn-save"
    delete: "button.btn-delete, #btn-delete"
    search: "button.btn-search, #btn-search"
    print: "button.btn-print, #btn-print"
    excel: "button.btn-excel, #btn-excel"

  # 모달
  modal:
    confirm: "#modal-confirm"
    confirmYes: "#modal-confirm-yes"
    confirmNo: "#modal-confirm-no"
    close: ".modal .btn-close"

  # 알림
  alerts:
    success: ".alert-success, .toast-success"
    error: ".alert-danger, .toast-error"
    warning: ".alert-warning, .toast-warning"

  # 폼
  form:
    year: "#select-year"
    month: "#select-month"
    startDate: "#input-start-date"
    endDate: "#input-end-date"
```

---

## 5. 변수 시스템

### 5.1 변수 타입

```yaml
variables:
  # 문자열
  project_name:
    type: string
    label: 사업명
    required: true
    validation:
      minLength: 2
      maxLength: 100

  # 숫자
  amount:
    type: number
    label: 금액
    required: true
    validation:
      min: 0
      max: 999999999

  # 날짜
  start_date:
    type: date
    label: 시작일
    required: true
    default: "${today}"

  # 선택
  category:
    type: select
    label: 분류
    required: true
    options:
      - value: "A"
        label: "A유형"
      - value: "B"
        label: "B유형"

  # 체크박스
  agree_terms:
    type: boolean
    label: 약관 동의
    required: true
```

### 5.2 변수 참조

```yaml
# 직접 참조
value: "${amount}"

# 중첩 참조
value: "${user.name}"

# 표현식
value: "${amount * 1000}"

# 조건
condition: "${amount} > 1000000"

# 시스템 변수
value: "${today}"        # 오늘 날짜
value: "${now}"          # 현재 시간
value: "${user.id}"      # 현재 사용자 ID
value: "${user.name}"    # 현재 사용자 이름
value: "${user.org}"     # 현재 조직
```

---

## 6. 검증 규칙

### 6.1 스키마 검증

```typescript
// playbook/validator.ts
import Ajv from 'ajv';
import { playbookSchema } from './schema';

export class PlaybookValidator {
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({ allErrors: true });
  }

  validate(playbook: unknown): ValidationResult {
    const valid = this.ajv.validate(playbookSchema, playbook);

    if (!valid) {
      return {
        valid: false,
        errors: this.ajv.errors?.map(e => ({
          path: e.instancePath,
          message: e.message,
        })),
      };
    }

    return { valid: true };
  }
}
```

### 6.2 셀렉터 검증

```typescript
// playbook/selector-validator.ts
export class SelectorValidator {
  async validate(playbook: Playbook, page: Page): Promise<SelectorResult[]> {
    const results: SelectorResult[] = [];

    for (const step of playbook.steps) {
      if (step.selector) {
        try {
          const element = await page.locator(step.selector).first();
          const exists = await element.count() > 0;

          results.push({
            stepId: step.id,
            selector: step.selector,
            exists,
            warning: !exists ? `Selector not found: ${step.selector}` : undefined,
          });
        } catch (error) {
          results.push({
            stepId: step.id,
            selector: step.selector,
            exists: false,
            error: error.message,
          });
        }
      }
    }

    return results;
  }
}
```

### 6.3 변수 검증

```typescript
// playbook/variable-validator.ts
export class VariableValidator {
  validate(playbook: Playbook, inputs: Record<string, unknown>): ValidationResult {
    const errors: ValidationError[] = [];

    for (const [name, spec] of Object.entries(playbook.variables || {})) {
      const value = inputs[name];

      // 필수 검사
      if (spec.required && (value === undefined || value === '')) {
        errors.push({
          field: name,
          message: `${spec.label}은(는) 필수입니다.`,
        });
        continue;
      }

      // 타입 검사
      if (value !== undefined) {
        if (spec.type === 'number' && typeof value !== 'number') {
          errors.push({
            field: name,
            message: `${spec.label}은(는) 숫자여야 합니다.`,
          });
        }
        // ... 기타 타입 검사
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
```

---

## 7. 워크플로우 연결

### 7.1 워크플로우 정의

```yaml
# workflows/budget-workflow.yaml
id: budget-complete-workflow
version: "1.0.0"

metadata:
  title: 예산 관리 전체 흐름
  description: 예산 등록부터 정산까지 전체 과정

nodes:
  - id: start
    type: start
    next: budget-register

  - id: budget-register
    type: playbook
    playbook_id: budget-register-basic
    next: budget-approval

  - id: budget-approval
    type: playbook
    playbook_id: budget-approval
    next: decision-approved

  - id: decision-approved
    type: decision
    condition: "${approval_status} == 'approved'"
    yes: budget-execution
    no: budget-register  # 반려 시 재등록

  - id: budget-execution
    type: playbook
    playbook_id: expense-approval
    next: settlement

  - id: settlement
    type: playbook
    playbook_id: settlement-report
    next: end

  - id: end
    type: end
```

### 7.2 워크플로우 시각화

```
┌─────────┐    ┌──────────────┐    ┌──────────────┐
│  시작   │───▶│  예산 등록   │───▶│  예산 승인   │
└─────────┘    └──────────────┘    └──────┬───────┘
                      ▲                    │
                      │                    ▼
                      │            ┌───────────────┐
                      │ 반려       │   승인 여부    │
                      └────────────┤               │
                                   └───────┬───────┘
                                           │ 승인
                                           ▼
               ┌─────────┐    ┌──────────────┐
               │   종료   │◀───│  지출 결의   │
               └─────────┘    └──────────────┘
```

---

## 8. 버전 관리

### 8.1 버전 규칙

```
MAJOR.MINOR.PATCH

MAJOR: 호환성 깨지는 변경 (step 구조 변경 등)
MINOR: 새 기능 추가 (step 추가, 새 변수 등)
PATCH: 버그 수정, 텍스트 수정
```

### 8.2 변경 로그

```yaml
# playbooks/budget-register-basic/CHANGELOG.yaml
versions:
  - version: "1.1.0"
    date: "2025-02-15"
    changes:
      - type: added
        description: 예산과목 자동 추천 기능 추가
      - type: changed
        description: 메뉴 셀렉터 업데이트

  - version: "1.0.1"
    date: "2025-02-01"
    changes:
      - type: fixed
        description: 저장 버튼 셀렉터 수정

  - version: "1.0.0"
    date: "2025-01-30"
    changes:
      - type: added
        description: 최초 릴리스
```

---

## 9. 테스트

### 9.1 단위 테스트

```typescript
// tests/playbook-parser.test.ts
describe('PlaybookParser', () => {
  it('should parse valid YAML playbook', async () => {
    const yaml = `
      id: test-playbook
      version: "1.0.0"
      metadata:
        title: Test
        category: 기타
      steps:
        - id: step-1
          action: navigate
          value: "https://example.com"
    `;

    const parser = new PlaybookParser();
    const result = await parser.parse(yaml);

    expect(result.id).toBe('test-playbook');
    expect(result.steps).toHaveLength(1);
  });

  it('should throw error for invalid playbook', async () => {
    const yaml = `
      id: test
      # missing required fields
    `;

    const parser = new PlaybookParser();
    await expect(parser.parse(yaml)).rejects.toThrow('Validation failed');
  });
});
```

### 9.2 통합 테스트

```typescript
// tests/playbook-execution.test.ts
describe('Playbook Execution', () => {
  let browser: Browser;
  let page: Page;
  let engine: PlaybookEngine;

  beforeAll(async () => {
    browser = await chromium.launch();
    page = await browser.newPage();
    engine = new PlaybookEngine(new PlaywrightController(page));
  });

  it('should execute simple playbook', async () => {
    const playbook = await loadPlaybook('test-playbook');

    const result = await engine.execute(playbook, {
      variables: { amount: 1000 },
    });

    expect(result.status).toBe('completed');
    expect(result.stepsExecuted).toBe(playbook.steps.length);
  });

  afterAll(async () => {
    await browser.close();
  });
});
```

---

## 10. 부록

### 10.1 플레이북 목록 (MVP)

| ID | 제목 | 카테고리 | 난이도 |
|----|------|----------|--------|
| budget-register-basic | 예산 등록 | 교부관리 | 쉬움 |
| budget-modify | 예산 수정 | 교부관리 | 쉬움 |
| budget-inquiry | 예산 조회 | 교부관리 | 쉬움 |
| expense-approval | 지출결의 등록 | 집행관리 | 보통 |
| expense-cancel | 지출결의 취소 | 집행관리 | 보통 |
| receipt-upload | 증빙서류 첨부 | 집행관리 | 쉬움 |
| settlement-report | 정산보고서 작성 | 정산관리 | 어려움 |
| member-register | 수급자 등록 | 회원관리 | 쉬움 |
| service-plan | 서비스 계획 수립 | 사업선정 | 보통 |
| project-register | 사업 등록 | 사업선정 | 보통 |

### 10.2 폴더 구조

```
playbooks/
├── common/
│   └── selectors.yaml         # 공통 셀렉터
├── templates/
│   ├── basic.yaml             # 기본 템플릿
│   └── approval.yaml          # 결재 템플릿
├── 회원관리/
│   ├── member-register.yaml
│   └── member-modify.yaml
├── 교부관리/
│   ├── budget-register-basic.yaml
│   ├── budget-modify.yaml
│   └── budget-inquiry.yaml
├── 집행관리/
│   ├── expense-approval.yaml
│   └── expense-cancel.yaml
├── 정산관리/
│   └── settlement-report.yaml
└── workflows/
    └── budget-workflow.yaml
```

---

*문서 끝*
