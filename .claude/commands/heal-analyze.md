---
allowed-tools: Read, Grep, Bash(cat:*), Bash(jq:*)
description: 자동 고침 로그 분석 및 패턴 발견
---
## Context
- 최근 고침 로그: !`cat botame-admin/logs/heal.log | tail -50`

## Task
자동 고침 로그를 분석하여:
1. 실패 빈도가 높은 셀렉터 식별
2. 성공한 healMethod 패턴 분석
3. 개선 권장사항 제시

Use the playbook-healer subagent for detailed selector analysis.
