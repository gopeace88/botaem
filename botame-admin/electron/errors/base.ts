/**
 * Base Error Class
 * All custom errors extend from this class
 */
export class BaseError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: number;
  public readonly recoverable: boolean;

  constructor(
    message: string,
    code: string,
    options?: {
      context?: Record<string, unknown>;
      recoverable?: boolean;
    }
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = options?.context;
    this.timestamp = Date.now();
    this.recoverable = options?.recoverable ?? false;
    
    // Maintains proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp,
      recoverable: this.recoverable,
      stack: this.stack,
    };
  }
}

/**
 * Recoverable Error
 * User can retry the operation
 */
export class RecoverableError extends BaseError {
/**
 * Fatal Error
 * Application cannot continue
 */
export class FatalError extends BaseError {
  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message, code, { context, recoverable: false, cause });
  }
}

/**
 * Offline Error
 * No internet connection
 */
export class OfflineError extends RecoverableError {
  constructor(message = '인터넷 연결을 확인해주세요', context?: Record<string, unknown>) {
    super(message, 'OFFLINE_ERROR', context);
  }
}

/**
 * Validation Error
 * Invalid user input or data
 */
export class ValidationError extends RecoverableError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', context);
  }
}

/**
 * Network Error
 * HTTP request failed
 */
export class NetworkError extends RecoverableError {
  constructor(
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'NETWORK_ERROR', context);
  }
}

/**
 * Browser Error
 * Playwright/browser automation failed
 */
export class BrowserError extends RecoverableError {
  constructor(
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'BROWSER_ERROR', context);
  }
}

/**
 * Playbook Error
 * Playbook execution failed
 */
export class PlaybookError extends RecoverableError {
  constructor(
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'PLAYBOOK_ERROR', context);
  }
}

/**
 * Selector Error
 * Element selector failed
 */
export class SelectorError extends PlaybookError {
  constructor(
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'SELECTOR_ERROR', context);
  }
}

/**
 * Authentication Error
 * API key or credentials invalid
 */
export class AuthenticationError extends RecoverableError {
  constructor(message = 'API Key가 유효하지 않습니다', context?: Record<string, unknown>) {
    super(message, 'AUTH_ERROR', context);
  }
}

/**
 * File System Error
 * File read/write failed
 */
export class FileSystemError extends RecoverableError {
  constructor(
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'FILESYSTEM_ERROR', context);
  }
}

/**
 * Configuration Error
 * Invalid or missing configuration
 */
export class ConfigurationError extends FatalError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONFIG_ERROR', context);
  }
}
