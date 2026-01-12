---
name: botame-core
description: 보탬e 플레이북 시스템 핵심 도메인 지식. Use when working with (1) 플레이북 녹화/실행 로직, (2) 자동 고침 (self-healing), (3) SmartSelector 구조, (4) Supabase 동기화, (5) Electron IPC 통신.
---
# 보탬e Core Domain

## Architecture Overview
보탬e는 지방보조금시스템(losims.go.kr) 사용자를 위한 AI 가이드 앱.
Electron + React + Playwright + Supabase 기반.

## Key Concepts

### Playbook
사용자 작업 시나리오를 저장한 JSON. 스텝별로 브라우저 동작 정의.
- Schema: See `references/playbook-schema.md`
- Validation: `scripts/validate-playbook.py`

### SmartSelector
셀렉터 자동 고침을 위한 구조체.
```typescript
interface SmartSelector {
  primary: string;      // 주 셀렉터
  fallback: string[];   // 대체 셀렉터 배열
  metadata?: {
    text?: string;      // 요소 텍스트
    ariaLabel?: string; // ARIA 라벨
  };
}
```

### Self-Healing Flow
1. Primary selector 시도
2. 실패 시 fallback 순차 시도
3. 모두 실패 시 동적 텍스트 탐색
4. 최종 실패 시 수동 고침 UI

## File Map
| 영역 | 경로 |
|------|------|
| 플레이북 실행 | `electron/services/playbook-runner.service.ts` |
| 자동 고침 | `electron/core/self-healing.ts` |
| 녹화 서비스 | `electron/services/recording.service.ts` |
| 실행 UI | `src/components/runner/RunnerPanel.tsx` |
| 상태 관리 | `src/stores/runner.store.ts` |
| 공유 타입 | `shared/types.ts` |

## IPC Channels
See `references/ipc-patterns.md` for channel definitions.

## References
- Playbook Schema: `references/playbook-schema.md`
- Self-Healing Logic: `references/self-healing-logic.md`
- IPC Patterns: `references/ipc-patterns.md`
