# 개발 명령어 가이드

## 루트 (모노레포)

```bash
# 의존성 설치
pnpm install

# 전체 빌드
pnpm -r build

# 전체 타입 체크
pnpm -r typecheck

# 전체 린트
pnpm -r lint

# 전체 테스트
pnpm -r test

# 클린
pnpm -r exec rm -rf node_modules dist out
```

## botame-admin (관리자 앱)

```bash
cd botame-admin

# 개발 모드
npm run dev

# 빌드
npm run build

# 미리보기
npm run preview

# 타입 체크
npm run typecheck

# 린트
npm run lint
```

## botame-guide-app (사용자 앱)

```bash
cd botame-guide-app

# 개발 모드
npm run dev

# 빌드
npm run build

# 테스트
npm run test
npm run test:watch
npm run test:coverage

# 타입 체크
npm run typecheck

# 린트
npm run lint
```

## 테스트

### 유닛 테스트 실행
```bash
# 자동 고침 서비스 테스트
npx tsc botame-admin/electron/services/__tests__/auto-heal.test.ts --outDir /tmp && node /tmp/auto-heal.test.js

# RunnerPanel 컴포넌트 테스트
npx tsc botame-admin/src/components/runner/__tests__/runner-panel.test.ts --outDir /tmp && node /tmp/runner-panel.test.js
```

## Git

```bash
# 상태 확인
git status

# 커밋
git add .
git commit -m "feat: ..."

# 브랜치
git branch -a
git checkout -b feature/new-feature
```
