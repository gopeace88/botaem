# 보탬e AI 가이드 어시스턴트

보탬e 시스템(지방보조금시스템) 사용자를 위한 AI 기반 데스크톱 가이드 어시스턴트.

---

## 코드 검색/분석 도구 사용 원칙 (필수)

### Serena MCP 우선 사용
**모든 코드 검색 및 분석 작업은 Serena를 우선적으로 사용해야 합니다.**

#### 초기 설정 (세션 시작 시)
1. **프로젝트 활성화**: `activate_project` (경로: `/mnt/d/00.Projects/02.보탬e`)
2. **온보딩 체크**: `check_onboarding_performed` → 미완료 시 `onboarding` 실행
3. **모드 설정**: `switch_modes` (modes: `["editing", "interactive"]`)

#### 주요 도구
| 도구 | 용도 |
|------|------|
| `find_symbol` | 클래스/함수/변수 검색 (LSP 기반) |
| `search_for_pattern` | 정규식 패턴 검색 |
| `get_symbols_overview` | 파일 내 심볼 구조 파악 |
| `find_referencing_symbols` | 참조 검색 (리팩토링용) |
| `replace_symbol_body` | 심볼 단위 코드 수정 |
| `rename_symbol` | 전체 코드베이스 리네이밍 |

#### 사용 원칙
- ✅ **Serena 우선**: 코드 심볼 검색, 분석, 리팩토링 시 Serena 사용
- ❌ **코드 검색에 Bash grep 지양**: 코드 분석 목적의 `grep -rn` 대신 Serena 사용
- ✅ **Bash grep 허용**: 로그 필터링, 빌드 출력 검색, 비코드 텍스트 처리
- **효과**: 토큰 70% 절감, LSP 정확도, 심볼 단위 추출

#### 언어 지원
- **TypeScript** (Electron + React): ✓ Serena LSP 지원
- **비코드 파일**: `search_for_pattern` 사용 (yaml, json, md 등)

---

## 프로젝트 개요

- **목표**: 일반 사용자가 보탬e 시스템을 AI의 도움을 받아 쉽게 사용
- **핵심 가치**: "옆에 전문가가 앉아서 화면을 보면서 가이드해주는 경험"
- **기술 스택**: Electron + React + Playwright + Supabase + Claude API

## 주요 문서

| 문서 | 설명 |
|------|------|
| [PRD](Docs/plans/PRD-botame-guide-assistant.md) | 제품 요구사항 정의서 (기능 명세, 사용자 스토리) |
| [TECHNICAL-SPEC](Docs/plans/TECHNICAL-SPEC.md) | 기술 설계서 (아키텍처, API, 데이터 모델) |
| [PLAYBOOK-SPEC](Docs/specs/PLAYBOOK-SPEC.md) | 플레이북 스키마 정의 |

## 프로젝트 구조

```
02.보탬e/
├── botame-admin/           # 관리자 도구 (Electron 앱)
│   ├── electron/           # Electron 메인 프로세스
│   │   ├── services/       # 핵심 서비스
│   │   │   ├── playbook-runner.service.ts  # 플레이북 실행 + 자동 고침
│   │   │   ├── recording.service.ts        # 녹화 서비스
│   │   │   └── supabase.service.ts         # 클라우드 동기화
│   │   └── core/
│   │       └── self-healing.ts             # 셀렉터 자가 치유 엔진
│   ├── src/                # React 렌더러
│   │   ├── components/
│   │   │   ├── runner/RunnerPanel.tsx      # 실행 패널 (고침 UI 포함)
│   │   │   └── recording/RecordingPanel.tsx
│   │   └── stores/
│   │       └── runner.store.ts             # 실행 상태 관리
│   └── shared/types.ts     # 공유 타입 정의
├── botame-guide-app/       # 사용자용 가이드 앱 (개발 예정)
├── Docs/                   # 문서
│   ├── plans/              # PRD, 기술 스펙
│   └── specs/              # 스키마 정의
└── analysis_output/        # 보탬e 시스템 분석 결과
```

## 핵심 기능

### 1. 플레이북 녹화/실행
- 브라우저 동작 녹화 및 플레이백
- 스마트 셀렉터 자동 생성

### 2. 자동 고침 (Self-Healing)
플레이북 실행 중 셀렉터 실패 시 자동으로 대체 셀렉터를 탐색.

**고침 전략 (우선순위):**
1. **폴백 셀렉터** - `smartSelector.fallback` 순차 시도
2. **동적 텍스트 탐색** - `step.message`에서 키워드 추출 후 텍스트/ARIA 매칭
3. **수동 고침** - 사용자가 브라우저에서 직접 요소 선택

**healMethod 타입:**
- `fallback`: 폴백 셀렉터 성공
- `dynamic`: 동적 텍스트 탐색 성공
- `text`/`aria`: 텍스트/ARIA 라벨 매칭
- `manual`: 수동 선택

**관련 파일:**
- `botame-admin/electron/services/playbook-runner.service.ts` - 자동 고침 로직
- `botame-admin/electron/core/self-healing.ts` - 폴백 셀렉터 엔진
- `botame-admin/src/components/runner/RunnerPanel.tsx` - 고침 UI

### 3. 카탈로그 동기화
- Supabase를 통한 플레이북 클라우드 저장/동기화
- 버전 관리 및 배포

## 개발 가이드

### 환경 설정
```bash
cd botame-admin
npm install
npm run dev
```

### 테스트 실행
```bash
# 자동 고침 유닛 테스트
npx tsc electron/services/__tests__/auto-heal.test.ts --outDir /tmp && node /tmp/auto-heal.test.js

# RunnerPanel 컴포넌트 테스트
npx tsc src/components/runner/__tests__/runner-panel.test.ts --outDir /tmp && node /tmp/runner-panel.test.js
```

### 주요 타입 정의

```typescript
// StepResult - 스텝 실행 결과 (자동 고침 정보 포함)
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

## 상수 값

- **기본 시작 URL**: `https://www.losims.go.kr/lss.do`
- **타임아웃 기본값**: 30000ms

## 변경 이력

| 날짜 | 변경 내용 |
|------|-----------|
| 2025-01 | 자동 고침 기능 구현 (F-055 ~ F-060) |
| 2025-01 | 플레이북 start_url 기본값 적용 |
| 2025-01 | 프로젝트 초기 설정 |
