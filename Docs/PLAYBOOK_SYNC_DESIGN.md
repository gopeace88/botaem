# 플레이북 동기화 시스템 설계

## 1. 아키텍처 개요

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  botame-admin   │────▶│  Supabase DB     │◀────│ botame-guide-app│
│  (관리자)        │     │  (원본 저장소)    │     │  (사용자)        │
└─────────────────┘     └──────────────────┘     └─────────────────┘
       │                        │                        │
       │  CRUD                  │  단방향 동기화          │
       ▼                        ▼                        ▼
   플레이북 작성/편집      원본 플레이북 저장        읽기 전용 동기화
```

### 핵심 원칙

1. **DB가 원본 (Single Source of Truth)**
   - Admin에서 작성한 플레이북은 Supabase DB에 저장
   - 사용자 앱은 DB에서 동기화하여 로컬 캐시 사용

2. **Partial Update 전략**
   - 전체 동기화 대신 변경된 플레이북만 선별 업데이트
   - `checksum`, `updated_at` 기반 변경 감지

3. **Lazy Sync (지연 동기화)**
   - 앱 시작 시 전체 동기화 대신 메타 정보만 조회
   - 플레이북 사용 시점에 해당 플레이북만 체크 및 동기화

4. **오프라인 지원**
   - 로컬 캐시로 오프라인에서도 기존 플레이북 사용 가능

---

## 2. 데이터베이스 스키마

### playbooks 테이블
```sql
-- 핵심 필드
playbook_id TEXT UNIQUE NOT NULL,  -- 'botame-login'
version TEXT DEFAULT '1.0.0',
name TEXT NOT NULL,
description TEXT,
category TEXT,
difficulty TEXT,

-- 플레이북 내용
steps JSONB NOT NULL,
variables JSONB DEFAULT '{}',
preconditions JSONB DEFAULT '[]',
error_handlers JSONB DEFAULT '[]',

-- 동기화용
checksum TEXT,          -- 변경 감지용 해시
is_published BOOLEAN,   -- 공개 여부
updated_at TIMESTAMPTZ,

-- 통계
execution_count INT,
success_count INT,
```

### 동기화 상태 테이블
```sql
-- user_playbook_sync: 사용자별 동기화 상태
user_id UUID NOT NULL,
playbook_id UUID NOT NULL,
synced_version TEXT,
cache_checksum TEXT,
synced_at TIMESTAMPTZ,
```

---

## 3. 동기화 플로우

### 3.1 앱 시작 시
```
1. 로컬 캐시 인덱스 로드
2. (선택적) 변경 확인 → syncUpdatedPlaybooks()
3. 캐시된 플레이북 메모리 로드
```

### 3.2 플레이북 목록 조회
```
1. DB에서 published_playbooks 뷰 조회 (메타 정보만)
2. 원격 메타 캐시 저장 (5분 TTL)
3. 목록 표시 (전체 내용 다운로드 X)
```

### 3.3 플레이북 사용 시 (Lazy Sync)
```
loadPlaybook(playbookId, forceSync=false)
  │
  ├─ needsUpdate() 체크
  │   ├─ 캐시 없음 → 동기화 필요
  │   ├─ checksum 불일치 → 동기화 필요
  │   ├─ updated_at 불일치 → 동기화 필요
  │   └─ 일치 → 캐시에서 로드
  │
  ├─ 업데이트 필요 시
  │   └─ DB에서 전체 플레이북 조회 → 캐시 저장
  │
  └─ 캐시에서 로드 반환
```

### 3.4 수동 동기화
```
syncUpdatedPlaybooks()  - 변경된 것만
syncAllPlaybooks()      - 전체 강제 동기화
```

---

## 4. API 인터페이스

### IPC 채널

| 채널 | 설명 |
|-----|------|
| `playbook:sync:list` | 공개 플레이북 목록 (메타) |
| `playbook:sync:load` | 플레이북 로드 (Lazy Sync) |
| `playbook:sync:one` | 단일 플레이북 강제 동기화 |
| `playbook:sync:updated` | 변경된 플레이북만 동기화 |
| `playbook:sync:all` | 전체 플레이북 강제 동기화 |
| `playbook:sync:status` | 동기화 상태 확인 |
| `playbook:sync:cached` | 캐시된 플레이북 조회 |

### 사용 예시

```typescript
// 목록 조회 (메타만)
const { playbooks } = await window.electron.invoke('playbook:sync:list');

// 플레이북 로드 (Lazy Sync)
const { playbook, was_updated } = await window.electron.invoke(
  'playbook:sync:load',
  'botame-login',  // playbookId
  false            // forceSync
);

// 변경된 것만 동기화
const { synced, skipped, failed } = await window.electron.invoke(
  'playbook:sync:updated'
);

// 동기화 상태 확인
const statuses = await window.electron.invoke('playbook:sync:status');
for (const status of statuses) {
  console.log(`${status.name}: ${status.status}`);
  // synced, update_available, not_synced
}
```

---

## 5. 캐시 구조

```
~/.config/botame-guide-app/playbook-cache/
├── _index.json           # 캐시 인덱스
├── botame-login.json     # 플레이북 캐시
├── botame-navigate-menu.json
└── ...
```

### _index.json 형식
```json
{
  "botame-login": {
    "version": "1.0.0",
    "checksum": "abc123...",
    "updatedAt": "2025-12-05T10:00:00Z",
    "cachedAt": "2025-12-05T10:05:00Z"
  }
}
```

---

## 6. 성능 최적화

### 원격 메타 캐시
- DB 목록 조회 결과를 5분간 메모리 캐시
- 반복 조회 시 DB 호출 최소화

### Lazy Sync 효과
| 시나리오 | 기존 | Lazy Sync |
|---------|-----|-----------|
| 앱 시작 (10개 플레이북) | 10회 DB 조회 | 1회 메타 조회 |
| 1개 플레이북 사용 | - | +1회 조회 (필요 시) |
| 변경 없이 재사용 | - | 0회 (캐시) |

---

## 7. 에러 처리

### 오프라인 모드
```typescript
// Supabase 연결 실패 시 캐시 폴백
if (!supabaseService.isInitialized()) {
  const cached = await getCachedPlaybook(playbookId);
  if (cached) {
    return { success: true, playbook: cached, was_updated: false };
  }
  return { success: false, message: 'Supabase 연결 필요' };
}
```

### 동기화 실패
- 부분 실패 시 성공한 것만 반영
- 에러 로그 기록
- 캐시 유지 (롤백 없음)

---

## 8. 향후 개선 방향

1. **실시간 업데이트 알림**
   - Supabase Realtime으로 플레이북 변경 감지
   - 사용자에게 업데이트 알림

2. **버전 롤백**
   - playbook_versions 테이블 활용
   - 특정 버전으로 복원

3. **충돌 해결**
   - 사용자 커스텀 변수와 원본 충돌 시 병합 전략

4. **압축 전송**
   - 대용량 플레이북 전송 최적화
