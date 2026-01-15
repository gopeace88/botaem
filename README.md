# 보탬e 프로젝트

> 사전 지식 기반 지능형 업무 자동화 가이드

## 🎉 v1.0.0 릴리스 (2025-01-15)

보탬e 관리자의 첫 번째 공식 릴리스가 출시되었습니다!

### 다운로드

- [Windows (.exe)](https://github.com/gopeace88/botaem/releases/download/v1.0.0/보탬e-관리자-Setup-1.0.0.exe)
- [macOS (.dmg)](https://github.com/gopeace88/botaem/releases/download/v1.0.0/보탬e-관리자-1.0.0.dmg)
- [Linux (.AppImage)](https://github.com/gopeace88/botaem/releases/download/v1.0.0/보탬e-관리자-1.0.0.AppImage)

### 주요 기능

- ✅ 플레이북 녹화 및 실행
- ✅ 자동 고침 (Self-Healing) 시스템
- ✅ 클라우드 동기화 (Supabase)
- ✅ 오프라인 모드 지원
- ✅ 자동 업데이트
- ✅ 보안 API Key 저장소

자세한 내용은 [RELEASE_NOTES_v1.0.0.md](RELEASE_NOTES_v1.0.0.md)를 참조하세요.

## 문서 구조

```
보탬e/
├── README.md                    # 이 파일 (진입점)
├── CHANGELOG.md                 # 변경 로그
├── RELEASE_NOTES_v1.0.0.md     # v1.0.0 릴리스 노트
├── RELEASE_CHECKLIST.md        # 릴리스 체크리스트
├── Docs/
│   ├── MASTER_DESIGN.md        # ★ 핵심 설계 문서 (모든 개념 통합)
│   ├── PLAYBOOK_SYNC_DESIGN.md # 플레이북 동기화 상세
│   ├── plans/
│   │   ├── PRD-*.md            # 제품 요구사항 (상세 참조용)
│   │   └── TECHNICAL-SPEC.md   # 기술 스펙 (상세 참조용)
│   └── specs/
│       └── PLAYBOOK-SPEC.md    # 플레이북 스키마 정의
├── analysis_output/             # 보탬e 사이트 업무 분석
│   └── ...
├── site_analysis/               # 사이트 기술 분석
│   └── SITE_ANALYSIS_REPORT.md
├── botame-guide-app/            # 사용자 앱
│   └── .claude/CLAUDE.md       # 앱별 컨텍스트
└── botame-admin/                # 관리자 앱
    └── docs/plans/             # 관리자 앱 설계
```

## 핵심 원칙

1. **MASTER_DESIGN.md가 Single Source of Truth**
   - 모든 개념, 아키텍처, 데이터 구조는 이 문서에서 시작
   - 다른 문서는 상세 참조용

2. **코드 읽기 우선**
   - 문서보다 코드가 최신
   - 문서는 "왜"를 설명, 코드는 "어떻게"를 구현

3. **앱별 컨텍스트는 .claude/CLAUDE.md**
   - 각 앱 디렉토리의 `.claude/CLAUDE.md`에 해당 앱 실행 방법
   - 환경 설정, 테스트 계정 등

## 빠른 시작

```bash
# 사용자 앱 실행
cd botame-guide-app
npm run dev

# 관리자 앱 실행
cd botame-admin
npm run dev
```

## 주요 기술 스택

- **Frontend**: Electron + React + TypeScript
- **Browser Automation**: Playwright
- **Backend**: Supabase (Auth, DB, Storage)
- **AI**: Claude API

## 개발

```bash
# 의존성 설치
pnpm install

# 타입 체크
pnpm run typecheck

# 린트
pnpm run lint

# 테스트
pnpm run test

# E2E 테스트
pnpm run test:e2e

# 빌드
pnpm run build
```

## 릴리스

릴리스 절차는 [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)를 참조하세요.

## 라이선스

MIT License

## 기여

기여하고 싶으시다면 [GitHub Issues](https://github.com/gopeace88/botaem/issues)나 [GitHub Discussions](https://github.com/gopeace88/botaem/discussions)를 참여해주세요.
