---
allowed-tools: Bash(npx:*), Bash(node:*), Read
argument-hint: [playbook-file.json]
description: 플레이북 JSON 검증 및 드라이런 테스트
---
## Task
플레이북 파일 `$ARGUMENTS`를 검증합니다.

1. JSON 구조 검증
2. 셀렉터 유효성 체크  
3. 필수 필드 확인

검증 스크립트:
```bash
python3 .claude/skills/botame-core/scripts/validate-playbook.py "$ARGUMENTS"
```
