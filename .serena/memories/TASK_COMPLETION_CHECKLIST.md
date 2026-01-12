# 작업 완료 후 체크리스트

## 태스크 완료 후

### 1. 타입 체크
```bash
# 전체
pnpm -r typecheck

# 또는 특정 패키지
cd botame-admin && npm run typecheck
```

### 2. 린트
```bash
pnpm -r lint
```

### 3. 빌드 테스트
```bash
pnpm -r build
```

### 4. 테스트 (필요시)
```bash
cd botame-admin
npm run test
```

## PR 제출 전

### 1. 코드 스타일 확인
- TypeScript 규칙 준수
- 함수/변수 명명 규칙 확인
- 불필요한 console.log 제거

### 2. 문서 업데이트
- CLAUDE.md 업데이트 (필요시)
- 주요 변경사항이 있으면 MASTER_DESIGN.md 또는 TECHNICAL-SPEC.md 업데이트

### 3. Git 커밋 메시지 규칙
```
feat: 새로운 기능
fix: 버그 수정
refactor: 리팩토링
docs: 문서 업데이트
test: 테스트 추가/수정
chore: 기타 (빌드, 설정 등)
```

예: `feat: 자동 고침 기능 구현 (F-055 ~ F-060)`

### 4. 변경사항 정리
- 변경된 파일 목록
- 주요 기능/버그 픽스
- 호환성 영향

## 일반적인 개발 워크플로우

```
1. 태스크 시작
   ↓
2. 코드 수정
   ↓
3. 타입 체크 (pnpm -r typecheck)
   ↓
4. 린트 (pnpm -r lint)
   ↓
5. 빌드 테스트 (pnpm -r build)
   ↓
6. Git 커밋
   ↓
7. (선택) PR 제출
```
