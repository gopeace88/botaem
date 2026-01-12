---
allowed-tools: Read, Bash(python3:*), Bash(npm:*), Bash(npx:*)
argument-hint: [playbook-file.json] [--dry-run]
description: 플레이북 테스트 실행. 유효성 검증 및 실제 브라우저 테스트.
---
# Playbook Test

## Input
- 플레이북 파일: $1
- 옵션: $2

## Process

test-runner agent를 사용하여:

### 1. JSON 유효성 검증
```bash
!`python3 .claude/skills/botame-core/scripts/validate-playbook.py "$1" 2>&1 || echo "Validation script not found"`
```

### 2. 스키마 검증
- 필수 필드 확인 (id, name, steps)
- 각 스텝 구조 검증
- SmartSelector 구조 검증

### 3. 테스트 실행

#### Dry-run 모드 (--dry-run)
- 실제 브라우저 실행 없이 시뮬레이션
- 셀렉터 문법 검증
- 흐름 논리 검토

#### 실제 실행 모드
```bash
cd botame-admin && npm run test:playbook -- --file="$1"
```

### 4. 결과 리포트
- 각 스텝 성공/실패 상태
- 실패 시 원인 분석
- 스크린샷 (실패 스텝)

## Output Format

```
🧪 플레이북 테스트 결과

📋 대상: [파일명]
📊 스텝: [총 스텝 수]

✅ Step 1: 로그인 페이지 이동 - OK (1.2s)
✅ Step 2: 아이디 입력 - OK (0.3s)
✅ Step 3: 비밀번호 입력 - OK (0.2s)
❌ Step 4: 로그인 버튼 클릭 - FAILED
   └ Error: Selector timeout
   └ Tried: #btn_login, button:has-text("로그인")
   └ Screenshot: .claude/workspace/test-results/step4-fail.png

📊 Summary
- Passed: 3/4
- Failed: 1/4
- Duration: 5.2s

💡 실패 분석
- Step 4: 로그인 버튼 셀렉터 변경 추정
- 제안: selector-healer agent로 셀렉터 고침
```
