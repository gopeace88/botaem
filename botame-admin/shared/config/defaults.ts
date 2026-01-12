/**
 * Default Profile Configuration
 * 보탬e(losims) 기본 프로필 - 하위 호환성 보장
 */

import { SiteProfile } from './site-profile';

export const DEFAULT_PROFILE_ID = 'losims';

/**
 * 한글/영문 변환 맵 (보탬e 특화)
 */
export const KOREAN_ENGLISH_MAP: Record<string, string[]> = {
  // 공통 UI 요소
  '로그인': ['Login', 'Sign in', 'Sign-in'],
  '로그아웃': ['Logout', 'Sign out', 'Sign-out'],
  '검색': ['Search', 'Find'],
  '조회': ['Search', 'View', 'Inquiry', 'Query'],
  '등록': ['Register', 'Add', 'Create', 'New'],
  '수정': ['Edit', 'Update', 'Modify'],
  '삭제': ['Delete', 'Remove'],
  '저장': ['Save', 'Submit'],
  '취소': ['Cancel'],
  '확인': ['OK', 'Confirm', 'Yes'],
  '닫기': ['Close'],
  '목록': ['List'],
  '이전': ['Previous', 'Back', 'Prev'],
  '다음': ['Next', 'Forward'],
  '완료': ['Complete', 'Done', 'Finish'],
  '선택': ['Select', 'Choose'],
  '적용': ['Apply'],
  '초기화': ['Reset', 'Initialize', 'Clear'],

  // 보탬e 도메인 용어
  '교부관리': ['Grant Management', 'Disbursement Management'],
  '집행관리': ['Execution Management', 'Expenditure Management'],
  '정산관리': ['Settlement Management', 'Closing Management'],
  '사업관리': ['Project Management', 'Business Management'],
  '사업선정': ['Project Selection', 'Business Selection'],
  '회원관리': ['Member Management', 'User Management'],

  // 집행 관련
  '집행등록': ['Expense Registration', 'Expenditure Entry'],
  '집행이체': ['Execution Transfer', 'Fund Transfer'],
  '집행마감': ['Execution Closing', 'Period Closing'],
  '이체요청': ['Transfer Request'],
  '이체비밀번호': ['Transfer Password', 'Transaction PIN'],

  // 증빙 관련
  '전자세금계산서': ['Electronic Tax Invoice', 'E-Tax Invoice'],
  '신용카드': ['Credit Card'],
  '증빙': ['Evidence', 'Proof', 'Documentation'],
  '증빙유형': ['Evidence Type', 'Document Type'],

  // 기타
  '보조비세목': ['Subsidy Item', 'Expense Category'],
  '회계연도': ['Fiscal Year', 'Accounting Year'],
  '거래처': ['Vendor', 'Supplier', 'Business Partner'],
  '첨부파일': ['Attachment', 'Attached File'],
};

/**
 * 한국어 정지 단어 (키워드 추출 시 제외)
 */
export const KOREAN_STOP_WORDS: string[] = [
  '클릭', '입력', '선택', '메뉴', '버튼', '필드',
  '링크', '탭', '이동', '완료', '대기', '확인',
  '팝업', '창', '화면', '페이지', '폼', '항목',
];

/**
 * 한국어 키워드 접미사 (제거 대상)
 */
export const KOREAN_KEYWORD_SUFFIXES: string[] = [
  '으로', '에서', '까지', '부터', '에게', '에',
  '을', '를', '이', '가', '은', '는', '과', '와',
];

/**
 * 보탬e(losims) 기본 프로필
 */
export const DEFAULT_PROFILE: SiteProfile = {
  id: DEFAULT_PROFILE_ID,
  name: '보탬e (지방보조금시스템)',
  description: '한국 지방자치단체 보조금 관리 시스템',

  urls: {
    home: 'https://www.losims.go.kr/lss.do',
    login: 'https://www.losims.go.kr/lss.do',
  },

  locale: {
    primary: 'ko',
    fallback: 'en',
  },

  selectorConfig: {
    stopWords: KOREAN_STOP_WORDS,
    keywordSuffixes: KOREAN_KEYWORD_SUFFIXES,
    translationMap: KOREAN_ENGLISH_MAP,
  },

  aiPrompt: {
    siteContext: '한국 정부 보조금 관리 시스템 (보탬e). 한국어 UI를 사용하며, aria-label과 텍스트 기반 셀렉터가 안정적입니다.',
    selectorPriority: [
      'aria-label',
      'role',
      'text',
      'data-testid',
      'name',
      'placeholder',
    ],
  },

  categories: [
    '교부관리',
    '집행관리',
    '정산관리',
    '사업관리',
    '기타',
  ],

  auth: {
    type: 'form',
    formSelectors: {
      tabSelector: '[role="tab"]:has-text("아이디 로그인")',
      usernameField: 'input[aria-label="로그인 ID"]',
      passwordField: 'input[type="password"]',
      submitButton: 'a[role="button"][aria-label="로그인 버튼"]',
    },
  },

  browser: {
    timeout: 30000,
  },
};

/**
 * 영어 정지 단어 (참고용)
 */
export const ENGLISH_STOP_WORDS: string[] = [
  'click', 'input', 'select', 'menu', 'button', 'field',
  'link', 'tab', 'navigate', 'complete', 'wait', 'confirm',
  'popup', 'window', 'screen', 'page', 'form', 'item',
];

/**
 * 빈 프로필 템플릿 생성
 */
export function createEmptyProfile(id: string, name: string): SiteProfile {
  return {
    id,
    name,
    urls: {
      home: '',
    },
    locale: {
      primary: 'en',
    },
    selectorConfig: {
      stopWords: ENGLISH_STOP_WORDS,
      keywordSuffixes: [],
    },
    categories: ['General'],
  };
}
