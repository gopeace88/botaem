/**
 * Playbook Service - CRUD operations for playbook YAML files
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Playbook, PlaybookListItem, IpcResult } from '../../shared/types';

export class PlaybookService {
  private playbooksDir: string;

  constructor() {
    this.playbooksDir = path.join(app.getPath('userData'), 'playbooks');
    this.ensurePlaybooksDir();
  }

  private ensurePlaybooksDir(): void {
    if (!fs.existsSync(this.playbooksDir)) {
      fs.mkdirSync(this.playbooksDir, { recursive: true });
    }
  }

  /**
   * List all playbooks
   */
  async listPlaybooks(): Promise<IpcResult<PlaybookListItem[]>> {
    try {
      const files = fs.readdirSync(this.playbooksDir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));

      const playbooks: PlaybookListItem[] = [];

      for (const file of files) {
        const filePath = path.join(this.playbooksDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const playbook = yaml.load(content) as Playbook;

        if (playbook?.metadata) {
          const stats = fs.statSync(filePath);
          playbooks.push({
            id: playbook.metadata.id,
            name: playbook.metadata.name,
            description: playbook.metadata.description,
            category: playbook.metadata.category,
            difficulty: playbook.metadata.difficulty,
            stepCount: playbook.steps?.length || 0,
            filePath,
            updatedAt: stats.mtime.toISOString(),
          });
        }
      }

      return { success: true, data: playbooks };
    } catch (error) {
      console.error('[PlaybookService] Failed to list playbooks:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list playbooks',
      };
    }
  }

  /**
   * Load a playbook by ID
   */
  async loadPlaybook(id: string): Promise<IpcResult<Playbook>> {
    try {
      const filePath = path.join(this.playbooksDir, `${id}.yaml`);

      if (!fs.existsSync(filePath)) {
        return { success: false, error: `Playbook not found: ${id}` };
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const playbook = yaml.load(content) as Playbook;

      return { success: true, data: playbook };
    } catch (error) {
      console.error('[PlaybookService] Failed to load playbook:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load playbook',
      };
    }
  }

  /**
   * Save a playbook
   */
  async savePlaybook(playbook: Playbook): Promise<IpcResult<{ filePath: string }>> {
    try {
      const yamlContent = yaml.dump(playbook, {
        indent: 2,
        lineWidth: 120,
        noRefs: true,
        quotingType: '"',
        forceQuotes: false,
      });

      const header = `# ${playbook.metadata.name}\n# 수정됨: ${new Date().toISOString()}\n\n`;
      const finalContent = header + yamlContent;

      const filePath = path.join(this.playbooksDir, `${playbook.metadata.id}.yaml`);
      fs.writeFileSync(filePath, finalContent, 'utf-8');

      console.log(`[PlaybookService] Saved: ${filePath}`);

      return {
        success: true,
        message: `플레이북이 저장되었습니다: ${playbook.metadata.name}`,
        data: { filePath },
      };
    } catch (error) {
      console.error('[PlaybookService] Failed to save playbook:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save playbook',
      };
    }
  }

  /**
   * Delete a playbook
   */
  async deletePlaybook(id: string): Promise<IpcResult> {
    try {
      const filePath = path.join(this.playbooksDir, `${id}.yaml`);

      if (!fs.existsSync(filePath)) {
        return { success: false, error: `Playbook not found: ${id}` };
      }

      fs.unlinkSync(filePath);
      console.log(`[PlaybookService] Deleted: ${filePath}`);

      return { success: true, message: '플레이북이 삭제되었습니다.' };
    } catch (error) {
      console.error('[PlaybookService] Failed to delete playbook:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete playbook',
      };
    }
  }

  /**
   * Export a playbook to a target path
   */
  async exportPlaybook(id: string, targetPath: string): Promise<IpcResult> {
    try {
      const sourcePath = path.join(this.playbooksDir, `${id}.yaml`);

      if (!fs.existsSync(sourcePath)) {
        return { success: false, error: `Playbook not found: ${id}` };
      }

      fs.copyFileSync(sourcePath, targetPath);
      console.log(`[PlaybookService] Exported: ${sourcePath} -> ${targetPath}`);

      return { success: true, message: '플레이북이 내보내기되었습니다.' };
    } catch (error) {
      console.error('[PlaybookService] Failed to export playbook:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export playbook',
      };
    }
  }

  /**
   * Import a playbook from a source path
   */
  async importPlaybook(sourcePath: string): Promise<IpcResult<Playbook>> {
    try {
      if (!fs.existsSync(sourcePath)) {
        return { success: false, error: `File not found: ${sourcePath}` };
      }

      const content = fs.readFileSync(sourcePath, 'utf-8');
      const playbook = yaml.load(content) as Playbook;

      if (!playbook?.metadata?.id || !playbook?.metadata?.name) {
        return { success: false, error: 'Invalid playbook format' };
      }

      // Save to playbooks directory
      await this.savePlaybook(playbook);

      return {
        success: true,
        message: '플레이북이 가져오기되었습니다.',
        data: playbook,
      };
    } catch (error) {
      console.error('[PlaybookService] Failed to import playbook:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to import playbook',
      };
    }
  }

  /**
   * Get playbooks directory path
   */
  getPlaybooksDir(): string {
    return this.playbooksDir;
  }
}
