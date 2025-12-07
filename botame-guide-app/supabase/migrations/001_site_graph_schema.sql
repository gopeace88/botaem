-- Site Graph DB Schema for Botame Guide App (Simplified)
-- Migration: 001_site_graph_schema
--
-- 핵심 원칙:
-- 1. 페이지 전이가 핵심 (플레이북 시나리오 경로)
-- 2. 시나리오에 필요한 Element만 저장
-- 3. Element 간 관계, 외부 링크 저장하지 않음

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. PAGES TABLE - 방문한 페이지 (시나리오에 등장하는 페이지만)
-- =============================================================================
CREATE TABLE pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 식별
    url TEXT UNIQUE NOT NULL,
    url_pattern TEXT,              -- 동적 파라미터 제외 패턴
    domain TEXT NOT NULL,

    -- 메타데이터
    title TEXT,
    page_type TEXT,                -- LOGIN, DASHBOARD, FORM, LIST, DETAIL, MENU
    description TEXT,

    -- 스냅샷 (선택적)
    screenshot_path TEXT,          -- Storage 경로

    -- 상태
    status TEXT DEFAULT 'active',  -- active, changed, deleted
    verified BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pages_domain ON pages(domain);
CREATE INDEX idx_pages_type ON pages(page_type);

-- =============================================================================
-- 2. ELEMENTS TABLE - 시나리오에 필요한 요소만
-- =============================================================================
CREATE TABLE elements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,

    -- 기본 정보
    name TEXT NOT NULL,            -- 사람이 읽기 쉬운 이름 (예: "로그인 버튼")
    element_type TEXT NOT NULL,    -- BUTTON, INPUT_TEXT, INPUT_PASSWORD, LINK, SELECT, CHECKBOX

    -- 셀렉터 (다중, 안정성 순서)
    selectors JSONB NOT NULL DEFAULT '{"primary": "", "fallbacks": []}',
    /*
    {
        "primary": "role=button[name='로그인 버튼']",
        "fallbacks": ["text=로그인", "#login-btn"]
    }
    */

    -- 역할 (시나리오 관점)
    role TEXT,                     -- LOGIN_BUTTON, USERNAME_INPUT, PASSWORD_INPUT, SUBMIT, NEXT, MENU_ITEM

    -- 설명
    description TEXT,

    -- 상태
    verified BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- 같은 페이지에 같은 이름의 요소 중복 방지
    UNIQUE(page_id, name)
);

CREATE INDEX idx_elements_page ON elements(page_id);
CREATE INDEX idx_elements_role ON elements(role);

-- =============================================================================
-- 3. PLAYBOOKS TABLE - 시나리오 (핵심 테이블)
-- =============================================================================
CREATE TABLE playbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 식별자
    playbook_id TEXT UNIQUE NOT NULL,  -- auto-login, budget-register
    version TEXT DEFAULT '1.0.0',

    -- 메타데이터
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    keywords TEXT[],

    -- 계층 구조
    parent_id UUID REFERENCES playbooks(id) ON DELETE SET NULL,
    order_index INT DEFAULT 0,

    -- 시나리오 단계 (핵심!)
    steps JSONB NOT NULL DEFAULT '[]',
    /*
    [
        {
            "id": "step1",
            "action": "navigate",
            "value": "https://www.losims.go.kr/lss.do",
            "message": "보탬e 페이지로 이동합니다",
            "next_page_id": "uuid"  -- 이동 후 페이지 (선택적)
        },
        {
            "id": "step2",
            "action": "click",
            "page_id": "uuid",       -- 현재 페이지
            "element_id": "uuid",    -- 클릭할 요소
            "selector": "text=아이디 로그인",  -- fallback용 직접 셀렉터
            "message": "아이디 로그인 탭을 클릭합니다"
        },
        {
            "id": "step3",
            "action": "type",
            "page_id": "uuid",
            "element_id": "uuid",
            "selector": "input[type='text']",
            "value": "${username}",  -- 변수 참조
            "message": "아이디를 입력합니다"
        }
    ]
    */

    -- 변수 정의
    variables JSONB DEFAULT '[]',
    /*
    [
        { "name": "username", "type": "text", "label": "아이디", "required": true },
        { "name": "password", "type": "password", "label": "비밀번호", "required": true }
    ]
    */

    -- 시작/종료 페이지 (시나리오 경로의 양 끝)
    start_page_id UUID REFERENCES pages(id) ON DELETE SET NULL,
    end_page_id UUID REFERENCES pages(id) ON DELETE SET NULL,

    -- 상태
    status TEXT DEFAULT 'active',  -- draft, active, deprecated

    -- 통계
    execution_count INT DEFAULT 0,
    success_count INT DEFAULT 0,
    last_executed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_playbooks_category ON playbooks(category);
CREATE INDEX idx_playbooks_parent ON playbooks(parent_id);
CREATE INDEX idx_playbooks_keywords ON playbooks USING GIN(keywords);

-- =============================================================================
-- 4. CREDENTIALS TABLE - 암호화된 인증 정보
-- =============================================================================
CREATE TABLE credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,

    domain TEXT NOT NULL,
    label TEXT,                    -- "개인 계정", "테스트 계정"

    -- 암호화된 데이터
    encrypted_data TEXT NOT NULL,

    is_default BOOLEAN DEFAULT FALSE,
    last_used_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, domain, label)
);

-- RLS
ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY credentials_policy ON credentials
    FOR ALL USING (auth.uid() = user_id);

-- =============================================================================
-- 5. EXECUTION_LOGS TABLE - 실행 로그
-- =============================================================================
CREATE TABLE execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playbook_id UUID NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
    user_id UUID,

    status TEXT NOT NULL,          -- started, completed, failed
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INT,

    -- 실패 정보
    failed_step_id TEXT,
    error_message TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_execution_logs_playbook ON execution_logs(playbook_id);

-- =============================================================================
-- TRIGGERS
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pages_updated_at BEFORE UPDATE ON pages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER elements_updated_at BEFORE UPDATE ON elements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER playbooks_updated_at BEFORE UPDATE ON playbooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER credentials_updated_at BEFORE UPDATE ON credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- 플레이북 실행 통계 업데이트 함수
-- =============================================================================
CREATE OR REPLACE FUNCTION update_playbook_stats(
    p_playbook_id UUID,
    p_success BOOLEAN
)
RETURNS VOID AS $$
BEGIN
    UPDATE playbooks
    SET
        execution_count = execution_count + 1,
        success_count = CASE WHEN p_success THEN success_count + 1 ELSE success_count END,
        last_executed_at = NOW()
    WHERE id = p_playbook_id;
END;
$$ LANGUAGE plpgsql;
