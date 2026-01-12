---
allowed-tools: Bash(python3:*), Bash(node:*), Bash(cat:*), Read
description: 오케스트레이션 시스템 헬스체크. 모든 스크립트/설정의 유효성을 검증합니다.
---
# System Health Check

## Checks

### 1. Hook Scripts 실행 가능성
!`find .claude/hooks -name "*.py" -exec python3 -m py_compile {} \; -print 2>&1`

### 2. Settings.json 유효성
!`cat .claude/settings.json | jq . > /dev/null 2>&1 && echo "✓ settings.json valid" || echo "✗ settings.json invalid"`

### 3. Skill YAML Frontmatter
!`find .claude/skills -name "SKILL.md" -exec sh -c 'head -20 "$1" | grep -q "^name:" && grep -q "^description:" && echo "✓ $1" || echo "✗ $1 missing frontmatter"' _ {} \;`

### 4. Agent YAML Frontmatter  
!`find .claude/agents -name "*.md" -exec sh -c 'head -20 "$1" | grep -q "^name:" && grep -q "^description:" && echo "✓ $1" || echo "✗ $1 missing frontmatter"' _ {} \;`

### 5. Command Frontmatter
!`find .claude/commands -name "*.md" -exec sh -c 'head -10 "$1" | grep -q "^description:" && echo "✓ $1" || echo "✗ $1 missing description"' _ {} \;`

### 6. 참조 파일 존재 확인
Skill 내 references/ 파일들이 실제 존재하는지 확인.

### 7. Script 의존성
Hook 스크립트에서 사용하는 외부 도구 (jq, prettier 등) 설치 확인.

## Output Format
```
🏥 Health Check Results

✅ Passed
- [항목]: [상태]

❌ Failed  
- [항목]: [문제] → [해결 방법]

⚠️ Warnings
- [항목]: [주의사항]

Overall: [HEALTHY / DEGRADED / CRITICAL]
```
