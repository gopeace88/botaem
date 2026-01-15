import { safeStorage } from 'electron';

/**
 * Service identifiers for stored credentials
 */
export type CredentialService = 'anthropic' | 'supabase';

/**
 * Credentials Service - Secure API Key Storage using Electron's safeStorage
 *
 * Uses platform-native encryption:
 * - Windows: DPAPI
 * - macOS: Keychain
 * - Linux: Secret Service API
 */
export class CredentialsService {
  private isEncryptionAvailable: boolean;

  constructor() {
    this.isEncryptionAvailable = safeStorage.isEncryptionAvailable();
    
    if (!this.isEncryptionAvailable) {
      console.error('[Credentials] Encryption not available on this system');
    }
  }

  /**
   * Store API key securely (encrypted)
   * @param service - Service identifier (anthropic, supabase)
   * @param key - API key to store
   * @returns Success status with message
   */
  async setApiKey(service: CredentialService, key: string): Promise<{ success: boolean; message: string }> {
    if (!this.isEncryptionAvailable) {
      return { success: false, message: '암호화를 사용할 수 없습니다' };
    }

    if (!key || key.trim().length === 0) {
      return { success: false, message: 'API Key가 비어있습니다' };
    }

    try {
      const encryptedKey = safeStorage.encryptString(key);
      
      // Store in user data using localStorage pattern
      // In production, use a proper key-value store
      const storageKey = this.getStorageKey(service);
      
      // For now, use a simple file-based approach
      // TODO: Use electron-store or similar for better persistence
      const { app } = await import('electron');
      const { join } = await import('path');
      const { writeFile, unlink } = await import('fs/promises');
      
      const credentialsPath = join(app.getPath('userData'), 'credentials');
      const credentialFile = join(credentialsPath, `${service}.key`);
      
      await writeFile(credentialFile, encryptedKey, { mode: 0o600 }); // Read/write for owner only
      
      console.log(`[Credentials] Stored API key for: ${service}`);
      return { success: true, message: `${service} API Key가 저장되었습니다` };
    } catch (error) {
      console.error(`[Credentials] Failed to store key for ${service}:`, error);
      return {
        success: false,
        message: `저장 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      };
    }
  }

  /**
   * Retrieve and decrypt API key
   * @param service - Service identifier
   * @returns Decrypted API key or null if not found
   */
  async getApiKey(service: CredentialService): Promise<string | null> {
    if (!this.isEncryptionAvailable) {
      console.error('[Credentials] Encryption not available');
      return null;
    }

    try {
      const { app } = await import('electron');
      const { join } = await import('path');
      const { readFile } = await import('fs/promises');
      
      const credentialsPath = join(app.getPath('userData'), 'credentials');
      const credentialFile = join(credentialsPath, `${service}.key`);
      
      const encryptedKey = await readFile(credentialFile);
      const decryptedKey = safeStorage.decryptString(encryptedKey);
      
      console.log(`[Credentials] Retrieved API key for: ${service}`);
      return decryptedKey;
    } catch (error) {
      // File not found is expected if key hasn't been stored yet
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.log(`[Credentials] No stored key for: ${service}`);
        return null;
      }
      
      console.error(`[Credentials] Failed to retrieve key for ${service}:`, error);
      return null;
    }
  }

  /**
   * Delete stored API key
   * @param service - Service identifier
   * @returns Success status with message
   */
  async deleteApiKey(service: CredentialService): Promise<{ success: boolean; message: string }> {
    if (!this.isEncryptionAvailable) {
      return { success: false, message: '암호화를 사용할 수 없습니다' };
    }

    try {
      const { app } = await import('electron');
      const { join } = await import('path');
      const { unlink } = await import('fs/promises');
      
      const credentialsPath = join(app.getPath('userData'), 'credentials');
      const credentialFile = join(credentialsPath, `${service}.key`);
      
      await unlink(credentialFile);
      
      console.log(`[Credentials] Deleted API key for: ${service}`);
      return { success: true, message: `${service} API Key가 삭제되었습니다` };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { success: false, message: '저장된 API Key가 없습니다' };
      }
      
      console.error(`[Credentials] Failed to delete key for ${service}:`, error);
      return {
        success: false,
        message: `삭제 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      };
    }
  }

  /**
   * Check if API key exists for service
   * @param service - Service identifier
   * @returns true if key exists
   */
  async hasApiKey(service: CredentialService): Promise<boolean> {
    const key = await this.getApiKey(service);
    return key !== null && key.length > 0;
  }

  /**
   * Get storage key for credential file
   */
  private getStorageKey(service: CredentialService): string {
    return `credential_${service}`;
  }

  /**
   * Validate API key format (basic validation)
   * @param service - Service identifier
   * @param key - API key to validate
   * @returns Validation result with message
   */
  validateApiKeyFormat(service: CredentialService, key: string): { valid: boolean; message: string } {
    if (!key || key.trim().length === 0) {
      return { valid: false, message: 'API Key가 비어있습니다' };
    }

    switch (service) {
      case 'anthropic':
        // Anthropic keys start with 'sk-ant-'
        if (key.startsWith('sk-ant-')) {
          return { valid: true, message: '유효한 Anthropic API Key 형식' };
        }
        return { valid: false, message: 'Anthropic API Key는 "sk-ant-"로 시작해야 합니다' };

      case 'supabase':
        // Supabase anon keys start with 'eyJ' (JWT format)
        if (key.startsWith('eyJ')) {
          return { valid: true, message: '유효한 Supabase API Key 형식' };
        }
        return { valid: false, message: 'Supabase API Key는 JWT 형식이어야 합니다' };

      default:
        return { valid: true, message: '형식 검증 통과' };
    }
  }
}

// Singleton instance
let credentialsServiceInstance: CredentialsService | null = null;

export function getCredentialsService(): CredentialsService {
  if (!credentialsServiceInstance) {
    credentialsServiceInstance = new CredentialsService();
  }
  return credentialsServiceInstance;
}
