/**
 * Playbook Sync Service
 *
 * DB(Supabase)에서 플레이북을 동기화하는 서비스
 * - 원본은 항상 DB에 있음
 * - 사용자는 DB에서 플레이북을 동기화하여 사용
 * - 오프라인 지원을 위해 로컬 캐시 유지
 *
 * v2: Partial Update 전략
 * - 전체 동기화 대신 변경된 플레이북만 선별 업데이트
 * - 플레이북 로딩 시점에 해당 플레이북만 체크 (Lazy Sync)
 * - updated_at, checksum 기반 변경 감지
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { supabaseService } from './supabase.service';
import { Playbook, PlaybookMetadata } from '../playbook/types';

// DB에서 받아오는 플레이북 형태
interface DBPlaybook {
  id: string;
  playbook_id: string;
  name: string;
  description?: string;
  category: string;
  difficulty: string;
  estimated_time?: string;
  keywords?: string[];
  version: string;
  author?: string;
  steps: unknown[];
  variables?: Record<string, unknown>;
  preconditions?: unknown[];
  error_handlers?: unknown[];
  metadata?: Record<string, unknown>;
  checksum: string;
  updated_at: string;
}

// 플레이북 메타 정보 (목록용, 경량)
interface PlaybookMeta {
  id: string;
  playbook_id: string;
  name: string;
  description?: string;
  category: string;
  difficulty: string;
  version: string;
  keywords?: string[];
  checksum: string;
  updated_at: string;
  success_rate: number;
}

// 캐시 인덱스 항목
interface CacheIndexEntry {
  version: string;
  checksum: string;
  updatedAt: string;  // DB의 updated_at
  cachedAt: string;   // 로컬 캐시 시점
}

// 동기화 상태
export interface SyncStatus {
  playbook_id: string;
  name: string;
  current_version: string;
  synced_version: string | null;
  status: 'synced' | 'update_available' | 'not_synced';
  needs_update: boolean;
  remote_updated_at?: string;
  local_cached_at?: string;
}

// 동기화 결과
export interface SyncResult {
  success: boolean;
  message: string;
  playbook?: Playbook;
  was_updated?: boolean;  // 실제로 업데이트되었는지
  error?: string;
}

// 전체 동기화 결과
export interface BulkSyncResult {
  success: boolean;
  message: string;
  synced: number;
  skipped: number;  // 이미 최신이라 스킵
  failed: number;
  errors: string[];
}

export class PlaybookSyncService {
  private cacheDir: string;
  private cacheIndexPath: string;
  private cacheIndex: Map<string, CacheIndexEntry>;

  // 원격 메타 캐시 (매번 DB 조회 방지)
  private remoteMetaCache: Map<string, PlaybookMeta> | null = null;
  private remoteMetaCacheTime: number = 0;
  private readonly REMOTE_META_CACHE_TTL = 5 * 60 * 1000; // 5분

  constructor() {
    this.cacheDir = path.join(app.getPath('userData'), 'playbook-cache');
    this.cacheIndexPath = path.join(this.cacheDir, '_index.json');
    this.cacheIndex = new Map();
    this.initializeCache();
  }

  /**
   * 캐시 디렉토리 초기화
   */
  private initializeCache(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    if (fs.existsSync(this.cacheIndexPath)) {
      try {
        const indexData = JSON.parse(fs.readFileSync(this.cacheIndexPath, 'utf-8'));
        this.cacheIndex = new Map(Object.entries(indexData));
      } catch (error) {
        console.error('[PlaybookSync] Failed to load cache index:', error);
        this.cacheIndex = new Map();
      }
    }
  }

  /**
   * 캐시 인덱스 저장
   */
  private saveCacheIndex(): void {
    try {
      const indexData = Object.fromEntries(this.cacheIndex);
      fs.writeFileSync(this.cacheIndexPath, JSON.stringify(indexData, null, 2));
    } catch (error) {
      console.error('[PlaybookSync] Failed to save cache index:', error);
    }
  }

  /**
   * 원격 메타 캐시 갱신 (TTL 기반)
   */
  private async refreshRemoteMetaCache(): Promise<boolean> {
    const now = Date.now();
    if (this.remoteMetaCache && now - this.remoteMetaCacheTime < this.REMOTE_META_CACHE_TTL) {
      return true; // 캐시 유효
    }

    if (!supabaseService.isInitialized()) {
      return false;
    }

    try {
      const { data, error } = await (supabaseService as any).client
        .from('published_playbooks')
        .select('id, playbook_id, name, description, category, difficulty, version, keywords, checksum, updated_at, success_rate');

      if (error) {
        console.error('[PlaybookSync] Failed to fetch remote meta:', error);
        return false;
      }

      this.remoteMetaCache = new Map();
      for (const item of data || []) {
        this.remoteMetaCache.set(item.playbook_id, item);
      }
      this.remoteMetaCacheTime = now;

      console.log(`[PlaybookSync] Remote meta cache refreshed: ${this.remoteMetaCache.size} playbooks`);
      return true;
    } catch (error) {
      console.error('[PlaybookSync] Error refreshing remote meta:', error);
      return false;
    }
  }

  /**
   * 공개된 플레이북 목록 조회 (메타 정보만)
   */
  async getPublishedPlaybooks(): Promise<{
    success: boolean;
    playbooks?: PlaybookMeta[];
    error?: string;
  }> {
    const refreshed = await this.refreshRemoteMetaCache();
    if (!refreshed || !this.remoteMetaCache) {
      return { success: false, error: 'Supabase 연결 실패 또는 초기화되지 않음' };
    }

    return {
      success: true,
      playbooks: Array.from(this.remoteMetaCache.values()),
    };
  }

  /**
   * 단일 플레이북 업데이트 필요 여부 확인
   */
  async needsUpdate(playbookId: string): Promise<{ needs: boolean; reason?: string }> {
    const cached = this.cacheIndex.get(playbookId);

    if (!cached) {
      return { needs: true, reason: 'not_cached' };
    }

    await this.refreshRemoteMetaCache();
    const remoteMeta = this.remoteMetaCache?.get(playbookId);

    if (!remoteMeta) {
      // 원격에 없음 (삭제됨?)
      return { needs: false, reason: 'not_in_remote' };
    }

    // checksum 비교 (가장 정확)
    if (cached.checksum !== remoteMeta.checksum) {
      return { needs: true, reason: 'checksum_mismatch' };
    }

    // updated_at 비교 (백업)
    if (cached.updatedAt !== remoteMeta.updated_at) {
      return { needs: true, reason: 'updated_at_mismatch' };
    }

    return { needs: false };
  }

  /**
   * 플레이북 로드 (Lazy Sync)
   * - 캐시가 최신이면 캐시에서 로드
   * - 업데이트 필요하면 DB에서 동기화 후 로드
   */
  async loadPlaybook(playbookId: string, forceSync = false): Promise<SyncResult> {
    // 강제 동기화가 아니면 업데이트 필요 여부 확인
    if (!forceSync) {
      const updateCheck = await this.needsUpdate(playbookId);

      if (!updateCheck.needs) {
        // 캐시에서 로드
        const cached = await this.getCachedPlaybook(playbookId);
        if (cached) {
          console.log(`[PlaybookSync] Loaded from cache: ${playbookId}`);
          return {
            success: true,
            message: '캐시에서 로드됨',
            playbook: cached,
            was_updated: false,
          };
        }
      }

      console.log(`[PlaybookSync] Update needed for ${playbookId}: ${updateCheck.reason}`);
    }

    // DB에서 동기화
    return await this.syncPlaybook(playbookId);
  }

  /**
   * 단일 플레이북 동기화 (DB에서 가져와서 캐시)
   */
  async syncPlaybook(playbookId: string): Promise<SyncResult> {
    if (!supabaseService.isInitialized()) {
      // 오프라인 모드: 캐시에서 로드 시도
      const cached = await this.getCachedPlaybook(playbookId);
      if (cached) {
        return {
          success: true,
          message: '오프라인 모드: 캐시에서 로드됨',
          playbook: cached,
          was_updated: false,
        };
      }
      return { success: false, message: 'Supabase 연결 필요' };
    }

    try {
      const { data, error } = await (supabaseService as any).client
        .rpc('get_playbook_for_sync', { p_playbook_id: playbookId });

      if (error) {
        console.error('[PlaybookSync] RPC error:', error);
        return { success: false, message: `동기화 실패: ${error.message}` };
      }

      if (!data?.success) {
        return { success: false, message: data?.error || '플레이북을 찾을 수 없습니다' };
      }

      const dbPlaybook: DBPlaybook = data.playbook;
      const playbook = this.convertDBToPlaybook(dbPlaybook);

      // 캐시 저장
      await this.cachePlaybook(playbookId, playbook, dbPlaybook.checksum, dbPlaybook.updated_at);

      console.log(`[PlaybookSync] Synced: ${playbookId} v${dbPlaybook.version}`);

      return {
        success: true,
        message: `${playbook.metadata.name} 동기화 완료`,
        playbook,
        was_updated: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류';
      return { success: false, message: `동기화 오류: ${message}` };
    }
  }

  /**
   * 변경된 플레이북만 동기화 (Partial Sync)
   */
  async syncUpdatedPlaybooks(): Promise<BulkSyncResult> {
    const result: BulkSyncResult = {
      success: false,
      message: '',
      synced: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    const listResult = await this.getPublishedPlaybooks();
    if (!listResult.success || !listResult.playbooks) {
      return {
        ...result,
        message: listResult.error || '플레이북 목록을 가져올 수 없습니다',
      };
    }

    for (const pb of listResult.playbooks) {
      const updateCheck = await this.needsUpdate(pb.playbook_id);

      if (!updateCheck.needs) {
        result.skipped++;
        continue;
      }

      const syncResult = await this.syncPlaybook(pb.playbook_id);
      if (syncResult.success) {
        result.synced++;
      } else {
        result.failed++;
        result.errors.push(`${pb.name}: ${syncResult.message}`);
      }
    }

    result.success = result.failed === 0;
    result.message = `${result.synced}개 업데이트, ${result.skipped}개 최신, ${result.failed}개 실패`;

    return result;
  }

  /**
   * 모든 플레이북 강제 동기화
   */
  async syncAllPlaybooks(): Promise<BulkSyncResult> {
    const result: BulkSyncResult = {
      success: false,
      message: '',
      synced: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    const listResult = await this.getPublishedPlaybooks();
    if (!listResult.success || !listResult.playbooks) {
      return {
        ...result,
        message: listResult.error || '플레이북 목록을 가져올 수 없습니다',
      };
    }

    for (const pb of listResult.playbooks) {
      const syncResult = await this.syncPlaybook(pb.playbook_id);
      if (syncResult.success) {
        result.synced++;
      } else {
        result.failed++;
        result.errors.push(`${pb.name}: ${syncResult.message}`);
      }
    }

    result.success = result.failed === 0;
    result.message = `${result.synced}개 동기화 완료${result.failed > 0 ? `, ${result.failed}개 실패` : ''}`;

    return result;
  }

  /**
   * 동기화 상태 확인 (경량 - 메타 캐시만 사용)
   */
  async checkSyncStatus(): Promise<SyncStatus[]> {
    const statuses: SyncStatus[] = [];

    await this.refreshRemoteMetaCache();
    if (!this.remoteMetaCache) {
      return statuses;
    }

    for (const [playbookId, remoteMeta] of this.remoteMetaCache) {
      const cached = this.cacheIndex.get(playbookId);

      let status: SyncStatus['status'] = 'not_synced';
      let needsUpdate = true;

      if (cached) {
        if (cached.checksum === remoteMeta.checksum) {
          status = 'synced';
          needsUpdate = false;
        } else {
          status = 'update_available';
        }
      }

      statuses.push({
        playbook_id: playbookId,
        name: remoteMeta.name,
        current_version: remoteMeta.version,
        synced_version: cached?.version || null,
        status,
        needs_update: needsUpdate,
        remote_updated_at: remoteMeta.updated_at,
        local_cached_at: cached?.cachedAt,
      });
    }

    return statuses;
  }

  /**
   * 캐시된 플레이북 조회
   */
  async getCachedPlaybook(playbookId: string): Promise<Playbook | null> {
    const cachePath = path.join(this.cacheDir, `${playbookId}.json`);

    if (!fs.existsSync(cachePath)) {
      return null;
    }

    try {
      const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      return data as Playbook;
    } catch (error) {
      console.error(`[PlaybookSync] Failed to read cache for ${playbookId}:`, error);
      return null;
    }
  }

  /**
   * 모든 캐시된 플레이북 조회
   */
  async getAllCachedPlaybooks(): Promise<Playbook[]> {
    const playbooks: Playbook[] = [];

    for (const playbookId of this.cacheIndex.keys()) {
      const playbook = await this.getCachedPlaybook(playbookId);
      if (playbook) {
        playbooks.push(playbook);
      }
    }

    return playbooks;
  }

  /**
   * 플레이북 캐시 저장
   */
  private async cachePlaybook(
    playbookId: string,
    playbook: Playbook,
    checksum: string,
    updatedAt: string
  ): Promise<void> {
    const cachePath = path.join(this.cacheDir, `${playbookId}.json`);

    try {
      fs.writeFileSync(cachePath, JSON.stringify(playbook, null, 2));

      this.cacheIndex.set(playbookId, {
        version: playbook.metadata.version,
        checksum,
        updatedAt,
        cachedAt: new Date().toISOString(),
      });

      this.saveCacheIndex();
    } catch (error) {
      console.error(`[PlaybookSync] Failed to cache ${playbookId}:`, error);
    }
  }

  /**
   * 캐시 삭제
   */
  async clearCache(): Promise<void> {
    try {
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        fs.unlinkSync(path.join(this.cacheDir, file));
      }
      this.cacheIndex.clear();
      this.remoteMetaCache = null;
      console.log('[PlaybookSync] Cache cleared');
    } catch (error) {
      console.error('[PlaybookSync] Failed to clear cache:', error);
    }
  }

  /**
   * 캐시 인덱스 조회 (디버그/상태 확인용)
   */
  getCacheIndex(): Record<string, CacheIndexEntry> {
    return Object.fromEntries(this.cacheIndex);
  }

  /**
   * DB 형식 → 앱 Playbook 형식 변환
   */
  private convertDBToPlaybook(db: DBPlaybook): Playbook {
    const metadata: PlaybookMetadata = {
      id: db.playbook_id,
      name: db.name,
      version: db.version,
      description: db.description,
      category: this.normalizeCategory(db.category),
      difficulty: this.normalizeDifficulty(db.difficulty),
      estimated_time: db.estimated_time,
      keywords: db.keywords,
      author: db.author,
      last_updated: db.updated_at,
    };

    return {
      metadata,
      variables: db.variables as Record<string, any>,
      preconditions: db.preconditions as any[],
      steps: db.steps as any[],
      error_handlers: db.error_handlers as any[],
    };
  }

  private normalizeCategory(category: string): PlaybookMetadata['category'] {
    const validCategories = ['회원관리', '사업선정', '교부관리', '집행관리', '정산관리', '사후관리', '기타'];
    return validCategories.includes(category) ? category as any : '기타';
  }

  private normalizeDifficulty(difficulty: string): PlaybookMetadata['difficulty'] {
    const validDifficulties = ['쉬움', '보통', '어려움'];
    return validDifficulties.includes(difficulty) ? difficulty as any : '보통';
  }
}

// Singleton instance
export const playbookSyncService = new PlaybookSyncService();
