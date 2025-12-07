-- playbooks 테이블 생성 (botame-admin용)
-- Supabase SQL Editor에서 실행하세요

-- 기본 playbooks 테이블
CREATE TABLE IF NOT EXISTS playbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playbook_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT '기타',
    difficulty TEXT DEFAULT '보통',
    estimated_time TEXT,
    keywords TEXT[] DEFAULT '{}',
    version TEXT DEFAULT '1.0.0',
    author TEXT DEFAULT 'admin',

    -- 플레이북 내용
    steps JSONB DEFAULT '[]',
    variables JSONB DEFAULT '{}',
    preconditions JSONB DEFAULT '[]',
    error_handlers JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',

    -- 상태
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    is_published BOOLEAN DEFAULT FALSE,
    order_index INT DEFAULT 0,

    -- 통계
    execution_count INT DEFAULT 0,
    success_count INT DEFAULT 0,

    -- 동기화
    checksum TEXT,
    yaml_content TEXT,

    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_playbooks_category ON playbooks(category);
CREATE INDEX IF NOT EXISTS idx_playbooks_status ON playbooks(status);
CREATE INDEX IF NOT EXISTS idx_playbooks_is_published ON playbooks(is_published);
CREATE INDEX IF NOT EXISTS idx_playbooks_playbook_id ON playbooks(playbook_id);

-- RLS 비활성화 (admin 앱에서 모든 접근 허용)
ALTER TABLE playbooks DISABLE ROW LEVEL SECURITY;

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_playbooks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS playbooks_updated_at ON playbooks;
CREATE TRIGGER playbooks_updated_at
    BEFORE UPDATE ON playbooks
    FOR EACH ROW EXECUTE FUNCTION update_playbooks_updated_at();

-- 테스트 데이터: 로그인 플레이북
INSERT INTO playbooks (playbook_id, name, description, category, difficulty, is_published, status, steps)
VALUES (
    'botame-login',
    '보탬e 로그인',
    '아이디/비밀번호로 보탬e 시스템에 로그인합니다.',
    '회원관리',
    '쉬움',
    TRUE,
    'active',
    '[
        {"id": "1", "action": "click", "selector": "[role=\"tab\"]:has-text(\"아이디 로그인\")", "message": "아이디 로그인 탭 클릭"},
        {"id": "2", "action": "type", "selector": "input[aria-label=\"로그인 ID\"]", "value": "{{user_id}}", "message": "아이디 입력"},
        {"id": "3", "action": "type", "selector": "input[aria-label=\"비밀번호\"]", "value": "{{password}}", "message": "비밀번호 입력"},
        {"id": "4", "action": "click", "selector": "role=button[name=\"로그인\"]", "message": "로그인 버튼 클릭"}
    ]'::JSONB
)
ON CONFLICT (playbook_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    steps = EXCLUDED.steps,
    updated_at = NOW();

-- 확인
SELECT id, playbook_id, name, category, is_published FROM playbooks;
