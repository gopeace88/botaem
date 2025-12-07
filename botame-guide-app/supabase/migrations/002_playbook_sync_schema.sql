-- 플레이북 동기화 스키마 v2
-- Migration: 002_playbook_sync_schema
--
-- 핵심 원칙:
-- 1. Admin에서 플레이북 작성 → DB에 저장 (원본)
-- 2. User는 DB에서 플레이북 동기화 (읽기 전용)
-- 3. 버전 관리로 변경 이력 추적

-- =============================================================================
-- 1. PLAYBOOKS TABLE 확장 (기존 스키마 보완)
-- =============================================================================

-- 기존 playbooks 테이블에 컬럼 추가 (없으면 추가)
DO $$
BEGIN
    -- yaml_content: 원본 YAML 저장
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'playbooks' AND column_name = 'yaml_content'
    ) THEN
        ALTER TABLE playbooks ADD COLUMN yaml_content TEXT;
    END IF;

    -- metadata: 전체 메타데이터 JSON
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'playbooks' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE playbooks ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;

    -- difficulty: 난이도
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'playbooks' AND column_name = 'difficulty'
    ) THEN
        ALTER TABLE playbooks ADD COLUMN difficulty TEXT DEFAULT '보통';
    END IF;

    -- estimated_time: 예상 소요 시간
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'playbooks' AND column_name = 'estimated_time'
    ) THEN
        ALTER TABLE playbooks ADD COLUMN estimated_time TEXT;
    END IF;

    -- author: 작성자
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'playbooks' AND column_name = 'author'
    ) THEN
        ALTER TABLE playbooks ADD COLUMN author TEXT DEFAULT 'admin';
    END IF;

    -- is_published: 공개 여부
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'playbooks' AND column_name = 'is_published'
    ) THEN
        ALTER TABLE playbooks ADD COLUMN is_published BOOLEAN DEFAULT FALSE;
    END IF;

    -- preconditions: 사전 조건
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'playbooks' AND column_name = 'preconditions'
    ) THEN
        ALTER TABLE playbooks ADD COLUMN preconditions JSONB DEFAULT '[]';
    END IF;

    -- error_handlers: 에러 핸들러
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'playbooks' AND column_name = 'error_handlers'
    ) THEN
        ALTER TABLE playbooks ADD COLUMN error_handlers JSONB DEFAULT '[]';
    END IF;

    -- checksum: 변경 감지용 해시
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'playbooks' AND column_name = 'checksum'
    ) THEN
        ALTER TABLE playbooks ADD COLUMN checksum TEXT;
    END IF;
END $$;

-- =============================================================================
-- 2. PLAYBOOK_VERSIONS TABLE - 버전 히스토리
-- =============================================================================
CREATE TABLE IF NOT EXISTS playbook_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playbook_id UUID NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,

    -- 버전 정보
    version TEXT NOT NULL,
    change_summary TEXT,
    changed_by TEXT,

    -- 해당 버전의 전체 데이터
    snapshot JSONB NOT NULL,  -- 전체 playbook 데이터 스냅샷

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playbook_versions_playbook ON playbook_versions(playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_versions_version ON playbook_versions(playbook_id, version);

-- =============================================================================
-- 3. USER_PLAYBOOK_SYNC TABLE - 사용자별 동기화 상태
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_playbook_sync (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    playbook_id UUID NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,

    -- 동기화 정보
    synced_version TEXT NOT NULL,
    synced_at TIMESTAMPTZ DEFAULT NOW(),

    -- 로컬 캐시 상태
    is_cached BOOLEAN DEFAULT TRUE,
    cache_checksum TEXT,

    -- 즐겨찾기
    is_favorite BOOLEAN DEFAULT FALSE,

    -- 사용자 커스텀 설정 (변수 기본값 등)
    custom_variables JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, playbook_id)
);

CREATE INDEX IF NOT EXISTS idx_user_playbook_sync_user ON user_playbook_sync(user_id);

-- RLS 정책
ALTER TABLE user_playbook_sync ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS user_playbook_sync_policy ON user_playbook_sync
    FOR ALL USING (auth.uid() = user_id);

-- =============================================================================
-- 4. PLAYBOOK CATEGORIES TABLE - 카테고리 관리
-- =============================================================================
CREATE TABLE IF NOT EXISTS playbook_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    color TEXT,
    order_index INT DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 카테고리 삽입
INSERT INTO playbook_categories (name, display_name, description, order_index) VALUES
    ('회원관리', '회원관리', '회원가입, 로그인, 정보수정 등', 1),
    ('사업선정', '사업선정', '공모사업 신청, 사업계획 관리', 2),
    ('교부관리', '교부관리', '교부신청, 교부결정', 3),
    ('집행관리', '집행관리', '집행등록, 카드사용내역, 이체관리', 4),
    ('정산관리', '정산관리', '집행마감, 정산검토, 실적보고', 5),
    ('사후관리', '사후관리', '정산반환, 징수처리', 6),
    ('기타', '기타', '기타 업무', 99)
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- 5. VIEWS - 편의성 뷰
-- =============================================================================

-- 공개된 플레이북 목록 (사용자 앱용)
CREATE OR REPLACE VIEW published_playbooks AS
SELECT
    p.id,
    p.playbook_id,
    p.name,
    p.description,
    p.category,
    p.difficulty,
    p.estimated_time,
    p.keywords,
    p.version,
    p.author,
    p.execution_count,
    p.success_count,
    p.updated_at,
    p.checksum,
    COALESCE(
        (p.success_count::FLOAT / NULLIF(p.execution_count, 0) * 100),
        0
    )::INT AS success_rate
FROM playbooks p
WHERE p.is_published = TRUE
  AND p.status = 'active'
ORDER BY p.category, p.order_index, p.name;

-- 사용자의 동기화 상태 포함 플레이북 목록
CREATE OR REPLACE VIEW user_playbooks AS
SELECT
    p.id,
    p.playbook_id,
    p.name,
    p.description,
    p.category,
    p.difficulty,
    p.estimated_time,
    p.keywords,
    p.version,
    p.checksum,
    p.updated_at,
    ups.user_id,
    ups.synced_version,
    ups.synced_at,
    ups.is_favorite,
    ups.custom_variables,
    CASE
        WHEN ups.synced_version IS NULL THEN 'not_synced'
        WHEN p.version != ups.synced_version THEN 'update_available'
        WHEN p.checksum != ups.cache_checksum THEN 'update_available'
        ELSE 'synced'
    END AS sync_status
FROM playbooks p
LEFT JOIN user_playbook_sync ups ON p.id = ups.playbook_id
WHERE p.is_published = TRUE
  AND p.status = 'active';

-- =============================================================================
-- 6. FUNCTIONS - 동기화 함수
-- =============================================================================

-- 플레이북 체크섬 계산 함수
CREATE OR REPLACE FUNCTION calculate_playbook_checksum(p_id UUID)
RETURNS TEXT AS $$
DECLARE
    checksum_data TEXT;
BEGIN
    SELECT MD5(
        COALESCE(name, '') ||
        COALESCE(description, '') ||
        COALESCE(steps::TEXT, '[]') ||
        COALESCE(variables::TEXT, '[]') ||
        COALESCE(version, '1.0.0')
    )
    INTO checksum_data
    FROM playbooks
    WHERE id = p_id;

    RETURN checksum_data;
END;
$$ LANGUAGE plpgsql;

-- 플레이북 저장 시 체크섬 자동 업데이트
CREATE OR REPLACE FUNCTION update_playbook_checksum()
RETURNS TRIGGER AS $$
BEGIN
    NEW.checksum := MD5(
        COALESCE(NEW.name, '') ||
        COALESCE(NEW.description, '') ||
        COALESCE(NEW.steps::TEXT, '[]') ||
        COALESCE(NEW.variables::TEXT, '[]') ||
        COALESCE(NEW.version, '1.0.0')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS playbooks_checksum ON playbooks;
CREATE TRIGGER playbooks_checksum
    BEFORE INSERT OR UPDATE ON playbooks
    FOR EACH ROW EXECUTE FUNCTION update_playbook_checksum();

-- 버전 히스토리 자동 저장
CREATE OR REPLACE FUNCTION save_playbook_version()
RETURNS TRIGGER AS $$
BEGIN
    -- 버전이 변경되었을 때만 저장
    IF OLD.version IS DISTINCT FROM NEW.version THEN
        INSERT INTO playbook_versions (playbook_id, version, changed_by, snapshot)
        VALUES (
            NEW.id,
            NEW.version,
            COALESCE(NEW.author, 'system'),
            jsonb_build_object(
                'playbook_id', NEW.playbook_id,
                'name', NEW.name,
                'description', NEW.description,
                'category', NEW.category,
                'difficulty', NEW.difficulty,
                'version', NEW.version,
                'steps', NEW.steps,
                'variables', NEW.variables,
                'preconditions', NEW.preconditions,
                'error_handlers', NEW.error_handlers,
                'metadata', NEW.metadata
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS playbooks_version_history ON playbooks;
CREATE TRIGGER playbooks_version_history
    AFTER UPDATE ON playbooks
    FOR EACH ROW EXECUTE FUNCTION save_playbook_version();

-- 사용자 동기화 함수
CREATE OR REPLACE FUNCTION sync_user_playbook(
    p_user_id UUID,
    p_playbook_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_playbook playbooks%ROWTYPE;
    v_result JSONB;
BEGIN
    -- 플레이북 조회
    SELECT * INTO v_playbook
    FROM playbooks
    WHERE id = p_playbook_id
      AND is_published = TRUE
      AND status = 'active';

    IF v_playbook IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Playbook not found');
    END IF;

    -- 동기화 상태 업데이트/삽입
    INSERT INTO user_playbook_sync (user_id, playbook_id, synced_version, cache_checksum)
    VALUES (p_user_id, p_playbook_id, v_playbook.version, v_playbook.checksum)
    ON CONFLICT (user_id, playbook_id)
    DO UPDATE SET
        synced_version = v_playbook.version,
        cache_checksum = v_playbook.checksum,
        synced_at = NOW(),
        updated_at = NOW();

    -- 결과 반환
    RETURN jsonb_build_object(
        'success', TRUE,
        'playbook', jsonb_build_object(
            'id', v_playbook.id,
            'playbook_id', v_playbook.playbook_id,
            'name', v_playbook.name,
            'description', v_playbook.description,
            'category', v_playbook.category,
            'difficulty', v_playbook.difficulty,
            'version', v_playbook.version,
            'steps', v_playbook.steps,
            'variables', v_playbook.variables,
            'preconditions', v_playbook.preconditions,
            'error_handlers', v_playbook.error_handlers,
            'checksum', v_playbook.checksum
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 모든 플레이북 동기화 상태 확인 함수
CREATE OR REPLACE FUNCTION check_sync_status(p_user_id UUID)
RETURNS TABLE (
    playbook_id UUID,
    playbook_name TEXT,
    current_version TEXT,
    synced_version TEXT,
    sync_status TEXT,
    needs_update BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.name,
        p.version,
        ups.synced_version,
        CASE
            WHEN ups.synced_version IS NULL THEN 'not_synced'
            WHEN p.version != ups.synced_version THEN 'update_available'
            WHEN p.checksum != ups.cache_checksum THEN 'update_available'
            ELSE 'synced'
        END,
        CASE
            WHEN ups.synced_version IS NULL THEN TRUE
            WHEN p.version != ups.synced_version THEN TRUE
            WHEN p.checksum != ups.cache_checksum THEN TRUE
            ELSE FALSE
        END
    FROM playbooks p
    LEFT JOIN user_playbook_sync ups
        ON p.id = ups.playbook_id AND ups.user_id = p_user_id
    WHERE p.is_published = TRUE
      AND p.status = 'active';
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 7. RPC Functions for Client
-- =============================================================================

-- 공개 플레이북 목록 조회 (인증 불필요)
CREATE OR REPLACE FUNCTION get_published_playbooks()
RETURNS SETOF published_playbooks AS $$
BEGIN
    RETURN QUERY SELECT * FROM published_playbooks;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 플레이북 상세 조회 (동기화용)
CREATE OR REPLACE FUNCTION get_playbook_for_sync(p_playbook_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_playbook playbooks%ROWTYPE;
BEGIN
    SELECT * INTO v_playbook
    FROM playbooks
    WHERE playbook_id = p_playbook_id
      AND is_published = TRUE
      AND status = 'active';

    IF v_playbook IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Playbook not found');
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'playbook', jsonb_build_object(
            'id', v_playbook.id,
            'playbook_id', v_playbook.playbook_id,
            'name', v_playbook.name,
            'description', v_playbook.description,
            'category', v_playbook.category,
            'difficulty', v_playbook.difficulty,
            'estimated_time', v_playbook.estimated_time,
            'keywords', v_playbook.keywords,
            'version', v_playbook.version,
            'author', v_playbook.author,
            'steps', v_playbook.steps,
            'variables', v_playbook.variables,
            'preconditions', v_playbook.preconditions,
            'error_handlers', v_playbook.error_handlers,
            'metadata', v_playbook.metadata,
            'checksum', v_playbook.checksum,
            'updated_at', v_playbook.updated_at
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 8. Initial Data - 분석된 플레이북 삽입
-- =============================================================================

-- 로그인 플레이북
INSERT INTO playbooks (
    playbook_id, name, description, category, difficulty, estimated_time,
    keywords, version, author, is_published, status,
    steps, variables, preconditions, error_handlers
) VALUES (
    'botame-login',
    '보탬e 로그인',
    '아이디/비밀번호로 보탬e 업무시스템에 로그인합니다.',
    '회원관리',
    '쉬움',
    '10초',
    ARRAY['로그인', '인증', '접속'],
    '1.0.0',
    'Claude',
    TRUE,
    'active',
    '[
        {"id": "navigate", "action": "navigate", "value": "https://www.losims.go.kr/lss.do", "message": "보탬e 업무시스템으로 이동합니다", "wait_for": "navigation", "timeout": 30000},
        {"id": "wait_load", "action": "wait", "wait_for": "network", "timeout": 5000, "message": "페이지 로딩을 기다립니다"},
        {"id": "click_id_tab", "action": "click", "selector": "text=아이디 로그인", "message": "아이디 로그인 탭을 클릭합니다", "timeout": 5000},
        {"id": "wait_tab", "action": "wait", "timeout": 500, "message": "탭 전환을 기다립니다"},
        {"id": "input_id", "action": "type", "selector": "input[type=''text''].cl-text", "value": "{{user_id}}", "message": "사용자 ID를 입력합니다"},
        {"id": "input_password", "action": "type", "selector": "input[type=''password''].cl-text", "value": "{{password}}", "message": "비밀번호를 입력합니다"},
        {"id": "click_login", "action": "click", "selector": ".btn-login:visible >> text=로그인", "message": "로그인 버튼을 클릭합니다", "timeout": 5000},
        {"id": "wait_login", "action": "wait", "wait_for": "network", "timeout": 10000, "message": "로그인 처리를 기다립니다"},
        {"id": "verify_login", "action": "assert", "message": "로그인 성공 여부를 확인합니다", "verify": {"success_text": "좋은 하루입니다"}}
    ]'::JSONB,
    '{"user_id": {"type": "string", "label": "사용자 ID", "required": true}, "password": {"type": "string", "label": "비밀번호", "required": true}}'::JSONB,
    '[{"check": "브라우저가 실행되어 있어야 합니다", "message": "브라우저를 먼저 실행해주세요", "action": "block"}]'::JSONB,
    '[{"match": "로그인 실패", "action": "guide", "message": "아이디 또는 비밀번호를 확인해주세요"}, {"match": "timeout", "action": "retry", "message": "응답이 늦어지고 있습니다"}]'::JSONB
)
ON CONFLICT (playbook_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    steps = EXCLUDED.steps,
    variables = EXCLUDED.variables,
    is_published = EXCLUDED.is_published,
    updated_at = NOW();

-- 메뉴 이동 플레이북
INSERT INTO playbooks (
    playbook_id, name, description, category, difficulty, estimated_time,
    keywords, version, author, is_published, status,
    steps, variables, preconditions, error_handlers
) VALUES (
    'botame-navigate-menu',
    '보탬e 메뉴 이동',
    '좌측 메뉴 트리에서 원하는 화면으로 이동합니다.',
    '기타',
    '쉬움',
    '5초',
    ARRAY['메뉴', '네비게이션', '이동'],
    '1.0.0',
    'Claude',
    TRUE,
    'active',
    '[
        {"id": "click_main_menu", "action": "click", "selector": "text={{main_menu}}", "message": "{{main_menu}} 메뉴를 클릭합니다", "timeout": 5000},
        {"id": "wait_expand", "action": "wait", "timeout": 1000, "message": "메뉴 펼침을 기다립니다"},
        {"id": "click_sub_menu", "action": "condition", "condition": "{{sub_menu}} !== ''''", "then": [{"id": "click_sub", "action": "click", "selector": "text={{sub_menu}}", "message": "{{sub_menu}} 서브메뉴를 클릭합니다", "timeout": 5000}]},
        {"id": "wait_load", "action": "wait", "wait_for": "network", "timeout": 10000, "message": "화면 로딩을 기다립니다"}
    ]'::JSONB,
    '{"main_menu": {"type": "select", "label": "메인 메뉴", "required": true, "options": ["즐겨찾기", "보조사업선정", "교부관리", "사업수행관리", "정보공시관리", "금융정보관리", "사용자지원"]}, "sub_menu": {"type": "string", "label": "서브 메뉴 (선택)", "required": false}}'::JSONB,
    '[{"check": "로그인 상태여야 합니다", "message": "먼저 로그인해주세요", "action": "block"}]'::JSONB,
    '[{"match": "권한이 없습니다", "action": "guide", "message": "해당 메뉴에 접근 권한이 없습니다"}, {"match": "timeout", "action": "retry", "message": "메뉴 로딩이 지연되고 있습니다"}]'::JSONB
)
ON CONFLICT (playbook_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    steps = EXCLUDED.steps,
    variables = EXCLUDED.variables,
    is_published = EXCLUDED.is_published,
    updated_at = NOW();
