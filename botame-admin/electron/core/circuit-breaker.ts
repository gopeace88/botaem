/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures by failing fast when a service is down
 */

export enum CircuitState {
  CLOSED = 'CLOSED',   // Normal operation
  OPEN = 'OPEN',         // Failing, reject requests
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

interface CircuitBreakerConfig {
  failureThreshold: number;  // Failures before opening
  resetTimeout: number;       // Time before attempting recovery
  monitoringPeriod: number;  // Time window for counting failures
}

/**
 * Circuit Breaker for service protection
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private nextAttemptTime = 0;
  private readonly config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        throw new Error(`Circuit breaker is OPEN. Next attempt at ${new Date(this.nextAttemptTime).toISOString()}`);
      }
      // Transition to HALF_OPEN
      this.state = CircuitState.HALF_OPEN;
      console.log('[CircuitBreaker] Transitioning to HALF_OPEN');
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
      console.log('[CircuitBreaker] Recovered, transitioning to CLOSED');
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.config.resetTimeout;
      console.error(`[CircuitBreaker] Circuit OPEN after ${this.failureCount} failures. Next attempt at ${new Date(this.nextAttemptTime).toISOString()}`);
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get failure count
   */
  getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.nextAttemptTime = 0;
    console.log('[CircuitBreaker] Reset to CLOSED state');
  }
}

/**
 * Circuit Breaker Manager
 * Manages multiple circuit breakers for different services
 */
export class CircuitBreakerManager {
  private readonly breakers = new Map<string, CircuitBreaker>();

  /**
   * Get or create circuit breaker for service
   */
  getBreaker(serviceName: string, config?: CircuitBreakerConfig): CircuitBreaker {
    if (!this.breakers.has(serviceName)) {
      const defaultConfig: CircuitBreakerConfig = {
        failureThreshold: 5,
        resetTimeout: 60000, // 1 minute
        monitoringPeriod: 10000, // 10 seconds
      };
      
      this.breakers.set(serviceName, new CircuitBreaker(config || defaultConfig));
    }
    return this.breakers.get(serviceName)!;
  }

  /**
   * Get all circuit breaker states
   */
  getAllStates(): Map<string, CircuitState> {
    const states = new Map<string, CircuitState>();
    this.breakers.forEach((breaker, name) => {
      states.set(name, breaker.getState());
    });
    return states;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    this.breakers.forEach(breaker => breaker.reset());
    console.log('[CircuitBreaker] All breakers reset');
  }
}

// Singleton instance
let circuitBreakerManagerInstance: CircuitBreakerManager | null = null;

export function getCircuitBreakerManager(): CircuitBreakerManager {
  if (!circuitBreakerManagerInstance) {
    circuitBreakerManagerInstance = new CircuitBreakerManager();
  }
  return circuitBreakerManagerInstance;
}
