# 보탬e 프로젝트

> 사전 지식 기반 지능형 업무 자동화 가이드

## 문서 구조

```
보탬e/
├── README.md                    # 이 파일 (진입점)
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
