# Centralized Configuration

/**
 * Application Constants
 */

// Viewport configurations
export const VIEWPORT = {
  DEFAULT: { width: 1280, height: 800 },
  FULL_HD: { width: 1920, height: 1080 },
  LAPTOP: { width: 1366, height: 768 },
} as const;

// Timeouts (in milliseconds)
export const TIMEOUT = {
  DEFAULT: 30000,
  SHORT: 5000,
  LONG: 60000,
  BROWSER_LAUNCH: 10000,
} as const;

// Retry configuration
export const RETRY = {
  MAX_ATTEMPTS: 3,
  DELAY: 1000,
  BACKOFF_MULTIPLIER: 2,
} as const;

// Self-healing thresholds
export const HEALING = {
  MAX_ATTEMPTS: 5,
  TIMEOUT_MULTIPLIER: 1.5,
} as const;

// API endpoints
export const API = {
  ANTHROPIC: 'https://api.anthropic.com',
  DEFAULT_MODEL: 'claude-3-haiku-20240307',
} as const;

// File paths
export const PATHS = {
  USER_DATA: 'userData',
  LOGS: 'logs',
  CREDENTIALS: 'credentials',
  PLAYBOOKS: 'playbooks',
  CACHE: 'cache',
} as const;

// Feature flags
export const FEATURES = {
  OFFLINE_MODE: true,
  CIRCUIT_BREAKER: true,
  AUTO_UPDATER: true,
} as const;
