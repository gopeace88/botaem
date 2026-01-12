---
allowed-tools: Read, Write
argument-hint: [agent-name] [expertise-area]
description: 새 Subagent를 생성합니다. 전문 영역에 맞는 시스템 프롬프트와 도구 설정을 구성합니다.
---
# Create New Subagent

## Input
- Agent 이름: $1
- 전문 영역: $2

## Creation Process

### Step 1: 요구사항 정의
1. 이 Agent가 전문으로 할 작업은?
2. 자동 위임되어야 할 상황은? (description에 "Use PROACTIVELY when..." 포함)
3. 필요한 도구는? (Read only vs Full access)
4. 연관 Skill이 있는가?

### Step 2: Agent 파일 생성
`.claude/agents/$1.md`:
```markdown
---
name: $1
description: $2 전문가. Use PROACTIVELY when (1) [상황1], (2) [상황2], (3) [상황3].
tools: Read, Edit, Grep, Glob, Bash
model: sonnet
skills: [연관 skill]
---
You are a $2 specialist for 보탬e.

## On Invocation
1. [첫 번째 할 일]
2. [두 번째 할 일]
3. [세 번째 할 일]

## Responsibilities
- [책임 1]
- [책임 2]

## Key Files
- `path/to/relevant/file1.ts`
- `path/to/relevant/file2.ts`

## Output Format
[응답 형식 정의]
```

### Step 3: 검증
- [ ] description에 "Use PROACTIVELY" 포함
- [ ] tools 최소 권한 원칙 적용
- [ ] 명확한 책임 범위 정의

## Output
생성된 Agent와 테스트 방법 안내.
