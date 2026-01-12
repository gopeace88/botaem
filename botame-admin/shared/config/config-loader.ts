/**
 * Config Loader
 * 사이트 프로필 로딩 및 관리
 */

import * as fs from 'fs';
import * as path from 'path';
import { SiteProfile, validateProfile } from './site-profile';
import { DEFAULT_PROFILE, DEFAULT_PROFILE_ID } from './defaults';

export class ConfigLoader {
  private profiles: Map<string, SiteProfile> = new Map();
  private activeProfileId: string = DEFAULT_PROFILE_ID;
  private profilesDir: string = '';

  constructor() {
    // 기본 프로필 등록
    this.registerProfile(DEFAULT_PROFILE);
  }

  /**
   * 프로필 디렉토리 설정 및 JSON 파일 로드
   */
  async initialize(profilesDir?: string): Promise<void> {
    if (profilesDir) {
      this.profilesDir = profilesDir;
      await this.loadProfilesFromDir(profilesDir);
    }
  }

  /**
   * 디렉토리에서 모든 프로필 JSON 파일 로드
   */
  private async loadProfilesFromDir(dir: string): Promise<void> {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        return;
      }

      const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

      for (const file of files) {
        try {
          const filePath = path.join(dir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const profile = JSON.parse(content) as SiteProfile;

          const errors = validateProfile(profile);
          if (errors.length === 0) {
            this.registerProfile(profile);
            console.log(`[ConfigLoader] 프로필 로드: ${profile.id}`);
          } else {
            console.warn(`[ConfigLoader] 프로필 검증 실패 (${file}):`, errors);
          }
        } catch (err) {
          console.error(`[ConfigLoader] 프로필 파싱 실패 (${file}):`, err);
        }
      }
    } catch (err) {
      console.error('[ConfigLoader] 프로필 디렉토리 로드 실패:', err);
    }
  }

  /**
   * 프로필 등록
   */
  registerProfile(profile: SiteProfile): void {
    this.profiles.set(profile.id, profile);
  }

  /**
   * 프로필 삭제
   */
  unregisterProfile(profileId: string): boolean {
    if (profileId === DEFAULT_PROFILE_ID) {
      console.warn('[ConfigLoader] 기본 프로필은 삭제할 수 없습니다');
      return false;
    }
    return this.profiles.delete(profileId);
  }

  /**
   * 활성 프로필 설정
   */
  setActiveProfile(profileId: string): boolean {
    if (this.profiles.has(profileId)) {
      this.activeProfileId = profileId;
      return true;
    }
    console.warn(`[ConfigLoader] 프로필을 찾을 수 없음: ${profileId}`);
    return false;
  }

  /**
   * 활성 프로필 반환
   */
  getActiveProfile(): SiteProfile {
    return this.profiles.get(this.activeProfileId) || DEFAULT_PROFILE;
  }

  /**
   * 프로필 ID로 조회
   */
  getProfile(profileId: string): SiteProfile | undefined {
    return this.profiles.get(profileId);
  }

  /**
   * 모든 프로필 목록
   */
  listProfiles(): SiteProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * 활성 프로필 ID 반환
   */
  getActiveProfileId(): string {
    return this.activeProfileId;
  }

  // === 편의 메서드 ===

  /**
   * URL 조회 (환경변수 우선)
   */
  getUrl(key: 'home' | 'login'): string {
    // 환경변수가 있으면 우선 사용 (하위 호환성)
    if (key === 'home' && process.env.VITE_BOTAME_URL) {
      return process.env.VITE_BOTAME_URL;
    }

    const profile = this.getActiveProfile();
    if (key === 'login') {
      return profile.urls.login || profile.urls.home;
    }
    return profile.urls.home;
  }

  /**
   * 셀렉터 설정 조회
   */
  getSelectorConfig(): SiteProfile['selectorConfig'] {
    return this.getActiveProfile().selectorConfig;
  }

  /**
   * AI 프롬프트 설정 조회
   */
  getAiPrompt(): SiteProfile['aiPrompt'] | undefined {
    return this.getActiveProfile().aiPrompt;
  }

  /**
   * 카테고리 목록 조회
   */
  getCategories(): string[] {
    return this.getActiveProfile().categories;
  }

  /**
   * 로케일 조회
   */
  getLocale(): string {
    return this.getActiveProfile().locale.primary;
  }

  /**
   * 인증 설정 조회
   */
  getAuthConfig(): SiteProfile['auth'] | undefined {
    return this.getActiveProfile().auth;
  }

  /**
   * 브라우저 설정 조회
   */
  getBrowserConfig(): SiteProfile['browser'] | undefined {
    return this.getActiveProfile().browser;
  }

  /**
   * 프로필을 JSON 파일로 저장
   */
  async saveProfile(profile: SiteProfile): Promise<boolean> {
    if (!this.profilesDir) {
      console.warn('[ConfigLoader] 프로필 디렉토리가 설정되지 않음');
      return false;
    }

    const errors = validateProfile(profile);
    if (errors.length > 0) {
      console.error('[ConfigLoader] 프로필 검증 실패:', errors);
      return false;
    }

    try {
      const filePath = path.join(this.profilesDir, `${profile.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(profile, null, 2), 'utf-8');
      this.registerProfile(profile);
      return true;
    } catch (err) {
      console.error('[ConfigLoader] 프로필 저장 실패:', err);
      return false;
    }
  }
}

// 싱글톤 인스턴스
export const configLoader = new ConfigLoader();
