/**
 * Config Module Entry Point
 * 설정 시스템 재수출
 */

// 타입 및 인터페이스
export type { SiteProfile } from './site-profile';
export { validateProfile } from './site-profile';

// ConfigLoader 클래스 및 싱글톤
export { ConfigLoader, configLoader } from './config-loader';

// 기본값 및 상수
export {
  DEFAULT_PROFILE_ID,
  DEFAULT_PROFILE,
  KOREAN_ENGLISH_MAP,
  KOREAN_STOP_WORDS,
  KOREAN_KEYWORD_SUFFIXES,
  ENGLISH_STOP_WORDS,
  createEmptyProfile,
} from './defaults';
