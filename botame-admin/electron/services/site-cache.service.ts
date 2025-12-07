/**
 * Site Cache Service - Supabase 기반 사이트 요소 캐싱
 *
 * 한 번 분석한 사이트의 요소 선택자를 캐싱하여 재사용
 * 페이지 해시로 변경 감지, 여러 사용자 간 캐시 공유 가능
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Page } from 'playwright';
import { ElementSnapshot, BoundingBox } from '../../shared/types';
import {
  SemanticSelectorResult,
  FallbackSelector,
} from '../core/semantic-selector';
import * as crypto from 'crypto';

export interface CachedSelector {
  selector: string;
  strategy: string;
  confidence: number;
  fallbacks: FallbackSelector[];
  boundingBox?: BoundingBox;
}

export interface PageSnapshot {
  domain: string;
  path: string;
  hash: string;
  elements: CachedElement[];
  createdAt: Date;
}

interface CachedElement {
  elementHash: string;
  selector: string;
  strategy: string;
  elementType: string;
  elementRole?: string;
}

export class SiteCacheService {
  private supabase: SupabaseClient | null = null;
  private localCache: Map<string, CachedSelector> = new Map();
  private pageHashCache: Map<string, string> = new Map();

  constructor(supabaseClient?: SupabaseClient) {
    this.supabase = supabaseClient || null;
    console.log(
      `[SiteCacheService] Initialized ${this.supabase ? 'with Supabase' : 'local-only mode'}`
    );
  }

  /**
   * Supabase 클라이언트 설정
   */
  setSupabaseClient(client: SupabaseClient): void {
    this.supabase = client;
    console.log('[SiteCacheService] Supabase client configured');
  }

  /**
   * 페이지 해시 생성 (DOM 구조 기반)
   */
  async generatePageHash(page: Page): Promise<string> {
    try {
      const domSignature = await page.evaluate(() => {
        // 주요 구조적 요소만 추출하여 해시 생성
        // 폼 요소, 버튼, 링크, role 속성이 있는 요소
        const selectors = 'form, button, input, select, textarea, a[href], [role]';
        const elements = document.querySelectorAll(selectors);

        const signature = Array.from(elements)
          .slice(0, 100) // 최대 100개만
          .map((el) => {
            return [
              el.tagName,
              el.getAttribute('aria-label') || '',
              el.getAttribute('role') || '',
              el.getAttribute('name') || '',
              el.getAttribute('type') || '',
              el.getAttribute('placeholder') || '',
            ].join(':');
          })
          .join('|');

        return signature;
      });

      return this.sha256(domSignature);
    } catch (error) {
      console.error('[SiteCacheService] generatePageHash error:', error);
      return 'unknown';
    }
  }

  /**
   * 요소 해시 생성
   */
  generateElementHash(element: ElementSnapshot): string {
    const hashSource = [
      element.tagName,
      element.attributes['aria-label'] || '',
      element.attributes['role'] || '',
      element.attributes['name'] || '',
      element.attributes['type'] || '',
      element.textContent?.slice(0, 30) || '',
    ].join('|');

    return crypto.createHash('md5').update(hashSource).digest('hex').slice(0, 8);
  }

  /**
   * 캐시에서 요소 선택자 조회
   */
  async getCachedSelector(
    domain: string,
    path: string,
    elementHash: string
  ): Promise<CachedSelector | null> {
    const cacheKey = `${domain}:${path}:${elementHash}`;

    // 1. 로컬 캐시 먼저 확인
    const localCached = this.localCache.get(cacheKey);
    if (localCached) {
      console.log(`[SiteCacheService] Local cache hit: ${cacheKey}`);
      return localCached;
    }

    // 2. Supabase 캐시 확인
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('site_element_cache')
          .select('*')
          .eq('site_domain', domain)
          .eq('page_path', path)
          .eq('element_hash', elementHash)
          .single();

        if (error) {
          if (error.code !== 'PGRST116') {
            // PGRST116 = not found
            console.error('[SiteCacheService] Supabase query error:', error);
          }
          return null;
        }

        if (data) {
          const cached: CachedSelector = {
            selector: data.primary_selector,
            strategy: data.selector_strategy,
            confidence: data.confidence || 90,
            fallbacks: data.fallback_selectors || [],
            boundingBox: data.bounding_box,
          };

          // 로컬 캐시에 저장
          this.localCache.set(cacheKey, cached);

          // 사용 횟수 증가 (비동기, 실패 무시)
          void this.supabase
            .from('site_element_cache')
            .update({
              hit_count: (data.hit_count || 0) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq('id', data.id);

          console.log(`[SiteCacheService] Supabase cache hit: ${cacheKey}`);
          return cached;
        }
      } catch (error) {
        console.error('[SiteCacheService] getCachedSelector error:', error);
      }
    }

    return null;
  }

  /**
   * 선택자 캐시 저장
   */
  async cacheSelector(
    domain: string,
    path: string,
    pageHash: string,
    element: ElementSnapshot,
    selectorResult: SemanticSelectorResult
  ): Promise<void> {
    const elementHash =
      selectorResult.elementHash || this.generateElementHash(element);
    const cacheKey = `${domain}:${path}:${elementHash}`;

    const cached: CachedSelector = {
      selector: selectorResult.selector,
      strategy: selectorResult.strategy,
      confidence: selectorResult.confidence,
      fallbacks: selectorResult.fallbacks,
      boundingBox: element.boundingBox,
    };

    // 로컬 캐시 저장
    this.localCache.set(cacheKey, cached);

    // Supabase 저장 (선택적)
    if (this.supabase && selectorResult.isUnique) {
      try {
        await this.supabase.from('site_element_cache').upsert(
          {
            site_domain: domain,
            page_path: path,
            page_hash: pageHash,
            element_hash: elementHash,
            primary_selector: selectorResult.selector,
            selector_strategy: selectorResult.strategy,
            confidence: selectorResult.confidence,
            fallback_selectors: selectorResult.fallbacks,
            element_type: element.tagName.toLowerCase(),
            element_role: element.role,
            bounding_box: element.boundingBox,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'site_domain,page_path,element_hash',
          }
        );

        console.log(`[SiteCacheService] Cached to Supabase: ${cacheKey}`);
      } catch (error) {
        console.error('[SiteCacheService] Supabase cache error:', error);
      }
    }
  }

  /**
   * 페이지 해시 변경 확인
   */
  async isPageChanged(
    domain: string,
    path: string,
    currentHash: string
  ): Promise<boolean> {
    const cacheKey = `${domain}:${path}`;

    // 로컬 캐시 확인
    const cachedHash = this.pageHashCache.get(cacheKey);
    if (cachedHash) {
      const changed = cachedHash !== currentHash;
      if (changed) {
        console.log(`[SiteCacheService] Page changed (local): ${cacheKey}`);
      }
      return changed;
    }

    // Supabase 확인
    if (this.supabase) {
      try {
        const { data } = await this.supabase
          .from('page_snapshots')
          .select('page_hash')
          .eq('site_domain', domain)
          .eq('page_path', path)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (data) {
          this.pageHashCache.set(cacheKey, data.page_hash);
          const changed = data.page_hash !== currentHash;
          if (changed) {
            console.log(`[SiteCacheService] Page changed (Supabase): ${cacheKey}`);
          }
          return changed;
        }
      } catch (error) {
        // 캐시 없음 = 첫 방문
      }
    }

    // 캐시 없으면 변경된 것으로 간주 (첫 방문)
    this.pageHashCache.set(cacheKey, currentHash);
    return true;
  }

  /**
   * 페이지 스냅샷 저장
   */
  async savePageSnapshot(
    domain: string,
    path: string,
    pageHash: string,
    elements?: CachedElement[]
  ): Promise<void> {
    const cacheKey = `${domain}:${path}`;
    this.pageHashCache.set(cacheKey, pageHash);

    if (this.supabase) {
      try {
        await this.supabase.from('page_snapshots').upsert(
          {
            site_domain: domain,
            page_path: path,
            page_hash: pageHash,
            interactive_elements: elements,
            created_at: new Date().toISOString(),
          },
          {
            onConflict: 'site_domain,page_path,page_hash',
          }
        );

        console.log(`[SiteCacheService] Page snapshot saved: ${cacheKey}`);
      } catch (error) {
        console.error('[SiteCacheService] savePageSnapshot error:', error);
      }
    }
  }

  /**
   * 선택자 성공/실패 기록
   */
  async recordSelectorResult(
    domain: string,
    path: string,
    elementHash: string,
    success: boolean
  ): Promise<void> {
    if (!this.supabase) return;

    try {
      // 현재 통계 가져오기
      const { data } = await this.supabase
        .from('site_element_cache')
        .select('hit_count, success_rate')
        .eq('site_domain', domain)
        .eq('page_path', path)
        .eq('element_hash', elementHash)
        .single();

      if (data) {
        // 성공률 업데이트 (지수 이동 평균)
        const alpha = 0.1; // 학습률
        const newRate = success
          ? data.success_rate + alpha * (100 - data.success_rate)
          : data.success_rate - alpha * data.success_rate;

        await this.supabase
          .from('site_element_cache')
          .update({
            success_rate: Math.max(0, Math.min(100, newRate)),
            hit_count: (data.hit_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('site_domain', domain)
          .eq('page_path', path)
          .eq('element_hash', elementHash);
      }
    } catch (error) {
      console.error('[SiteCacheService] recordSelectorResult error:', error);
    }
  }

  /**
   * 도메인의 모든 캐시 조회
   */
  async getCachedSelectorsForDomain(
    domain: string
  ): Promise<Map<string, CachedSelector>> {
    const result = new Map<string, CachedSelector>();

    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('site_element_cache')
          .select('*')
          .eq('site_domain', domain)
          .order('hit_count', { ascending: false })
          .limit(500);

        if (!error && data) {
          for (const row of data) {
            const key = `${row.page_path}:${row.element_hash}`;
            result.set(key, {
              selector: row.primary_selector,
              strategy: row.selector_strategy,
              confidence: row.confidence || 90,
              fallbacks: row.fallback_selectors || [],
              boundingBox: row.bounding_box,
            });
          }
        }
      } catch (error) {
        console.error('[SiteCacheService] getCachedSelectorsForDomain error:', error);
      }
    }

    return result;
  }

  /**
   * 캐시 무효화 (페이지 변경 시)
   */
  async invalidateCache(domain: string, path?: string): Promise<void> {
    // 로컬 캐시 삭제
    const prefix = path ? `${domain}:${path}:` : `${domain}:`;
    for (const key of this.localCache.keys()) {
      if (key.startsWith(prefix)) {
        this.localCache.delete(key);
      }
    }

    const hashPrefix = path ? `${domain}:${path}` : domain;
    for (const key of this.pageHashCache.keys()) {
      if (key.startsWith(hashPrefix)) {
        this.pageHashCache.delete(key);
      }
    }

    console.log(`[SiteCacheService] Cache invalidated: ${prefix}`);
  }

  /**
   * SHA256 해시 생성
   */
  private sha256(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
  }

  /**
   * 캐시 통계
   */
  getStats(): { localCacheSize: number; pageHashCacheSize: number } {
    return {
      localCacheSize: this.localCache.size,
      pageHashCacheSize: this.pageHashCache.size,
    };
  }
}
