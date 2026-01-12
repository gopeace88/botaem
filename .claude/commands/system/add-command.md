---
allowed-tools: Read, Write
argument-hint: [command-name] [description]
description: 새 Slash Command를 생성합니다.
---
# Create New Slash Command

## Input
- Command 이름: $1
- 설명: $2

## Creation Process

### Step 1: 요구사항 정의
1. 이 명령어가 자동화할 작업은?
2. 필요한 인자는?
3. 필요한 도구 권한은?
4. 실행 전 수집할 컨텍스트는?

### Step 2: Command 파일 생성
`.claude/commands/$1.md`:
```markdown
---
allowed-tools: [필요한 도구들]
argument-hint: [인자 힌트]
description: $2
---
## Context
[!` ` 문법으로 실행 전 컨텍스트 수집]

## Task
[Claude가 수행할 작업 설명]

[$ARGUMENTS 또는 $1, $2 등으로 인자 참조]
```

### Step 3: 검증
- [ ] description 명확함
- [ ] allowed-tools 최소 권한
- [ ] argument-hint 사용자 친화적

## Output
생성된 Command와 사용 예시.
