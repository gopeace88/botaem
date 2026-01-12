---
allowed-tools: Bash(npm:*), Bash(npx:*), Read
description: 테스트 실행. 단위/E2E/전체 테스트.
argument-hint: [--unit|--e2e|--all]
---
# Run Tests

## Context
```bash
# 변경된 파일
!`git diff --name-only HEAD~1 2>/dev/null || git status --short`
```

## Test Options

### 단위 테스트 (--unit, 기본)
```bash
cd botame-admin && npm test
```

### E2E 테스트 (--e2e)
```bash
cd botame-admin && npm run test:e2e
```

### 전체 테스트 (--all)
```bash
cd botame-admin && npm test && npm run test:e2e
```

### 커버리지 포함
```bash
cd botame-admin && npm test -- --coverage
```

## Process

test-runner agent를 사용하여:

### 1. 변경 파일 분석
영향받는 테스트 범위 식별

### 2. 테스트 실행
선택된 범위의 테스트 실행

### 3. 결과 분석
실패 시 원인 분석 및 수정 제안

## Output Format

```
🧪 테스트 결과

📋 범위: 단위 / E2E / 전체

📊 통계
- 테스트 수: XX
- 통과: XX
- 실패: XX
- 스킵: XX

✅ Passed
- runner.store.test.ts: 8/8
- playbook-runner.test.ts: 5/5

❌ Failed
- self-healing.test.ts
  └ "should heal with fallback"
  └ Error: Expected X but got Y

📈 커버리지 (--coverage 시)
- Statements: XX%
- Branches: XX%
- Functions: XX%
- Lines: XX%

⏱️ 소요 시간: XX초

💡 실패 분석
[실패 원인 및 수정 제안]
```
