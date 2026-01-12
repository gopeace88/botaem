---
allowed-tools: Read, Edit, Bash(git:*), Grep, Glob
argument-hint: [bug-description]
description: 버그 수정 시작. 원인 분석, 수정 계획, 테스트 가이드.
---
# Start Bug Fix

## Input
버그 설명: $ARGUMENTS

## Context
```bash
# 현재 브랜치
!`git branch --show-current 2>/dev/null || echo ""`

# 최근 변경
!`git log --oneline -5 2>/dev/null || echo ""`
```

## Process

electron-debugger agent를 사용하여:

### 1. 버그 재현 조건 파악

- 어떤 상황에서 발생하는가?
- 재현 가능한가?
- 에러 메시지는?
- 콘솔/로그 출력은?

### 2. 관련 코드 탐색

버그 유형별 탐색 위치:

#### UI 버그
```bash
grep -r "관련키워드" src/components/
```

#### 상태 버그
```bash
grep -r "관련키워드" src/stores/
```

#### IPC 버그
```bash
grep -r "채널명" electron/ src/
```

#### 플레이북/고침 버그
```bash
grep -r "관련키워드" electron/services/ electron/core/
```

### 3. 원인 분석

- 코드 흐름 추적
- 최근 변경과 연관성
- 엣지 케이스 확인

### 4. 수정 계획

- 수정 위치
- 수정 방법
- 영향 범위

### 5. 테스트 케이스

- 버그 재현 테스트
- 수정 검증 테스트
- 회귀 테스트

## Output Format

```
🐛 버그 분석

📋 버그 설명
$ARGUMENTS

🔍 재현 조건
1. [조건 1]
2. [조건 2]
3. [버그 발생]

📍 원인 위치
- 파일: [경로]
- 라인: [번호]
- 함수: [이름]

🔎 원인 분석
[상세 원인 설명]

🔧 수정 계획

### 수정 내용
```typescript
// Before
[문제 코드]

// After
[수정 코드]
```

### 영향 범위
- [영향받는 기능 1]
- [영향받는 기능 2]

🧪 테스트 계획

### 버그 재현 테스트
```typescript
test('should not [버그 상황]', () => {
  // 테스트 코드
});
```

### 수정 검증
- [ ] 버그 상황 재현 안됨
- [ ] 정상 동작 확인
- [ ] 관련 기능 정상

✅ 수정 체크리스트
- [ ] 원인 코드 수정
- [ ] 테스트 추가
- [ ] 기존 테스트 통과
- [ ] 코드 리뷰
```
