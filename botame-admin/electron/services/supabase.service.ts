/**
 * Supabase Sync Service - botame-admin
 *
 * 플레이북을 Supabase에 동기화하는 서비스
 * - DB 카탈로그 조회 (published + draft)
 * - 플레이북 업로드/다운로드
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Playbook } from '../../shared/types';
import { configLoader } from '../../shared/config';

export interface SyncResult {
  success: boolean;
  message: string;
  syncedCount?: number;
  errors?: string[];
}

export interface SyncStatus {
  connected: boolean;
  lastSync: Date | null;
  pendingUploads: number;
}

export interface PlaybookCatalogItem {
  id: string;
  playbook_id: string;
  name: string;
  description: string;
  category: string;
  difficulty: string;
  estimated_time: string;
  version: string;
  is_published: boolean;
  status: string;
  keywords: string[];
  updated_at: string;
  step_count: number;
  level: number;
  start_url: string;
}

export class SupabaseService {
  private client: SupabaseClient | null = null;
  private syncStatus: SyncStatus = {
    connected: false,
    lastSync: null,
    pendingUploads: 0,
  };

  constructor() {
    // Don't auto-initialize, wait for explicit configure()
  }

  /**
   * Initialize with stored credentials (called from main.ts)
   */
  async initializeFromEnv(): Promise<void> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      await this.configure(supabaseUrl, supabaseKey);
    } else {
      console.warn('[Supabase] URL or ANON_KEY not configured in env');
    }
  }

  async configure(url: string, key: string): Promise<{ success: boolean; message: string }> {
    try {
      this.client = createClient(url, key);
      const connected = await this.checkConnection();

      if (connected) {
        return { success: true, message: 'Supabase 연결 성공' };
      } else {
        return { success: false, message: 'Supabase 연결 실패' };
      }
    } catch (error) {
      return {
        success: false,
        message: `설정 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      };
    }
  }

  private async checkConnection(): Promise<boolean> {
    if (!this.client) {
      this.syncStatus.connected = false;
      return false;
    }

    try {
      // 간단한 쿼리로 연결 확인 - playbooks 테이블 조회
      const { data, error } = await this.client.from('playbooks').select('id').limit(1);

      if (error) {
        // 테이블 관련 에러는 연결은 됐지만 테이블이 없는 경우
        // PGRST116: 결과 없음, 42P01: 테이블 없음
        const tableNotFoundCodes = ['PGRST116', '42P01', 'PGRST204'];
        if (tableNotFoundCodes.includes(error.code) || error.message.includes('schema cache')) {
          console.warn('[Supabase] Connected but table may not exist:', error.message);
          // 연결은 성공으로 처리 (테이블이 없어도 연결은 됨)
          this.syncStatus.connected = true;
          return true;
        }

        console.error('[Supabase] Connection check failed:', error.code, error.message);
        this.syncStatus.connected = false;
        return false;
      }

      this.syncStatus.connected = true;
      console.log('[Supabase] Connected successfully, found', data?.length || 0, 'playbooks');
      return true;
    } catch (error) {
      console.error('[Supabase] Connection error:', error);
      this.syncStatus.connected = false;
      return false;
    }
  }

  async uploadPlaybook(playbook: Playbook): Promise<{ success: boolean; message: string }> {
    if (!this.client) {
      return { success: false, message: 'Supabase가 설정되지 않았습니다' };
    }

    try {
      const { error } = await this.client
        .from('playbooks')
        .upsert({
          playbook_id: playbook.metadata.id,
          name: playbook.metadata.name,
          description: playbook.metadata.description,
          category: playbook.metadata.category,
          difficulty: playbook.metadata.difficulty,
          version: playbook.metadata.version,
          keywords: playbook.metadata.keywords || [],
          estimated_time: playbook.metadata.estimatedTime,
          start_url: playbook.metadata.startUrl || configLoader.getUrl('home'),
          author: 'admin',
          is_published: false,  // 신규 업로드는 기본 비공개
          status: 'draft',      // 신규 업로드는 기본 draft
          steps: playbook.steps,
          yaml_content: null,
          created_at: playbook.metadata.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'playbook_id',
        });

      if (error) {
        console.error('[Supabase] Upload error:', error);
        return { success: false, message: `업로드 실패: ${error.message}` };
      }

      this.syncStatus.lastSync = new Date();
      return { success: true, message: '플레이북이 업로드되었습니다' };
    } catch (error) {
      return {
        success: false,
        message: `업로드 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      };
    }
  }

  async uploadAllPlaybooks(playbooks: Playbook[]): Promise<SyncResult> {
    if (!this.client) {
      return { success: false, message: 'Supabase가 설정되지 않았습니다' };
    }

    const errors: string[] = [];
    let syncedCount = 0;

    for (const playbook of playbooks) {
      const result = await this.uploadPlaybook(playbook);
      if (result.success) {
        syncedCount++;
      } else {
        errors.push(`${playbook.metadata.name}: ${result.message}`);
      }
    }

    this.syncStatus.lastSync = new Date();

    if (errors.length === 0) {
      return {
        success: true,
        message: `${syncedCount}개 플레이북이 동기화되었습니다`,
        syncedCount
      };
    } else {
      return {
        success: syncedCount > 0,
        message: `${syncedCount}개 동기화, ${errors.length}개 실패`,
        syncedCount,
        errors,
      };
    }
  }

  async downloadPlaybook(id: string): Promise<{ success: boolean; playbook?: Playbook; message: string }> {
    if (!this.client) {
      return { success: false, message: 'Supabase가 설정되지 않았습니다' };
    }

    try {
      const { data, error } = await this.client
        .from('playbooks')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        return { success: false, message: `다운로드 실패: ${error.message}` };
      }

      if (!data) {
        return { success: false, message: '플레이북을 찾을 수 없습니다' };
      }

      const playbook: Playbook = {
        metadata: JSON.parse(data.metadata),
        steps: JSON.parse(data.steps),
      };

      return { success: true, playbook, message: '다운로드 성공' };
    } catch (error) {
      return {
        success: false,
        message: `다운로드 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      };
    }
  }

  async listRemotePlaybooks(): Promise<{ success: boolean; playbooks?: Array<{ id: string; name: string; updatedAt: string }>; message: string }> {
    if (!this.client) {
      return { success: false, message: 'Supabase가 설정되지 않았습니다' };
    }

    try {
      const { data, error } = await this.client
        .from('playbooks')
        .select('id, playbook_id, name, updated_at')
        .order('updated_at', { ascending: false });

      if (error) {
        return { success: false, message: `목록 조회 실패: ${error.message}` };
      }

      const playbooks = (data || []).map(item => ({
        id: item.playbook_id || item.id,
        name: item.name,
        updatedAt: item.updated_at,
      }));

      return { success: true, playbooks, message: '조회 성공' };
    } catch (error) {
      return {
        success: false,
        message: `조회 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      };
    }
  }

  /**
   * 전체 플레이북 카탈로그 조회 (published + draft 모두)
   * 관리자용: 카테고리별 트리 뷰에 표시
   */
  async getPlaybookCatalog(): Promise<{
    success: boolean;
    playbooks?: PlaybookCatalogItem[];
    message: string
  }> {
    if (!this.client) {
      return { success: false, message: 'Supabase가 설정되지 않았습니다' };
    }

    try {
      const { data, error } = await this.client
        .from('playbooks')
        .select(`
          id,
          playbook_id,
          name,
          description,
          category,
          difficulty,
          estimated_time,
          version,
          is_published,
          status,
          keywords,
          updated_at,
          steps,
          level,
          start_url
        `)
        .order('category')
        .order('name');

      if (error) {
        console.error('[Supabase] Catalog query error:', error);
        return { success: false, message: `카탈로그 조회 실패: ${error.message}` };
      }

      const playbooks: PlaybookCatalogItem[] = (data || []).map(item => ({
        id: item.id,
        playbook_id: item.playbook_id,
        name: item.name,
        description: item.description || '',
        category: item.category || '기타',
        difficulty: item.difficulty || '보통',
        estimated_time: item.estimated_time || '',
        version: item.version || '1.0.0',
        is_published: item.is_published || false,
        status: item.status || 'draft',
        keywords: item.keywords || [],
        updated_at: item.updated_at,
        step_count: Array.isArray(item.steps) ? item.steps.length : 0,
        level: item.level || 2,
        start_url: item.start_url || configLoader.getUrl('home'),
      }));

      console.log(`[Supabase] Loaded ${playbooks.length} playbooks from catalog`);
      return { success: true, playbooks, message: '카탈로그 조회 성공' };
    } catch (error) {
      return {
        success: false,
        message: `카탈로그 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      };
    }
  }

  /**
   * 플레이북 상세 조회 (steps 포함)
   */
  async getPlaybookDetail(playbookId: string): Promise<{
    success: boolean;
    playbook?: Playbook;
    startUrl?: string;
    message: string;
  }> {
    if (!this.client) {
      return { success: false, message: 'Supabase가 설정되지 않았습니다' };
    }

    try {
      const { data, error } = await this.client
        .from('playbooks')
        .select('*')
        .eq('playbook_id', playbookId)
        .single();

      if (error) {
        return { success: false, message: `조회 실패: ${error.message}` };
      }

      if (!data) {
        return { success: false, message: '플레이북을 찾을 수 없습니다' };
      }

      // Convert DB format to Playbook type
      const playbook: Playbook = {
        metadata: {
          id: data.playbook_id,
          name: data.name,
          description: data.description,
          category: data.category,
          difficulty: data.difficulty,
          version: data.version || '1.0.0',
          keywords: data.keywords || [],
          estimatedTime: data.estimated_time,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        },
        steps: data.steps || [],
      };

      const startUrl = data.start_url || configLoader.getUrl('home');
      return { success: true, playbook, startUrl, message: '조회 성공' };
    } catch (error) {
      return {
        success: false,
        message: `조회 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      };
    }
  }

  /**
   * 카탈로그 플레이북 업데이트 (steps, metadata 모두)
   */
  async updatePlaybook(playbook: Playbook): Promise<{ success: boolean; message: string }> {
    if (!this.client) {
      return { success: false, message: 'Supabase가 설정되지 않았습니다' };
    }

    try {
      const { error } = await this.client
        .from('playbooks')
        .update({
          name: playbook.metadata.name,
          description: playbook.metadata.description,
          category: playbook.metadata.category,
          difficulty: playbook.metadata.difficulty,
          version: playbook.metadata.version,
          keywords: playbook.metadata.keywords || [],
          estimated_time: playbook.metadata.estimatedTime,
          start_url: playbook.metadata.startUrl || configLoader.getUrl('home'),
          steps: playbook.steps,
          updated_at: new Date().toISOString(),
        })
        .eq('playbook_id', playbook.metadata.id);

      if (error) {
        console.error('[Supabase] Update error:', error);
        return { success: false, message: `저장 실패: ${error.message}` };
      }

      this.syncStatus.lastSync = new Date();
      return { success: true, message: '플레이북이 저장되었습니다' };
    } catch (error) {
      return {
        success: false,
        message: `저장 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      };
    }
  }

  /**
   * AI/Auto-Rescue 자동 복구 제안 제출
   * Phase 3: Server Feedback Loop
   */
  async submitAutoFixProposal(
    playbookId: string,
    stepId: string,
    originalSelector: string,
    proposedSelector: string,
    context?: string
  ): Promise<{ success: boolean; message: string }> {
    if (!this.client) {
      return { success: false, message: 'Supabase가 설정되지 않았습니다' };
    }

    try {
      const { error } = await this.client
        .from('playbook_proposals')
        .insert({
          playbook_id: playbookId,
          step_id: stepId,
          original_selector: originalSelector,
          proposed_selector: proposedSelector,
          context_snapshot: context,
          status: 'pending',
          source: 'auto-rescue',
          created_at: new Date().toISOString(),
        });

      if (error) {
        console.error('[Supabase] Proposal submit error:', error);
        return { success: false, message: `제안 제출 실패: ${error.message}` };
      }

      return { success: true, message: '자동 복구 제안이 제출되었습니다' };
    } catch (error) {
      return {
        success: false,
        message: `제안 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      };
    }
  }

  async deleteRemotePlaybook(id: string): Promise<{ success: boolean; message: string }> {
    if (!this.client) {
      return { success: false, message: 'Supabase가 설정되지 않았습니다' };
    }

    try {
      const { error } = await this.client
        .from('playbooks')
        .delete()
        .eq('id', id);

      if (error) {
        return { success: false, message: `삭제 실패: ${error.message}` };
      }

      return { success: true, message: '원격 플레이북이 삭제되었습니다' };
    } catch (error) {
      return {
        success: false,
        message: `삭제 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      };
    }
  }


  getStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  isConnected(): boolean {
    return this.syncStatus.connected;
  }
}
