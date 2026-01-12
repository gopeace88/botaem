---
allowed-tools: Read, Write, Edit, Bash(git:*), Grep, Glob
argument-hint: [feature-name] [description]
description: 새 기능 개발 시작. 브랜치 생성, 관련 파일 식별, 구현 가이드.
---
# Start Feature Development

## Input
- 기능명: $1
- 설명: $2

## Context
```bash
# 현재 브랜치
!`git branch --show-current 2>/dev/null || echo "Not a git repo"`

# 작업 상태
!`git status --short 2>/dev/null || echo ""`
```

## Process

### 1. 브랜치 생성
```bash
git checkout -b feature/$1
```

### 2. 관련 파일 분석

기능 요구사항에 따라:

#### Main Process 영향
- [ ] `electron/services/` - 새 서비스 필요?
- [ ] `electron/main.ts` - IPC 핸들러 추가?
- [ ] `electron/preload.ts` - API 노출 필요?

#### Renderer Process 영향
- [ ] `src/components/` - 새 컴포넌트?
- [ ] `src/stores/` - 상태 관리 변경?
- [ ] `src/hooks/` - 커스텀 훅 필요?

#### 공유 타입
- [ ] `shared/types.ts` - 타입 정의 추가?

### 3. 아키텍처 영향 분석

#### IPC 통신
- 새 채널 필요 여부
- 요청/응답 데이터 구조

#### 상태 관리
- 새 store 필요 여부
- 기존 store 확장

#### 외부 의존성
- 새 라이브러리 필요 여부
- Playwright 기능 활용

### 4. 구현 체크리스트 생성

## Output Format

```
🚀 기능 개발 시작: $1

📋 요구사항 분석
$2

🌿 브랜치
feature/$1

📁 영향 파일

### 생성할 파일
- [ ] electron/services/[feature].service.ts
- [ ] src/components/[feature]/[Feature]Panel.tsx
- [ ] src/stores/[feature].store.ts

### 수정할 파일
- [ ] electron/main.ts - IPC 핸들러 추가
- [ ] electron/preload.ts - API 노출
- [ ] shared/types.ts - 타입 정의

📐 아키텍처

### IPC 채널
- `[feature]:start` - 기능 시작
- `[feature]:result` - 결과 전달

### 상태 구조
```typescript
interface FeatureState {
  status: 'idle' | 'running' | 'done';
  data: FeatureData | null;
}
```

✅ 구현 체크리스트
- [ ] 타입 정의
- [ ] Main Process 서비스
- [ ] IPC 핸들러
- [ ] Preload API
- [ ] Zustand Store
- [ ] React 컴포넌트
- [ ] 단위 테스트
- [ ] 통합 테스트

💡 참고 자료
- skills/electron-react - IPC 패턴
- skills/botame-core - 프로젝트 구조
```
