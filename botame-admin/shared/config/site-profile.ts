/**
 * Site Profile Schema
 * 사이트별 설정을 정의하는 인터페이스
 */

export interface SiteProfile {
  /** 프로필 고유 ID (예: 'losims', 'my-app') */
  id: string;

  /** 표시 이름 */
  name: string;

  /** 설명 (선택) */
  description?: string;

  /** URL 설정 */
  urls: {
    /** 기본 시작 URL */
    home: string;
    /** 로그인 페이지 URL (다를 경우) */
    login?: string;
  };

  /** 언어 설정 */
  locale: {
    /** 기본 언어 */
    primary: 'ko' | 'en' | 'ja' | string;
    /** 폴백 언어 (선택) */
    fallback?: string;
  };

  /** 셀렉터 설정 */
  selectorConfig: {
    /** 동적 텍스트 탐색 시 제외할 단어 (예: ['클릭', '버튼']) */
    stopWords: string[];
    /** 키워드 추출 시 제거할 접미사 (예: ['으로', '에서']) */
    keywordSuffixes: string[];
    /** 텍스트 변환 맵 (예: { '로그인': ['Login', 'Sign in'] }) */
    translationMap?: Record<string, string[]>;
  };

  /** AI 프롬프트 설정 (선택) */
  aiPrompt?: {
    /** 사이트 컨텍스트 설명 (예: "한국 정부 보조금 관리 시스템") */
    siteContext?: string;
    /** 셀렉터 우선순위 힌트 (선택) */
    selectorPriority?: string[];
  };

  /** 플레이북 카테고리 목록 */
  categories: string[];

  /** 인증 설정 (선택) */
  auth?: {
    type: 'none' | 'form' | 'oauth' | 'certificate';
    formSelectors?: {
      usernameField?: string;
      passwordField?: string;
      submitButton?: string;
      tabSelector?: string;
    };
  };

  /** 브라우저 설정 (선택) */
  browser?: {
    viewport?: { width: number; height: number };
    userAgent?: string;
    timeout?: number;
  };
}

/**
 * 프로필 유효성 검사
 */
export function validateProfile(profile: Partial<SiteProfile>): string[] {
  const errors: string[] = [];

  if (!profile.id) errors.push('id는 필수입니다');
  if (!profile.name) errors.push('name은 필수입니다');
  if (!profile.urls?.home) errors.push('urls.home은 필수입니다');
  if (!profile.locale?.primary) errors.push('locale.primary는 필수입니다');
  if (!profile.selectorConfig?.stopWords) errors.push('selectorConfig.stopWords는 필수입니다');
  if (!profile.categories || profile.categories.length === 0) {
    errors.push('categories는 최소 1개 이상 필요합니다');
  }

  return errors;
}
