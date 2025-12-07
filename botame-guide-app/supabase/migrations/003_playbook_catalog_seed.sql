-- 플레이북 카탈로그 시드 데이터
-- Migration: 003_playbook_catalog_seed
--
-- 매뉴얼 분석 기반 전체 플레이북 목록
-- is_published = FALSE: 아직 구현되지 않음 (관리자용 참조)
-- is_published = TRUE: 구현 완료, 사용자에게 공개

-- =============================================================================
-- 1. 회원관리 (10개)
-- =============================================================================

INSERT INTO playbooks (playbook_id, name, description, category, difficulty, estimated_time, keywords, version, author, is_published, status, steps, variables)
VALUES
-- 구현됨
('member-login', '로그인', '보탬e 시스템에 아이디/비밀번호로 로그인합니다.', '회원관리', '쉬움', '10초',
 ARRAY['로그인', '인증', '접속'], '1.0.0', 'system', TRUE, 'active',
 '[{"id":"s1","action":"navigate","value":"https://www.losims.go.kr/lss.do"},{"id":"s2","action":"click","selector":"text=아이디 로그인"},{"id":"s3","action":"type","selector":"input[type=text]","value":"{{user_id}}"},{"id":"s4","action":"type","selector":"input[type=password]","value":"{{password}}"},{"id":"s5","action":"click","selector":"role=button[name=로그인 버튼]"}]'::JSONB,
 '{"user_id":{"type":"string","label":"사용자 ID","required":true},"password":{"type":"string","label":"비밀번호","required":true}}'::JSONB),

-- 미구현 (카탈로그용)
('member-login-cert', '인증서 로그인', '공인인증서로 보탬e에 로그인합니다.', '회원관리', '보통', '30초',
 ARRAY['인증서', '로그인', '공인인증'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('member-signup', '회원가입', '본인인증 → 회원정보입력 → 가입신청 절차를 진행합니다.', '회원관리', '보통', '5분',
 ARRAY['회원가입', '본인인증', '신규가입'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('member-org-join', '단체 소속 가입', '기존 등록된 단체에 구성원으로 가입을 신청합니다.', '회원관리', '쉬움', '2분',
 ARRAY['단체가입', '소속', '구성원'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('member-org-register', '단체 신규 등록', '사업자등록번호로 신규 단체를 등록합니다.', '회원관리', '보통', '5분',
 ARRAY['단체등록', '사업자번호', '신규단체'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('member-org-approve', '구성원 가입 승인', '단체담당자가 가입 신청한 구성원을 승인합니다.', '회원관리', '쉬움', '1분',
 ARRAY['가입승인', '구성원', '단체관리'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('member-role-assign', '권한 부여', '민간보조사업담당자 권한을 부여합니다.', '회원관리', '쉬움', '1분',
 ARRAY['권한', '역할', '담당자'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('member-cert-register', '인증서 등록', '펌뱅킹용 이체 인증서를 등록합니다.', '회원관리', '보통', '3분',
 ARRAY['인증서', '펌뱅킹', '이체'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('member-info-view', '회원정보 조회', '내 회원정보를 조회합니다.', '회원관리', '쉬움', '30초',
 ARRAY['회원정보', '조회', '내정보'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('member-info-edit', '회원정보 수정', '내 회원정보를 수정합니다.', '회원관리', '쉬움', '2분',
 ARRAY['회원정보', '수정', '변경'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB)

ON CONFLICT (playbook_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    difficulty = EXCLUDED.difficulty,
    keywords = EXCLUDED.keywords,
    updated_at = NOW();

-- =============================================================================
-- 2. 사업선정 (8개)
-- =============================================================================

INSERT INTO playbooks (playbook_id, name, description, category, difficulty, estimated_time, keywords, version, author, is_published, status, steps, variables)
VALUES
('project-list', '공모사업 목록 조회', '현재 공모 중인 사업 목록을 확인합니다.', '사업선정', '쉬움', '30초',
 ARRAY['공모', '사업목록', '조회'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('project-apply-start', '공모신청 시작', '공모사업 신청을 시작합니다.', '사업선정', '쉬움', '1분',
 ARRAY['공모신청', '시작', '신청'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('project-apply-info', '신청정보 입력', '신청사업자정보, 세부추진계획을 입력합니다.', '사업선정', '어려움', '30분',
 ARRAY['신청정보', '추진계획', '사업자정보'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('project-apply-budget', '예산집행계획 등록', '비목/세목별 예산 배분을 등록합니다.', '사업선정', '어려움', '20분',
 ARRAY['예산', '비목', '세목', '집행계획'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('project-apply-submit', '공모신청서 제출', '자격요건 확인 → 동의 → 제출합니다.', '사업선정', '보통', '5분',
 ARRAY['신청서', '제출', '자격요건'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('project-plan-register', '수행사업계획서 등록', '선정 후 수행계획서를 작성합니다 (필수).', '사업선정', '어려움', '1시간',
 ARRAY['수행계획서', '사업계획', '필수'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('project-plan-submit', '수행사업계획서 제출', '자부담계좌 등록 포함, 계획서를 제출합니다.', '사업선정', '보통', '10분',
 ARRAY['계획서제출', '자부담계좌'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('project-status-check', '사업선정 상태 확인', '내 신청 사업의 선정 상태를 확인합니다.', '사업선정', '쉬움', '30초',
 ARRAY['상태확인', '선정결과', '진행상황'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB)

ON CONFLICT (playbook_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    difficulty = EXCLUDED.difficulty,
    keywords = EXCLUDED.keywords,
    updated_at = NOW();

-- =============================================================================
-- 3. 교부관리 (5개)
-- =============================================================================

INSERT INTO playbooks (playbook_id, name, description, category, difficulty, estimated_time, keywords, version, author, is_published, status, steps, variables)
VALUES
('grant-project-view', '보조사업 상세조회', '내 보조사업 상세 정보를 확인합니다.', '교부관리', '쉬움', '30초',
 ARRAY['보조사업', '상세조회', '사업정보'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('grant-apply', '교부신청', '교부금액 입력 → 신청서 제출합니다.', '교부관리', '보통', '10분',
 ARRAY['교부신청', '교부금', '신청서'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('grant-apply-add', '추가 교부신청', '추가 교부금을 신청합니다.', '교부관리', '보통', '10분',
 ARRAY['추가교부', '교부신청', '추가'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('grant-print', '교부신청서 출력', '교부신청서를 PDF로 출력합니다.', '교부관리', '쉬움', '1분',
 ARRAY['출력', 'PDF', '신청서'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('grant-status-check', '교부결정 상태 확인', '교부 승인/반려 상태를 확인합니다.', '교부관리', '쉬움', '30초',
 ARRAY['교부결정', '상태', '승인'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB)

ON CONFLICT (playbook_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    difficulty = EXCLUDED.difficulty,
    keywords = EXCLUDED.keywords,
    updated_at = NOW();

-- =============================================================================
-- 4. 집행관리 (11개) - 핵심 업무, 우선순위 높음
-- =============================================================================

INSERT INTO playbooks (playbook_id, name, description, category, difficulty, estimated_time, keywords, version, author, is_published, status, steps, variables)
VALUES
('exec-cert-register', '이체인증서 등록', '집행을 위한 이체인증서를 등록합니다.', '집행관리', '보통', '5분',
 ARRAY['인증서', '이체', '등록'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('exec-password-register', '이체비밀번호 등록', '이체용 비밀번호를 설정합니다.', '집행관리', '쉬움', '2분',
 ARRAY['비밀번호', '이체', '설정'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('exec-vendor-register', '거래처계좌 등록', '자주쓰는 거래처 계좌를 등록합니다.', '집행관리', '쉬움', '3분',
 ARRAY['거래처', '계좌', '등록'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

-- ★ 우선순위 1: 가장 빈번한 작업
('exec-tax-invoice', '전자세금계산서 집행등록', '세금계산서 조회 → 집행정보 입력 → 저장. 가장 빈번한 집행 업무입니다.', '집행관리', '보통', '5분',
 ARRAY['세금계산서', '집행등록', '증빙', '우선순위1'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('exec-other-evidence', '기타증빙 집행등록', '기타 증빙자료로 집행을 등록합니다.', '집행관리', '보통', '5분',
 ARRAY['기타증빙', '집행등록', '증빙'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('exec-card', '전용카드 집행등록', '보조금 전용카드 사용내역을 집행 등록합니다.', '집행관리', '보통', '5분',
 ARRAY['전용카드', '집행등록', '카드'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('exec-labor', '인건비 집행등록', '원천징수 + 실지급액을 분리하여 집행 등록합니다.', '집행관리', '어려움', '10분',
 ARRAY['인건비', '원천징수', '급여'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

-- ★ 우선순위 2
('exec-transfer-list', '이체요청 목록조회', '이체 대기 건 목록을 확인합니다.', '집행관리', '쉬움', '1분',
 ARRAY['이체요청', '목록', '조회', '우선순위2'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

-- ★ 우선순위 3
('exec-transfer-execute', '이체실행', '비밀번호 → 인증서 → 이체를 실행합니다.', '집행관리', '보통', '3분',
 ARRAY['이체실행', '인증', '송금', '우선순위3'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('exec-transfer-cancel', '이체취소', '이체 실행을 취소하고 금액을 복원합니다.', '집행관리', '보통', '2분',
 ARRAY['이체취소', '복원', '취소'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('exec-card-manage', '전용카드 관리', '카드 등록 및 사용내역을 조회합니다.', '집행관리', '쉬움', '2분',
 ARRAY['전용카드', '관리', '조회'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB)

ON CONFLICT (playbook_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    difficulty = EXCLUDED.difficulty,
    keywords = EXCLUDED.keywords,
    updated_at = NOW();

-- =============================================================================
-- 5. 정산관리 (14개)
-- =============================================================================

INSERT INTO playbooks (playbook_id, name, description, category, difficulty, estimated_time, keywords, version, author, is_published, status, steps, variables)
VALUES
('settle-close-exec', '집행마감', '사업수행중 → 집행마감 상태로 변경합니다. 마감 후 집행 추가 불가.', '정산관리', '보통', '5분',
 ARRAY['집행마감', '마감', '정산시작'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('settle-close-exec-cancel', '집행마감 취소', '집행마감 → 사업수행중으로 복원합니다.', '정산관리', '쉬움', '2분',
 ARRAY['마감취소', '복원'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('settle-interest-register', '이자등록', '예치계좌 이자를 등록합니다 (예치형 필수).', '정산관리', '쉬움', '3분',
 ARRAY['이자', '예치계좌', '등록'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('settle-revenue-register', '수익금등록', '발생한 수익금을 등록합니다.', '정산관리', '쉬움', '3분',
 ARRAY['수익금', '등록'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('settle-review-list', '정산검토 대상조회', '(지자체) 검토 대상 사업 목록을 확인합니다.', '정산관리', '쉬움', '1분',
 ARRAY['정산검토', '대상', '목록'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('settle-review-item', '개별건 정산검토', '(지자체) 검토완료/보완요청/보완불가 처리합니다.', '정산관리', '보통', '10분',
 ARRAY['정산검토', '검토', '보완'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('settle-close', '정산마감', '정산검토중 → 정산마감 처리합니다.', '정산관리', '보통', '5분',
 ARRAY['정산마감', '마감'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('settle-report-write', '실적보고서 작성', '기본현황/계획대비실적/사업성과/정산보고서를 작성합니다.', '정산관리', '어려움', '1시간',
 ARRAY['실적보고서', '작성', '보고서'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('settle-report-submit', '실적보고서 제출', '작성 완료된 실적보고서를 제출합니다.', '정산관리', '쉬움', '2분',
 ARRAY['보고서제출', '제출'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('settle-report-review', '실적보고서 심사', '(지자체) 제출된 보고서를 심사하고 전자결재 요청합니다.', '정산관리', '보통', '30분',
 ARRAY['보고서심사', '심사', '결재'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('settle-return-request', '정산반환 요청', '잔액/불인정금액/이자 반환을 요청합니다.', '정산관리', '보통', '10분',
 ARRAY['정산반환', '반환', '잔액'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('settle-return-transfer', '반환이체 실행', '반환금 이체를 실행합니다.', '정산관리', '보통', '5분',
 ARRAY['반환이체', '이체'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('settle-collect-request', '징수요청 등록', '(지자체) 징수요청 → 전자결재를 요청합니다.', '정산관리', '보통', '10분',
 ARRAY['징수', '요청', '결재'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('settle-collect-transfer', '징수이체 실행', '예치계좌 → 징수계좌로 이체합니다.', '정산관리', '보통', '5분',
 ARRAY['징수이체', '이체'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB)

ON CONFLICT (playbook_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    difficulty = EXCLUDED.difficulty,
    keywords = EXCLUDED.keywords,
    updated_at = NOW();

-- =============================================================================
-- 6. 공통/유틸리티 (5개)
-- =============================================================================

INSERT INTO playbooks (playbook_id, name, description, category, difficulty, estimated_time, keywords, version, author, is_published, status, steps, variables)
VALUES
-- 구현됨
('nav-menu', '메뉴 이동', '좌측 메뉴 트리에서 원하는 화면으로 이동합니다.', '기타', '쉬움', '5초',
 ARRAY['메뉴', '이동', '네비게이션'], '1.0.0', 'system', TRUE, 'active',
 '[{"id":"s1","action":"click","selector":"text={{main_menu}}"},{"id":"s2","action":"wait","timeout":1000},{"id":"s3","action":"click","selector":"text={{sub_menu}}"}]'::JSONB,
 '{"main_menu":{"type":"string","label":"메인 메뉴","required":true},"sub_menu":{"type":"string","label":"서브 메뉴","required":false}}'::JSONB),

('nav-project-select', '사업 선택', '사업 목록에서 특정 사업을 선택합니다.', '기타', '쉬움', '30초',
 ARRAY['사업선택', '목록', '선택'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('common-file-upload', '파일 업로드', '첨부파일을 업로드합니다.', '기타', '쉬움', '1분',
 ARRAY['업로드', '첨부파일', '파일'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('common-file-download', '파일 다운로드', '첨부파일을 다운로드합니다.', '기타', '쉬움', '30초',
 ARRAY['다운로드', '첨부파일', '파일'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB),

('common-print', '화면 출력', '현재 화면을 PDF로 출력합니다.', '기타', '쉬움', '30초',
 ARRAY['출력', 'PDF', '인쇄'], '1.0.0', 'system', FALSE, 'draft', '[]'::JSONB, '{}'::JSONB)

ON CONFLICT (playbook_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    difficulty = EXCLUDED.difficulty,
    keywords = EXCLUDED.keywords,
    updated_at = NOW();

-- =============================================================================
-- 7. 카테고리 정렬 순서 (order_index 설정)
-- =============================================================================

UPDATE playbooks SET order_index = 1 WHERE category = '회원관리';
UPDATE playbooks SET order_index = 2 WHERE category = '사업선정';
UPDATE playbooks SET order_index = 3 WHERE category = '교부관리';
UPDATE playbooks SET order_index = 4 WHERE category = '집행관리';
UPDATE playbooks SET order_index = 5 WHERE category = '정산관리';
UPDATE playbooks SET order_index = 6 WHERE category = '기타';

-- =============================================================================
-- 8. 통계 확인 쿼리 (참조용)
-- =============================================================================
-- SELECT category, COUNT(*) as total,
--        SUM(CASE WHEN is_published THEN 1 ELSE 0 END) as published,
--        SUM(CASE WHEN NOT is_published THEN 1 ELSE 0 END) as draft
-- FROM playbooks
-- GROUP BY category
-- ORDER BY MIN(order_index);
