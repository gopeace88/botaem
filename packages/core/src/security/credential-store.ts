const SERVICE_NAME = 'botame-guide';

export interface CredentialStoreBackend {
  getPassword(service: string, account: string): Promise<string | null>;
  setPassword(service: string, account: string, password: string): Promise<void>;
  deletePassword(service: string, account: string): Promise<boolean>;
}

export class CredentialStore {
  constructor(private backend?: CredentialStoreBackend) {}

  async save(account: string, password: string): Promise<void> {
    if (!this.backend) {
      throw new Error('Credential store backend not configured');
    }
    await this.backend.setPassword(SERVICE_NAME, account, password);
  }

  async get(account: string): Promise<string | null> {
    if (!this.backend) {
      throw new Error('Credential store backend not configured');
    }
    return this.backend.getPassword(SERVICE_NAME, account);
  }

  async delete(account: string): Promise<boolean> {
    if (!this.backend) {
      throw new Error('Credential store backend not configured');
    }
    return this.backend.deletePassword(SERVICE_NAME, account);
  }

  setBackend(backend: CredentialStoreBackend): void {
    this.backend = backend;
  }
}
