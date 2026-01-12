---
allowed-tools: Read, Write, Bash(mkdir:*)
argument-hint: [skill-name] [description]
description: 새 Skill을 생성합니다. 템플릿 기반으로 SKILL.md와 기본 구조를 만듭니다.
---
# Create New Skill

## Input
- Skill 이름: $1
- 설명: $2 (이후 모든 인자)

## Creation Process

### Step 1: 요구사항 확인
Skill 생성 전 확인:
1. 이 Skill이 해결할 문제는?
2. 어떤 상황에서 트리거되어야 하는가?
3. 필요한 references/scripts/assets는?

### Step 2: 구조 생성
```bash
mkdir -p .claude/skills/$1/references
mkdir -p .claude/skills/$1/scripts
mkdir -p .claude/skills/$1/assets
```

### Step 3: SKILL.md 생성
`.claude/skills/$1/SKILL.md` 생성:
```markdown
---
name: $1
description: $2. Use when [구체적 트리거 상황].
---
# [Skill Name]

## Overview
[이 Skill이 제공하는 가치]

## Key Concepts
[핵심 개념 설명]

## File Map
| 영역 | 경로 |
|------|------|
| ... | ... |

## Workflows
[주요 워크플로우]

## References
- [참조1]: `references/xxx.md`
- [참조2]: `references/yyy.md`
```

### Step 4: 검증
- [ ] SKILL.md frontmatter 유효성
- [ ] description에 트리거 조건 명시
- [ ] 필요한 references 파일 생성

## Output
생성된 Skill 구조와 다음 단계 안내.
