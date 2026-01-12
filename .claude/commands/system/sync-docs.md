---
allowed-tools: Read, Write, Edit, Glob
description: CLAUDE.md와 오케스트레이션 시스템 설정을 동기화합니다. 새로 추가된 skills/agents/commands/hooks를 문서에 반영합니다.
---
# Sync Documentation

## Current State

### CLAUDE.md 내용
@CLAUDE.md

### 실제 시스템 구성
- Skills: !`find .claude/skills -name "SKILL.md" -exec dirname {} \; | xargs -I{} basename {}`
- Agents: !`ls .claude/agents/*.md 2>/dev/null | xargs -I{} basename {} .md`
- Commands: !`find .claude/commands -name "*.md" | xargs -I{} basename {} .md`
- Hooks: !`cat .claude/settings.json | jq -r '.hooks | keys[]' 2>/dev/null`

## Sync Tasks

### 1. 누락 항목 식별
CLAUDE.md에 없지만 시스템에 존재하는 항목 찾기.

### 2. CLAUDE.md 업데이트
다음 섹션 추가/업데이트:
```markdown
## 오케스트레이션 시스템

### Skills
| Skill | 설명 |
|-------|------|
| [name] | [description] |

### Agents  
| Agent | 전문 영역 |
|-------|----------|
| [name] | [description] |

### Commands
| Command | 용도 |
|---------|------|
| /[name] | [description] |

### Hooks
| Event | Matcher | 동작 |
|-------|---------|------|
| [event] | [matcher] | [action] |
```

### 3. 일관성 검증
- 모든 구성요소가 문서화됨
- 설명이 실제 동작과 일치

## Output
업데이트된 CLAUDE.md 섹션.
