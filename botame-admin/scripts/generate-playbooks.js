/**
 * 보탬e 플레이북 생성 스크립트
 * Bottom-up 설계 원칙에 따라 Level 1 → 2 → 3 순서로 생성
 */

const SUPABASE_URL = 'https://oagcozlzpfedjnetpjus.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hZ2Nvemx6cGZlZGpuZXRwanVzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDY2MzE2MCwiZXhwIjoyMDgwMjM5MTYwfQ.4mdbeJee6Z2ibrsvjAsrhHhtSyiFdEMA2XmWIDPJGqI';

// ============================================================
// Level 1: 원자적 액션 (Atomic Actions)
// 단일 DOM 조작, 모든 상위 레벨의 기반
// ============================================================
const LEVEL1_ATOMIC_ACTIONS = [
  // === 공통: 네비게이션 ===
  {
    playbook_id: 'atomic-navigate-botame',
    name: '보탬e 접속',
    category: '공통',
    level: 1,
    steps: [
      { id: '1', action: 'navigate', value: 'https://www.losims.go.kr/lss.do', message: '보탬e 업무시스템 접속' }
    ]
  },
  {
    playbook_id: 'atomic-navigate-portal',
    name: '보탬e 포털 접속',
    category: '공통',
    level: 1,
    steps: [
      { id: '1', action: 'navigate', value: 'https://www.losims.go.kr/lfm.do', message: '보탬e 포털 접속' }
    ]
  },

  // === 공통: 로그인 관련 ===
  {
    playbook_id: 'atomic-click-id-login-tab',
    name: '아이디 로그인 탭 클릭',
    category: '공통',
    level: 1,
    steps: [
      { id: '1', action: 'click', selector: 'text=아이디 로그인', message: '아이디 로그인 탭 선택' }
    ]
  },
  {
    playbook_id: 'atomic-type-userid',
    name: '사용자ID 입력',
    category: '공통',
    level: 1,
    steps: [
      { id: '1', action: 'type', selector: 'input[type=text].cl-text', value: '{{user_id}}', message: '사용자 ID 입력' }
    ]
  },
  {
    playbook_id: 'atomic-type-password',
    name: '비밀번호 입력',
    category: '공통',
    level: 1,
    steps: [
      { id: '1', action: 'type', selector: 'input[type=password].cl-text', value: '{{password}}', message: '비밀번호 입력' }
    ]
  },
  {
    playbook_id: 'atomic-click-login-button',
    name: '로그인 버튼 클릭',
    category: '공통',
    level: 1,
    steps: [
      { id: '1', action: 'click', selector: '.btn-login:visible >> text=로그인', message: '로그인 버튼 클릭', wait_for: 'navigation' }
    ]
  },

  // === 공통: 조회/검색 ===
  {
    playbook_id: 'atomic-click-search',
    name: '조회 버튼 클릭',
    category: '공통',
    level: 1,
    steps: [
      { id: '1', action: 'click', selector: 'button:has-text("조회"), .btn-search', message: '조회 버튼 클릭' }
    ]
  },
  {
    playbook_id: 'atomic-click-reset',
    name: '초기화 버튼 클릭',
    category: '공통',
    level: 1,
    steps: [
      { id: '1', action: 'click', selector: 'button:has-text("초기화")', message: '초기화 버튼 클릭' }
    ]
  },
  {
    playbook_id: 'atomic-click-save',
    name: '저장 버튼 클릭',
    category: '공통',
    level: 1,
    steps: [
      { id: '1', action: 'click', selector: 'button:has-text("저장")', message: '저장 버튼 클릭' }
    ]
  },
  {
    playbook_id: 'atomic-click-confirm',
    name: '확인 버튼 클릭',
    category: '공통',
    level: 1,
    steps: [
      { id: '1', action: 'click', selector: 'button:has-text("확인")', message: '확인 버튼 클릭' }
    ]
  },
  {
    playbook_id: 'atomic-click-cancel',
    name: '취소 버튼 클릭',
    category: '공통',
    level: 1,
    steps: [
      { id: '1', action: 'click', selector: 'button:has-text("취소")', message: '취소 버튼 클릭' }
    ]
  },
  {
    playbook_id: 'atomic-click-close',
    name: '닫기 버튼 클릭',
    category: '공통',
    level: 1,
    steps: [
      { id: '1', action: 'click', selector: 'button:has-text("닫기")', message: '닫기 버튼 클릭' }
    ]
  },

  // === 공통: 연도/기간 선택 ===
  {
    playbook_id: 'atomic-select-year',
    name: '회계연도 선택',
    category: '공통',
    level: 1,
    steps: [
      { id: '1', action: 'select', selector: '[aria-label*="연도"], #fiscalYear, select:has-text("연도")', value: '{{year}}', message: '회계연도 선택' }
    ]
  },

  // === 메뉴 이동: 집행관리 ===
  {
    playbook_id: 'atomic-menu-execution',
    name: '집행관리 메뉴 클릭',
    category: '집행관리',
    level: 1,
    steps: [
      { id: '1', action: 'click', selector: 'text=집행관리', message: '집행관리 메뉴 클릭' }
    ]
  },
  {
    playbook_id: 'atomic-submenu-execution-register',
    name: '집행등록 서브메뉴 클릭',
    category: '집행관리',
    level: 1,
    steps: [
      { id: '1', action: 'click', selector: 'a:has-text("집행관리"):not(:has-text("이체"))', message: '집행관리(집행등록) 메뉴 클릭' }
    ]
  },
  {
    playbook_id: 'atomic-submenu-execution-transfer',
    name: '집행이체관리 서브메뉴 클릭',
    category: '집행관리',
    level: 1,
    steps: [
      { id: '1', action: 'click', selector: 'a:has-text("집행이체관리")', message: '집행이체관리 메뉴 클릭' }
    ]
  },
  {
    playbook_id: 'atomic-submenu-tax-invoice',
    name: '전자세금계산서 서브메뉴 클릭',
    category: '집행관리',
    level: 1,
    steps: [
      { id: '1', action: 'click', selector: 'a:has-text("전자(세금)계산서")', message: '전자세금계산서 메뉴 클릭' }
    ]
  },

  // === 집행관리: 집행등록 화면 ===
  {
    playbook_id: 'atomic-click-execution-register',
    name: '집행등록 버튼 클릭',
    category: '집행관리',
    level: 1,
    steps: [
      { id: '1', action: 'click', selector: 'button:has-text("집행등록")', message: '집행등록 버튼 클릭' }
    ]
  },
  {
    playbook_id: 'atomic-click-execution-request',
    name: '집행요청 버튼 클릭',
    category: '집행관리',
    level: 1,
    steps: [
      { id: '1', action: 'click', selector: 'button:has-text("집행요청")', message: '집행요청 버튼 클릭' }
    ]
  },
  {
    playbook_id: 'atomic-click-execution-cancel',
    name: '집행요청취소 버튼 클릭',
    category: '집행관리',
    level: 1,
    steps: [
      { id: '1', action: 'click', selector: 'button:has-text("집행요청취소")', message: '집행요청취소 버튼 클릭' }
    ]
  },
  {
    playbook_id: 'atomic-select-evidence-type',
    name: '증빙유형 선택',
    category: '집행관리',
    level: 1,
    steps: [
      { id: '1', action: 'select', selector: '#evidenceType, [aria-label*="증빙유형"]', value: '{{evidence_type}}', message: '증빙유형 선택 (전자세금계산서/신용카드/체크카드)' }
    ]
  },
  {
    playbook_id: 'atomic-click-view-evidence',
    name: '증빙내역조회 버튼 클릭',
    category: '집행관리',
    level: 1,
    steps: [
      { id: '1', action: 'click', selector: 'button:has-text("증빙내역조회"), button:has-text("내역조회")', message: '증빙내역조회 버튼 클릭' }
    ]
  },
  {
    playbook_id: 'atomic-select-budget-item',
    name: '보조비세목 선택',
    category: '집행관리',
    level: 1,
    steps: [
      { id: '1', action: 'select', selector: '#budgetItem, [aria-label*="보조비세목"]', value: '{{budget_item}}', message: '보조비세목 선택' }
    ]
  },

  // === 집행이체 관련 ===
  {
    playbook_id: 'atomic-click-transfer-request',
    name: '이체요청 버튼 클릭',
    category: '집행관리',
    level: 1,
    steps: [
      { id: '1', action: 'click', selector: 'button:has-text("이체요청"), button:has-text("이체")', message: '이체요청 버튼 클릭' }
    ]
  },
  {
    playbook_id: 'atomic-type-transfer-password',
    name: '이체비밀번호 입력',
    category: '집행관리',
    level: 1,
    steps: [
      { id: '1', action: 'type', selector: '#transferPassword, input[type=password]:visible', value: '{{transfer_password}}', message: '이체비밀번호 입력' }
    ]
  },
  {
    playbook_id: 'atomic-click-select-all',
    name: '전체선택 클릭',
    category: '공통',
    level: 1,
    steps: [
      { id: '1', action: 'click', selector: '.select-all, input[type=checkbox]:first-child', message: '전체선택 체크박스 클릭' }
    ]
  },

  // === 거래처 정보 ===
  {
    playbook_id: 'atomic-type-business-number',
    name: '사업자번호 입력',
    category: '집행관리',
    level: 1,
    steps: [
      { id: '1', action: 'type', selector: '#businessNumber, input[aria-label*="사업자"]', value: '{{business_number}}', message: '사업자번호 입력' }
    ]
  },
  {
    playbook_id: 'atomic-click-verify-business',
    name: '사업자확인 버튼 클릭',
    category: '집행관리',
    level: 1,
    steps: [
      { id: '1', action: 'click', selector: 'button:has-text("사업자확인")', message: '사업자확인 버튼 클릭' }
    ]
  },
  {
    playbook_id: 'atomic-type-account-number',
    name: '계좌번호 입력',
    category: '집행관리',
    level: 1,
    steps: [
      { id: '1', action: 'type', selector: '#accountNumber, input[aria-label*="계좌"]', value: '{{account_number}}', message: '계좌번호 입력' }
    ]
  },
  {
    playbook_id: 'atomic-click-verify-account',
    name: '계좌확인 버튼 클릭',
    category: '집행관리',
    level: 1,
    steps: [
      { id: '1', action: 'click', selector: 'button:has-text("계좌확인"), button:has-text("예금주확인")', message: '계좌(예금주)확인 버튼 클릭' }
    ]
  },

  // === 메뉴 이동: 정산관리 ===
  {
    playbook_id: 'atomic-menu-settlement',
    name: '정산관리 메뉴 클릭',
    category: '정산관리',
    level: 1,
    steps: [
      { id: '1', action: 'click', selector: 'text=정산관리', message: '정산관리 메뉴 클릭' }
    ]
  },
  {
    playbook_id: 'atomic-submenu-execution-close',
    name: '집행마감 서브메뉴 클릭',
    category: '정산관리',
    level: 1,
    steps: [
      { id: '1', action: 'click', selector: 'a:has-text("집행마감")', message: '집행마감 메뉴 클릭' }
    ]
  },
  {
    playbook_id: 'atomic-submenu-settlement-review',
    name: '정산검토 서브메뉴 클릭',
    category: '정산관리',
    level: 1,
    steps: [
      { id: '1', action: 'click', selector: 'a:has-text("정산검토")', message: '정산검토 메뉴 클릭' }
    ]
  },
  {
    playbook_id: 'atomic-submenu-report',
    name: '실적보고서 서브메뉴 클릭',
    category: '정산관리',
    level: 1,
    steps: [
      { id: '1', action: 'click', selector: 'a:has-text("실적보고서")', message: '실적보고서 메뉴 클릭' }
    ]
  },

  // === 정산관리: 버튼 ===
  {
    playbook_id: 'atomic-click-close-execution',
    name: '집행마감 버튼 클릭',
    category: '정산관리',
    level: 1,
    steps: [
      { id: '1', action: 'click', selector: 'button:has-text("집행마감")', message: '집행마감 버튼 클릭' }
    ]
  },
  {
    playbook_id: 'atomic-click-interest-register',
    name: '이자등록 버튼 클릭',
    category: '정산관리',
    level: 1,
    steps: [
      { id: '1', action: 'click', selector: 'button:has-text("이자등록")', message: '이자등록 버튼 클릭' }
    ]
  },

  // === 메뉴 이동: 회원관리 ===
  {
    playbook_id: 'atomic-menu-member',
    name: '회원관리 메뉴 클릭',
    category: '회원관리',
    level: 1,
    steps: [
      { id: '1', action: 'click', selector: 'text=회원관리', message: '회원관리 메뉴 클릭' }
    ]
  },

  // === 메뉴 이동: 사업선정 ===
  {
    playbook_id: 'atomic-menu-project-selection',
    name: '사업선정 메뉴 클릭',
    category: '사업선정',
    level: 1,
    steps: [
      { id: '1', action: 'click', selector: 'text=사업선정', message: '사업선정 메뉴 클릭' }
    ]
  },
  {
    playbook_id: 'atomic-submenu-public-project',
    name: '공모사업조회 서브메뉴 클릭',
    category: '사업선정',
    level: 1,
    steps: [
      { id: '1', action: 'click', selector: 'a:has-text("공모사업조회")', message: '공모사업조회 메뉴 클릭' }
    ]
  },

  // === 메뉴 이동: 교부관리 ===
  {
    playbook_id: 'atomic-menu-grant',
    name: '교부관리 메뉴 클릭',
    category: '교부관리',
    level: 1,
    steps: [
      { id: '1', action: 'click', selector: 'text=교부관리', message: '교부관리 메뉴 클릭' }
    ]
  },

  // === 대기/로딩 ===
  {
    playbook_id: 'atomic-wait-loading',
    name: '로딩 완료 대기',
    category: '공통',
    level: 1,
    steps: [
      { id: '1', action: 'wait', selector: '.loading-complete, .cl-loading:hidden', timeout: 30000, message: '페이지 로딩 완료 대기' }
    ]
  },
  {
    playbook_id: 'atomic-wait-popup',
    name: '팝업 표시 대기',
    category: '공통',
    level: 1,
    steps: [
      { id: '1', action: 'wait', selector: '.popup:visible, .modal:visible, [role=dialog]:visible', timeout: 10000, message: '팝업 표시 대기' }
    ]
  },

  // === 파일 첨부 ===
  {
    playbook_id: 'atomic-click-file-attach',
    name: '파일첨부 버튼 클릭',
    category: '공통',
    level: 1,
    steps: [
      { id: '1', action: 'click', selector: 'button:has-text("첨부"), button:has-text("파일등록")', message: '파일첨부 버튼 클릭' }
    ]
  },

  // === 목록 선택 ===
  {
    playbook_id: 'atomic-click-first-row',
    name: '첫번째 행 선택',
    category: '공통',
    level: 1,
    steps: [
      { id: '1', action: 'click', selector: 'tr:nth-child(1) td, .grid-row:first-child', message: '첫번째 행 선택' }
    ]
  },
  {
    playbook_id: 'atomic-double-click-row',
    name: '행 더블클릭',
    category: '공통',
    level: 1,
    steps: [
      { id: '1', action: 'dblclick', selector: 'tr.selected, .grid-row.selected', message: '선택된 행 더블클릭하여 상세조회' }
    ]
  }
];

// ============================================================
// Level 2: 기능 단위 (Functional Units)
// 원자적 액션의 조합, 재사용 가능한 기능 블록
// ============================================================
const LEVEL2_FUNCTIONS = [
  // === 로그인 ===
  {
    playbook_id: 'func-login',
    name: '로그인',
    category: '회원관리',
    level: 2,
    description: '보탬e 업무시스템에 아이디/비밀번호로 로그인합니다.',
    includes: ['atomic-navigate-botame', 'atomic-click-id-login-tab', 'atomic-type-userid', 'atomic-type-password', 'atomic-click-login-button'],
    steps: [
      { id: '1', action: 'navigate', value: 'https://www.losims.go.kr/lss.do', message: '보탬e 업무시스템 접속' },
      { id: '2', action: 'click', selector: 'text=아이디 로그인', message: '아이디 로그인 탭 선택' },
      { id: '3', action: 'type', selector: 'input[type=text].cl-text', value: '{{user_id}}', message: '사용자 ID 입력' },
      { id: '4', action: 'type', selector: 'input[type=password].cl-text', value: '{{password}}', message: '비밀번호 입력' },
      { id: '5', action: 'click', selector: '.btn-login:visible >> text=로그인', message: '로그인 버튼 클릭', wait_for: 'navigation' }
    ],
    variables: {
      user_id: { type: 'string', label: '사용자 ID', required: true },
      password: { type: 'string', label: '비밀번호', required: true, secret: true }
    }
  },

  // === 메뉴 이동 ===
  {
    playbook_id: 'func-navigate-execution',
    name: '집행관리 화면 이동',
    category: '집행관리',
    level: 2,
    description: '집행관리 > 집행관리 화면으로 이동합니다.',
    includes: ['atomic-menu-execution', 'atomic-submenu-execution-register', 'atomic-wait-loading'],
    steps: [
      { id: '1', action: 'click', selector: 'text=집행관리', message: '집행관리 메뉴 클릭' },
      { id: '2', action: 'click', selector: 'a:has-text("집행관리"):not(:has-text("이체"))', message: '집행관리(집행등록) 서브메뉴 클릭' },
      { id: '3', action: 'wait', selector: '.cl-loading:hidden', timeout: 10000, message: '화면 로딩 대기' }
    ]
  },
  {
    playbook_id: 'func-navigate-transfer',
    name: '집행이체관리 화면 이동',
    category: '집행관리',
    level: 2,
    description: '집행관리 > 집행이체관리 화면으로 이동합니다.',
    includes: ['atomic-menu-execution', 'atomic-submenu-execution-transfer', 'atomic-wait-loading'],
    steps: [
      { id: '1', action: 'click', selector: 'text=집행관리', message: '집행관리 메뉴 클릭' },
      { id: '2', action: 'click', selector: 'a:has-text("집행이체관리")', message: '집행이체관리 서브메뉴 클릭' },
      { id: '3', action: 'wait', selector: '.cl-loading:hidden', timeout: 10000, message: '화면 로딩 대기' }
    ]
  },
  {
    playbook_id: 'func-navigate-tax-invoice',
    name: '전자세금계산서 화면 이동',
    category: '집행관리',
    level: 2,
    description: '집행관리 > 전자세금계산서관리 화면으로 이동합니다.',
    includes: ['atomic-menu-execution', 'atomic-submenu-tax-invoice', 'atomic-wait-loading'],
    steps: [
      { id: '1', action: 'click', selector: 'text=집행관리', message: '집행관리 메뉴 클릭' },
      { id: '2', action: 'click', selector: 'a:has-text("전자(세금)계산서")', message: '전자세금계산서 서브메뉴 클릭' },
      { id: '3', action: 'wait', selector: '.cl-loading:hidden', timeout: 10000, message: '화면 로딩 대기' }
    ]
  },
  {
    playbook_id: 'func-navigate-settlement',
    name: '정산관리 화면 이동',
    category: '정산관리',
    level: 2,
    description: '정산관리 > 집행마감 화면으로 이동합니다.',
    includes: ['atomic-menu-settlement', 'atomic-submenu-execution-close', 'atomic-wait-loading'],
    steps: [
      { id: '1', action: 'click', selector: 'text=정산관리', message: '정산관리 메뉴 클릭' },
      { id: '2', action: 'click', selector: 'a:has-text("집행마감")', message: '집행마감 서브메뉴 클릭' },
      { id: '3', action: 'wait', selector: '.cl-loading:hidden', timeout: 10000, message: '화면 로딩 대기' }
    ]
  },

  // === 조회 기능 ===
  {
    playbook_id: 'func-search-project',
    name: '수행사업 조회',
    category: '공통',
    level: 2,
    description: '회계연도와 수행사업을 선택하여 조회합니다.',
    includes: ['atomic-select-year', 'atomic-click-search', 'atomic-wait-loading'],
    steps: [
      { id: '1', action: 'select', selector: '[aria-label*="연도"], #fiscalYear', value: '{{year}}', message: '회계연도 선택' },
      { id: '2', action: 'click', selector: 'button:has-text("조회")', message: '조회 버튼 클릭' },
      { id: '3', action: 'wait', selector: '.cl-loading:hidden', timeout: 30000, message: '조회 결과 로딩 대기' }
    ],
    variables: {
      year: { type: 'string', label: '회계연도', required: true, default: '2024' }
    }
  },

  // === 집행등록 세부 기능 ===
  {
    playbook_id: 'func-register-execution-tax',
    name: '전자세금계산서 집행등록',
    category: '집행관리',
    level: 2,
    description: '전자세금계산서를 증빙으로 집행등록합니다.',
    steps: [
      { id: '1', action: 'click', selector: 'button:has-text("집행등록")', message: '집행등록 버튼 클릭' },
      { id: '2', action: 'wait', selector: '.execution-form:visible, .modal:visible', timeout: 5000, message: '집행등록 화면 표시 대기' },
      { id: '3', action: 'select', selector: '#evidenceType', value: '전자세금계산서', message: '증빙유형 선택: 전자세금계산서' },
      { id: '4', action: 'click', selector: 'button:has-text("증빙내역조회"), button:has-text("내역조회")', message: '증빙내역조회 버튼 클릭' },
      { id: '5', action: 'wait', selector: '.evidence-list:visible', timeout: 10000, message: '세금계산서 목록 로딩 대기' }
    ]
  },
  {
    playbook_id: 'func-register-execution-card',
    name: '신용카드 집행등록',
    category: '집행관리',
    level: 2,
    description: '신용카드 사용내역을 증빙으로 집행등록합니다.',
    steps: [
      { id: '1', action: 'click', selector: 'button:has-text("집행등록")', message: '집행등록 버튼 클릭' },
      { id: '2', action: 'wait', selector: '.execution-form:visible, .modal:visible', timeout: 5000, message: '집행등록 화면 표시 대기' },
      { id: '3', action: 'select', selector: '#evidenceType', value: '신용카드', message: '증빙유형 선택: 신용카드' },
      { id: '4', action: 'click', selector: 'button:has-text("증빙내역조회"), button:has-text("내역조회")', message: '증빙내역조회 버튼 클릭' },
      { id: '5', action: 'wait', selector: '.evidence-list:visible', timeout: 10000, message: '카드내역 목록 로딩 대기' }
    ]
  },

  // === 거래처/계좌 등록 ===
  {
    playbook_id: 'func-verify-vendor',
    name: '거래처 정보 확인',
    category: '집행관리',
    level: 2,
    description: '사업자번호로 거래처 정보를 확인합니다.',
    includes: ['atomic-type-business-number', 'atomic-click-verify-business'],
    steps: [
      { id: '1', action: 'type', selector: '#businessNumber, input[aria-label*="사업자"]', value: '{{business_number}}', message: '사업자번호 입력' },
      { id: '2', action: 'click', selector: 'button:has-text("사업자확인")', message: '사업자확인 버튼 클릭' },
      { id: '3', action: 'wait', selector: '.vendor-info:visible', timeout: 10000, message: '거래처 정보 조회 대기' }
    ],
    variables: {
      business_number: { type: 'string', label: '사업자번호', required: true }
    }
  },
  {
    playbook_id: 'func-verify-account',
    name: '계좌 정보 확인',
    category: '집행관리',
    level: 2,
    description: '계좌번호로 예금주를 확인합니다.',
    includes: ['atomic-type-account-number', 'atomic-click-verify-account'],
    steps: [
      { id: '1', action: 'type', selector: '#accountNumber, input[aria-label*="계좌"]', value: '{{account_number}}', message: '계좌번호 입력' },
      { id: '2', action: 'click', selector: 'button:has-text("계좌확인"), button:has-text("예금주확인")', message: '계좌(예금주)확인 버튼 클릭' },
      { id: '3', action: 'wait', selector: '.account-info:visible', timeout: 10000, message: '계좌 정보 조회 대기' }
    ],
    variables: {
      account_number: { type: 'string', label: '계좌번호', required: true }
    }
  },

  // === 저장/요청 ===
  {
    playbook_id: 'func-save-and-request',
    name: '저장 후 집행요청',
    category: '집행관리',
    level: 2,
    description: '입력 내용을 저장하고 집행요청합니다.',
    includes: ['atomic-click-save', 'atomic-click-confirm', 'atomic-click-execution-request'],
    steps: [
      { id: '1', action: 'click', selector: 'button:has-text("저장")', message: '저장 버튼 클릭' },
      { id: '2', action: 'wait', selector: '.save-complete:visible, .toast-success:visible', timeout: 10000, message: '저장 완료 대기' },
      { id: '3', action: 'click', selector: 'button:has-text("집행요청")', message: '집행요청 버튼 클릭' },
      { id: '4', action: 'click', selector: 'button:has-text("확인")', message: '확인 버튼 클릭' }
    ]
  },

  // === 이체 ===
  {
    playbook_id: 'func-transfer-batch',
    name: '일괄 이체요청',
    category: '집행관리',
    level: 2,
    description: '선택된 집행건을 일괄 이체요청합니다.',
    includes: ['atomic-click-select-all', 'atomic-type-transfer-password', 'atomic-click-transfer-request'],
    steps: [
      { id: '1', action: 'click', selector: '.select-all, input[type=checkbox]:first-child', message: '전체선택' },
      { id: '2', action: 'type', selector: '#transferPassword, input[type=password]:visible', value: '{{transfer_password}}', message: '이체비밀번호 입력' },
      { id: '3', action: 'click', selector: 'button:has-text("이체요청"), button:has-text("이체")', message: '이체요청 버튼 클릭' },
      { id: '4', action: 'wait', selector: '.certificate-popup:visible', timeout: 30000, message: '인증서 팝업 표시 대기 (수동 인증 필요)' }
    ],
    variables: {
      transfer_password: { type: 'string', label: '이체비밀번호', required: true, secret: true }
    }
  }
];

// ============================================================
// Level 3: 업무 시나리오 (Business Scenarios)
// 기능 단위의 조합, 완전한 업무 플로우
// ============================================================
const LEVEL3_SCENARIOS = [
  {
    playbook_id: 'scenario-tax-invoice-register',
    name: '전자세금계산서 집행등록 시나리오',
    category: '집행관리',
    level: 3,
    description: '로그인부터 전자세금계산서 집행등록까지 전체 과정을 수행합니다.',
    includes: ['func-login', 'func-navigate-execution', 'func-search-project', 'func-register-execution-tax', 'func-save-and-request'],
    aliases: ['세금계산서 처리', '전자세금계산서 집행', '세금계산서 등록', '집행등록 해줘', '세금계산서 정리'],
    steps: [
      // Step 1-5: 로그인
      { id: '1', action: 'navigate', value: 'https://www.losims.go.kr/lss.do', message: '보탬e 업무시스템 접속' },
      { id: '2', action: 'click', selector: 'text=아이디 로그인', message: '아이디 로그인 탭 선택' },
      { id: '3', action: 'type', selector: 'input[type=text].cl-text', value: '{{user_id}}', message: '사용자 ID 입력' },
      { id: '4', action: 'type', selector: 'input[type=password].cl-text', value: '{{password}}', message: '비밀번호 입력' },
      { id: '5', action: 'click', selector: '.btn-login:visible >> text=로그인', message: '로그인 버튼 클릭' },
      // Step 6-8: 메뉴 이동
      { id: '6', action: 'click', selector: 'text=집행관리', message: '집행관리 메뉴 클릭' },
      { id: '7', action: 'click', selector: 'a:has-text("집행관리"):not(:has-text("이체"))', message: '집행관리 서브메뉴 클릭' },
      { id: '8', action: 'wait', selector: '.cl-loading:hidden', timeout: 10000, message: '화면 로딩 대기' },
      // Step 9-11: 사업 조회
      { id: '9', action: 'select', selector: '[aria-label*="연도"], #fiscalYear', value: '{{year}}', message: '회계연도 선택' },
      { id: '10', action: 'click', selector: 'button:has-text("조회")', message: '조회 버튼 클릭' },
      { id: '11', action: 'wait', selector: '.cl-loading:hidden', timeout: 30000, message: '조회 결과 로딩 대기' },
      // Step 12-16: 집행등록
      { id: '12', action: 'click', selector: 'button:has-text("집행등록")', message: '집행등록 버튼 클릭' },
      { id: '13', action: 'select', selector: '#evidenceType', value: '전자세금계산서', message: '증빙유형 선택' },
      { id: '14', action: 'click', selector: 'button:has-text("증빙내역조회")', message: '증빙내역조회 클릭' },
      { id: '15', action: 'guide', message: '등록할 세금계산서를 선택하고 비목/세목을 지정하세요' },
      // Step 17-18: 저장
      { id: '16', action: 'click', selector: 'button:has-text("저장")', message: '저장 버튼 클릭' },
      { id: '17', action: 'click', selector: 'button:has-text("집행요청")', message: '집행요청 버튼 클릭' }
    ],
    variables: {
      user_id: { type: 'string', label: '사용자 ID', required: true },
      password: { type: 'string', label: '비밀번호', required: true, secret: true },
      year: { type: 'string', label: '회계연도', required: true, default: '2024' }
    }
  },
  {
    playbook_id: 'scenario-card-usage-register',
    name: '카드사용내역 집행등록 시나리오',
    category: '집행관리',
    level: 3,
    description: '로그인부터 카드사용내역 집행등록까지 전체 과정을 수행합니다.',
    includes: ['func-login', 'func-navigate-execution', 'func-search-project', 'func-register-execution-card', 'func-save-and-request'],
    aliases: ['카드 집행', '카드사용내역 등록', '카드값 정리', '신용카드 집행', '체크카드 집행'],
    steps: [
      { id: '1', action: 'navigate', value: 'https://www.losims.go.kr/lss.do', message: '보탬e 업무시스템 접속' },
      { id: '2', action: 'click', selector: 'text=아이디 로그인', message: '아이디 로그인 탭 선택' },
      { id: '3', action: 'type', selector: 'input[type=text].cl-text', value: '{{user_id}}', message: '사용자 ID 입력' },
      { id: '4', action: 'type', selector: 'input[type=password].cl-text', value: '{{password}}', message: '비밀번호 입력' },
      { id: '5', action: 'click', selector: '.btn-login:visible >> text=로그인', message: '로그인 버튼 클릭' },
      { id: '6', action: 'click', selector: 'text=집행관리', message: '집행관리 메뉴 클릭' },
      { id: '7', action: 'click', selector: 'a:has-text("집행관리"):not(:has-text("이체"))', message: '집행관리 서브메뉴 클릭' },
      { id: '8', action: 'wait', selector: '.cl-loading:hidden', timeout: 10000, message: '화면 로딩 대기' },
      { id: '9', action: 'select', selector: '[aria-label*="연도"], #fiscalYear', value: '{{year}}', message: '회계연도 선택' },
      { id: '10', action: 'click', selector: 'button:has-text("조회")', message: '조회 버튼 클릭' },
      { id: '11', action: 'click', selector: 'button:has-text("집행등록")', message: '집행등록 버튼 클릭' },
      { id: '12', action: 'select', selector: '#evidenceType', value: '신용카드', message: '증빙유형 선택: 신용카드' },
      { id: '13', action: 'click', selector: 'button:has-text("증빙내역조회")', message: '카드내역조회 클릭' },
      { id: '14', action: 'guide', message: '등록할 카드사용내역을 선택하고 비목/세목을 지정하세요' },
      { id: '15', action: 'click', selector: 'button:has-text("저장")', message: '저장 버튼 클릭' },
      { id: '16', action: 'click', selector: 'button:has-text("집행요청")', message: '집행요청 버튼 클릭' }
    ],
    variables: {
      user_id: { type: 'string', label: '사용자 ID', required: true },
      password: { type: 'string', label: '비밀번호', required: true, secret: true },
      year: { type: 'string', label: '회계연도', required: true, default: '2024' }
    }
  },
  {
    playbook_id: 'scenario-batch-transfer',
    name: '집행이체 일괄처리 시나리오',
    category: '집행관리',
    level: 3,
    description: '로그인 후 대기중인 집행건을 일괄 이체요청합니다. (인증서 인증은 수동)',
    includes: ['func-login', 'func-navigate-transfer', 'func-search-project', 'func-transfer-batch'],
    aliases: ['이체 처리', '집행이체', '일괄이체', '돈 보내기', '이체 해줘'],
    steps: [
      { id: '1', action: 'navigate', value: 'https://www.losims.go.kr/lss.do', message: '보탬e 업무시스템 접속' },
      { id: '2', action: 'click', selector: 'text=아이디 로그인', message: '아이디 로그인 탭 선택' },
      { id: '3', action: 'type', selector: 'input[type=text].cl-text', value: '{{user_id}}', message: '사용자 ID 입력' },
      { id: '4', action: 'type', selector: 'input[type=password].cl-text', value: '{{password}}', message: '비밀번호 입력' },
      { id: '5', action: 'click', selector: '.btn-login:visible >> text=로그인', message: '로그인 버튼 클릭' },
      { id: '6', action: 'click', selector: 'text=집행관리', message: '집행관리 메뉴 클릭' },
      { id: '7', action: 'click', selector: 'a:has-text("집행이체관리")', message: '집행이체관리 메뉴 클릭' },
      { id: '8', action: 'wait', selector: '.cl-loading:hidden', timeout: 10000, message: '화면 로딩 대기' },
      { id: '9', action: 'select', selector: '[aria-label*="연도"], #fiscalYear', value: '{{year}}', message: '회계연도 선택' },
      { id: '10', action: 'click', selector: 'button:has-text("조회")', message: '조회 버튼 클릭' },
      { id: '11', action: 'click', selector: '.select-all', message: '전체선택' },
      { id: '12', action: 'type', selector: '#transferPassword', value: '{{transfer_password}}', message: '이체비밀번호 입력' },
      { id: '13', action: 'click', selector: 'button:has-text("이체요청")', message: '이체요청 버튼 클릭' },
      { id: '14', action: 'guide', message: '인증서 팝업에서 인증서를 선택하고 비밀번호를 입력하세요 (수동)' }
    ],
    variables: {
      user_id: { type: 'string', label: '사용자 ID', required: true },
      password: { type: 'string', label: '비밀번호', required: true, secret: true },
      year: { type: 'string', label: '회계연도', required: true, default: '2024' },
      transfer_password: { type: 'string', label: '이체비밀번호', required: true, secret: true }
    }
  },
  {
    playbook_id: 'scenario-settlement-close',
    name: '집행마감 시나리오',
    category: '정산관리',
    level: 3,
    description: '수행사업의 집행을 마감합니다.',
    includes: ['func-login', 'func-navigate-settlement', 'func-search-project'],
    aliases: ['집행마감', '정산마감', '마감 처리', '집행 마감해줘'],
    steps: [
      { id: '1', action: 'navigate', value: 'https://www.losims.go.kr/lss.do', message: '보탬e 업무시스템 접속' },
      { id: '2', action: 'click', selector: 'text=아이디 로그인', message: '아이디 로그인 탭 선택' },
      { id: '3', action: 'type', selector: 'input[type=text].cl-text', value: '{{user_id}}', message: '사용자 ID 입력' },
      { id: '4', action: 'type', selector: 'input[type=password].cl-text', value: '{{password}}', message: '비밀번호 입력' },
      { id: '5', action: 'click', selector: '.btn-login:visible >> text=로그인', message: '로그인 버튼 클릭' },
      { id: '6', action: 'click', selector: 'text=정산관리', message: '정산관리 메뉴 클릭' },
      { id: '7', action: 'click', selector: 'a:has-text("집행마감")', message: '집행마감 메뉴 클릭' },
      { id: '8', action: 'wait', selector: '.cl-loading:hidden', timeout: 10000, message: '화면 로딩 대기' },
      { id: '9', action: 'select', selector: '[aria-label*="연도"], #fiscalYear', value: '{{year}}', message: '회계연도 선택' },
      { id: '10', action: 'click', selector: 'button:has-text("조회")', message: '조회 버튼 클릭' },
      { id: '11', action: 'guide', message: '마감할 수행사업을 선택하세요' },
      { id: '12', action: 'click', selector: 'button:has-text("집행마감")', message: '집행마감 버튼 클릭' },
      { id: '13', action: 'click', selector: 'button:has-text("확인")', message: '확인 버튼 클릭' }
    ],
    variables: {
      user_id: { type: 'string', label: '사용자 ID', required: true },
      password: { type: 'string', label: '비밀번호', required: true, secret: true },
      year: { type: 'string', label: '회계연도', required: true, default: '2024' }
    }
  }
];

// ============================================================
// 자연어 별칭 (Aliases for LLM)
// ============================================================
const PLAYBOOK_ALIASES = [];

// Level 3 시나리오에서 별칭 추출
LEVEL3_SCENARIOS.forEach(scenario => {
  if (scenario.aliases) {
    scenario.aliases.forEach(alias => {
      PLAYBOOK_ALIASES.push({
        playbook_id: scenario.playbook_id,
        alias: alias,
        language: 'ko'
      });
    });
  }
});

// Level 2 기능에 대한 별칭 추가
const LEVEL2_ALIASES = [
  { playbook_id: 'func-login', alias: '로그인', language: 'ko' },
  { playbook_id: 'func-login', alias: '로그인 해줘', language: 'ko' },
  { playbook_id: 'func-navigate-execution', alias: '집행관리 화면', language: 'ko' },
  { playbook_id: 'func-navigate-transfer', alias: '이체 화면', language: 'ko' },
  { playbook_id: 'func-search-project', alias: '사업 조회', language: 'ko' }
];

PLAYBOOK_ALIASES.push(...LEVEL2_ALIASES);

// ============================================================
// 플레이북 참조 관계
// ============================================================
const PLAYBOOK_REFERENCES = [];

// Level 2 → Level 1 참조
LEVEL2_FUNCTIONS.forEach(func => {
  if (func.includes) {
    func.includes.forEach((childId, idx) => {
      PLAYBOOK_REFERENCES.push({
        parent_playbook_id: func.playbook_id,
        child_playbook_id: childId,
        execution_order: idx + 1
      });
    });
  }
});

// Level 3 → Level 2 참조
LEVEL3_SCENARIOS.forEach(scenario => {
  if (scenario.includes) {
    scenario.includes.forEach((childId, idx) => {
      PLAYBOOK_REFERENCES.push({
        parent_playbook_id: scenario.playbook_id,
        child_playbook_id: childId,
        execution_order: idx + 1
      });
    });
  }
});

// ============================================================
// API 호출 함수
// ============================================================
async function upsertPlaybook(playbook) {
  // 시작 URL 결정: 명시적 start_url이 있으면 사용, 없으면 첫 navigate 스텝에서 추출
  let startUrl = playbook.start_url;
  if (!startUrl && playbook.steps && playbook.steps.length > 0) {
    const firstNav = playbook.steps.find(s => s.action === 'navigate');
    if (firstNav) {
      startUrl = firstNav.value;
    }
  }
  // 기본값: 홈페이지
  if (!startUrl) {
    startUrl = 'https://www.losims.go.kr/lss.do';
  }

  const body = {
    playbook_id: playbook.playbook_id,
    name: playbook.name,
    description: playbook.description || '',
    category: playbook.category,
    level: playbook.level,
    steps: playbook.steps,
    variables: playbook.variables || {},
    status: 'active',
    is_published: true,
    version: '1.0.0',
    start_url: startUrl
  };

  const response = await fetch(`${SUPABASE_URL}/rest/v1/playbooks?on_conflict=playbook_id`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upsert ${playbook.playbook_id}: ${error}`);
  }
  return response;
}

async function insertAlias(alias) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/playbook_aliases`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(alias)
  });

  if (!response.ok && response.status !== 409) { // 409 = 중복
    const error = await response.text();
    console.warn(`Warning: alias insert failed: ${error}`);
  }
  return response;
}

async function insertReference(ref) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/playbook_references`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(ref)
  });

  if (!response.ok && response.status !== 409) {
    const error = await response.text();
    console.warn(`Warning: reference insert failed: ${error}`);
  }
  return response;
}

// ============================================================
// 메인 실행
// ============================================================
async function main() {
  console.log('='.repeat(60));
  console.log('보탬e 플레이북 생성 시작');
  console.log('='.repeat(60));

  // 1. Level 1: 원자적 액션
  console.log(`\n[Level 1] 원자적 액션 ${LEVEL1_ATOMIC_ACTIONS.length}개 업로드...`);
  for (const action of LEVEL1_ATOMIC_ACTIONS) {
    try {
      await upsertPlaybook(action);
      console.log(`  ✓ ${action.playbook_id}`);
    } catch (e) {
      console.error(`  ✗ ${action.playbook_id}: ${e.message}`);
    }
  }

  // 2. Level 2: 기능 단위
  console.log(`\n[Level 2] 기능 단위 ${LEVEL2_FUNCTIONS.length}개 업로드...`);
  for (const func of LEVEL2_FUNCTIONS) {
    try {
      await upsertPlaybook(func);
      console.log(`  ✓ ${func.playbook_id}`);
    } catch (e) {
      console.error(`  ✗ ${func.playbook_id}: ${e.message}`);
    }
  }

  // 3. Level 3: 업무 시나리오
  console.log(`\n[Level 3] 업무 시나리오 ${LEVEL3_SCENARIOS.length}개 업로드...`);
  for (const scenario of LEVEL3_SCENARIOS) {
    try {
      await upsertPlaybook(scenario);
      console.log(`  ✓ ${scenario.playbook_id}`);
    } catch (e) {
      console.error(`  ✗ ${scenario.playbook_id}: ${e.message}`);
    }
  }

  // 4. 별칭 (aliases)
  console.log(`\n[Aliases] 자연어 별칭 ${PLAYBOOK_ALIASES.length}개 업로드...`);
  for (const alias of PLAYBOOK_ALIASES) {
    await insertAlias(alias);
  }
  console.log('  완료');

  // 5. 참조 관계
  console.log(`\n[References] 플레이북 참조 관계 ${PLAYBOOK_REFERENCES.length}개 업로드...`);
  for (const ref of PLAYBOOK_REFERENCES) {
    await insertReference(ref);
  }
  console.log('  완료');

  // 6. 요약
  console.log('\n' + '='.repeat(60));
  console.log('플레이북 생성 완료!');
  console.log('='.repeat(60));
  console.log(`Level 1 (Atomic):   ${LEVEL1_ATOMIC_ACTIONS.length}개`);
  console.log(`Level 2 (Function): ${LEVEL2_FUNCTIONS.length}개`);
  console.log(`Level 3 (Scenario): ${LEVEL3_SCENARIOS.length}개`);
  console.log(`총 플레이북:        ${LEVEL1_ATOMIC_ACTIONS.length + LEVEL2_FUNCTIONS.length + LEVEL3_SCENARIOS.length}개`);
  console.log(`자연어 별칭:        ${PLAYBOOK_ALIASES.length}개`);
  console.log(`참조 관계:          ${PLAYBOOK_REFERENCES.length}개`);
}

main().catch(console.error);
