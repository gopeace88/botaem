---
allowed-tools: Bash(npm:*), Bash(npx:*), Read
description: 프로젝트 빌드. 개발/프로덕션 빌드 실행.
argument-hint: [--prod]
---
# Project Build

## Context
```bash
# 현재 브랜치
!`git branch --show-current 2>/dev/null || echo ""`

# 변경 상태
!`git status --short 2>/dev/null || echo ""`
```

## Build Process

### 1. 사전 검사
```bash
# 타입 체크
cd botame-admin && npx tsc --noEmit
```

### 2. 린트
```bash
cd botame-admin && npm run lint
```

### 3. 빌드 실행

#### 개발 빌드 (기본)
```bash
cd botame-admin && npm run build
```

#### 프로덕션 빌드 (--prod)
```bash
cd botame-admin && npm run build:prod
```

### 4. 빌드 결과 확인
```bash
ls -la botame-admin/dist/
```

## Output Format

```
🏗️ 빌드 결과

📋 환경: 개발 / 프로덕션

✅ 사전 검사
- TypeScript: OK
- Lint: OK

📦 빌드
- Main Process: OK
- Renderer Process: OK
- Preload: OK

📁 출력
- dist/main.js (XXX KB)
- dist/preload.js (XX KB)
- dist/renderer/ (X.X MB)

⏱️ 소요 시간: XX초
```

## 빌드 실패 시

electron-debugger agent로 원인 분석:
- 타입 오류
- 모듈 해결 실패
- 설정 문제
