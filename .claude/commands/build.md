---
allowed-tools: Bash(npm:*), Bash(pnpm:*), Bash(npx:*)
description: botame-admin 빌드 실행
---
## Context
- 현재 브랜치: !`git branch --show-current`
- 변경된 파일: !`git status --short`

## Task
botame-admin 프로젝트를 빌드합니다.
```bash
cd botame-admin && npm run build
```

빌드 실패 시 에러를 분석하고 해결책을 제시하세요.
