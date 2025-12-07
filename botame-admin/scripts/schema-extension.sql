-- ============================================================
-- 보탬e 플레이북 스키마 확장
-- Bottom-up 플레이북 설계를 위한 테이블 추가
-- ============================================================

-- 1. playbooks 테이블에 level 컬럼 추가
ALTER TABLE playbooks ADD COLUMN IF NOT EXISTS level INT DEFAULT 2;
-- level: 1=atomic, 2=function, 3=scenario

-- 1-1. start_url 컬럼 추가 (플레이북 시작 페이지)
ALTER TABLE playbooks ADD COLUMN IF NOT EXISTS start_url TEXT;
-- 플레이북은 항상 특정 페이지에서 시작해야 함. 없으면 홈페이지 URL 사용.

-- 2. 플레이북 참조 관계 테이블 (상위-하위 관계)
CREATE TABLE IF NOT EXISTS playbook_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_playbook_id TEXT NOT NULL,
  child_playbook_id TEXT NOT NULL,
  execution_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(parent_playbook_id, child_playbook_id, execution_order)
);

-- 3. 자연어 별칭 테이블 (LLM 검색용)
CREATE TABLE IF NOT EXISTS playbook_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id TEXT NOT NULL,
  alias TEXT NOT NULL,
  language TEXT DEFAULT 'ko',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(playbook_id, alias)
);

-- 4. pg_trgm 확장 활성화 (유사도 검색용)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 5. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_playbooks_level ON playbooks(level);
CREATE INDEX IF NOT EXISTS idx_playbooks_category ON playbooks(category);
CREATE INDEX IF NOT EXISTS idx_playbook_refs_parent ON playbook_references(parent_playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_refs_child ON playbook_references(child_playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_aliases_trgm ON playbook_aliases USING gin(alias gin_trgm_ops);

-- 6. RLS 정책 (공개 읽기)
ALTER TABLE playbook_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read for playbook_references" ON playbook_references
  FOR SELECT USING (true);

CREATE POLICY "Public read for playbook_aliases" ON playbook_aliases
  FOR SELECT USING (true);

-- Service role만 쓰기 가능 (기본)
