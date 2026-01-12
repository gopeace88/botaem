# 보탬e AI 가이드 어시스턴트 - 프로젝트 개요

## 프로젝트 목적

일반 사용자(비프로그래머)가 **보탬e 시스템**(지방보조금시스템)을 AI의 도움을 받아 쉽게 사용할 수 있는 데스크톱 가이드 어시스턴트.

**핵심 가치**: "옆에 전문가가 앉아서 화면을 보면서 가이드해주는 경험"

## 타겟 사용자

- **Primary**: 비영리단체 회계담당자 (1인 담당, IT 수준 기본)
- **Secondary**: 신규 담당자 (인수인계 부족)

## 주요 문서

| 문서 | 설명 |
|------|------|
| [MASTER_DESIGN.md](Docs/MASTER_DESIGN.md) | ★ 핵심 설계 문서 (Single Source of Truth) |
| [PRD](Docs/plans/PRD-botame-guide-assistant.md) | 제품 요구사항 정의서 |
| [TECHNICAL-SPEC](Docs/plans/TECHNICAL-SPEC.md) | 기술 설계서 |
| [PLAYBOOK-SPEC](Docs/specs/PLAYBOOK-SPEC.md) | 플레이북 스키마 정의 |

## 기술 스택

- **Desktop**: Electron 28.x
- **UI**: React 18.x + shadcn/ui
- **상태관리**: Zustand 4.x
- **브라우저 제어**: Playwright 1.40+
- **로컬 DB**: SQLite (better-sqlite3)
- **빌드**: Vite 5.x + electron-vite 2.x
- **언어**: TypeScript 5.x
- **Cloud**: Supabase (Auth, DB + pgvector, Storage, Edge Functions)
- **AI**: Claude API

## 프로젝트 구조

```
02.보탬e/
├── botame-admin/           # 관리자 도구 (플레이북 녹화/편집/배포)
│   ├── electron/           # Electron 메인 프로세스
│   │   ├── services/       # 핵심 서비스 (playbook-runner, recording, supabase)
│   │   ├── core/           # 자가 치유 엔진 (self-healing-adapter.ts)
│   │   ├── ipc/            # IPC 핸들러
│   │   └── main.ts         # 엔트리포인트
│   ├── src/                # React 렌더러
│   │   ├── components/     # UI 컴포넌트
│   │   │   ├── runner/     # 플레이북 실행 패널
│   │   │   ├── recording/  # 녹화 패널
│   │   │   ├── playbook/   # 플레이북 목록/편집
│   │   │   └── settings/   # 설정
│   │   └── stores/         # Zustand 스토어 (runner, recording)
│   └── shared/types.ts     # 공유 타입 정의
├── botame-guide-app/       # 사용자용 가이드 앱 (개발 예정)
├── packages/               # 공유 패키지 (workspace)
│   └── @botame/core/       # 공유 코어 라이브러리
└── Docs/                   # 문서
```

## 핵심 기능

### 1. 플레이북 녹화/실행
- 브라우저 동작 녹화 및 플레이백
- 스마트 셀렉터 자동 생성 (다중 폴백)

### 2. 자동 고침 (Self-Healing)
플레이북 실행 중 셀렉터 실패 시 자동으로 대체 셀렉터 탐색.

**고침 전략 (우선순위):**
1. **폴백 셀렉터** - `smartSelector.fallback` 순차 시도
2. **동적 텍스트 탐색** - `step.message`에서 키워드 추출 후 텍스트/ARIA 매칭
3. **수동 고침** - 사용자가 브라우저에서 직접 요소 선택

**healMethod 타입:**
- `fallback`: 폴백 셀렉터 성공
- `dynamic`: 동적 텍스트 탐색 성공
- `text`/`aria`: 텍스트/ARIA 라벨 매칭
- `manual`: 수동 선택

### 3. 카탈로그 동기화
- Supabase를 통한 플레이북 클라우드 저장/동기화
- 버전 관리 및 배포

## 상수 값

- **기본 시작 URL**: `https://www.losims.go.kr/lss.do`
- **기본 타임아웃**: 30000ms

## 개발 명령어

```bash
# 관리자 앱
cd botame-admin
npm run dev          # 개발 모드
npm run build        # 빌드
npm run typecheck    # 타입 체크

# 전체 패키지 (루트)
pnpm install         # 의존성 설치
pnpm -r build        # 전체 빌드
pnpm -r typecheck    # 전체 타입 체크
```

## 주요 타입 정의

**StepResult** - 스텝 실행 결과 (자동 고침 정보 포함):
```typescript
interface StepResult {
  stepId: string;
  stepIndex: number;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  message?: string;
  error?: string;
  duration?: number;
  screenshot?: string;
  // 자동 고침 결과
  healed?: boolean;
  healedSelector?: string;
  originalSelector?: string;
  healMethod?: 'fallback' | 'text' | 'aria' | 'dynamic' | 'manual';
}
```

## Git 상태 (최근)

- 현재 브랜치: `main`
- 수정된 파일: 
  - 문서 (MASTER_DESIGN.md, PRD, TECHNICAL-SPEC)
  - botame-admin (서비스, 컴포넌트, 타입)
  - botame-guide-app (플레이북, playwright)
- 새로운 파일:
  - `.claude/`, `.mcp.json`
  - `packages/` (workspace 구조)
  - `botame-admin/electron/services/__tests__/`
  - `botame-admin/electron/core/self-healing-adapter.ts`
