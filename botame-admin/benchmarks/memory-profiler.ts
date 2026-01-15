/**
 * Memory Profiler
 *
 * Tracks memory usage over time and detects leaks
 */

interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

interface LeakReport {
  hasLeak: boolean;
  leakRate: number; // MB per minute
  snapshots: MemorySnapshot[];
  recommendations: string[];
}

export class MemoryProfiler {
  private snapshots: MemorySnapshot[] = [];
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * Start profiling memory usage
   */
  start(sampleIntervalMs = 1000): void {
    if (this.isRunning) {
      console.warn('[MemoryProfiler] Already running');
      return;
    }

    this.isRunning = true;
    this.snapshots = [];

    // Take initial snapshot
    this.takeSnapshot();

    // Schedule periodic snapshots
    this.intervalId = setInterval(() => {
      this.takeSnapshot();
    }, sampleIntervalMs);

    console.log(`[MemoryProfiler] Started (interval: ${sampleIntervalMs}ms)`);
  }

  /**
   * Stop profiling and generate report
   */
  stop(): LeakReport {
    if (!this.isRunning) {
      throw new Error('MemoryProfiler is not running');
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;

    const report = this.analyzeLeaks();
    console.log('[MemoryProfiler] Stopped');

    return report;
  }

  /**
   * Take a memory snapshot
   */
  private takeSnapshot(): void {
    const usage = process.memoryUsage();

    this.snapshots.push({
      timestamp: Date.now(),
      heapUsed: usage.heapUsed / 1024 / 1024, // Convert to MB
      heapTotal: usage.heapTotal / 1024 / 1024,
      external: usage.external / 1024 / 1024,
      rss: usage.rss / 1024 / 1024,
    });
  }

  /**
   * Analyze snapshots for memory leaks
   */
  private analyzeLeaks(): LeakReport {
    if (this.snapshots.length < 2) {
      return {
        hasLeak: false,
        leakRate: 0,
        snapshots: this.snapshots,
        recommendations: ['Not enough data to detect leaks'],
      };
    }

    // Calculate leak rate using linear regression
    const first = this.snapshots[0];
    const last = this.snapshots[this.snapshots.length - 1];

    const durationMinutes = (last.timestamp - first.timestamp) / 60000;
    const memoryDelta = last.heapUsed - first.heapUsed;
    const leakRate = durationMinutes > 0 ? memoryDelta / durationMinutes : 0;

    // Determine if leak exists (growing by > 10MB/min)
    const hasLeak = leakRate > 10;

    // Generate recommendations
    const recommendations: string[] = [];

    if (hasLeak) {
      recommendations.push(`Potential memory leak detected: +${leakRate.toFixed(2)} MB/min`);
      recommendations.push('Check for:');
      recommendations.push('  - Event listeners not removed');
      recommendations.push('  - Timers not cleared');
      recommendations.push('  - Cached objects growing indefinitely');
      recommendations.push('  - Circular references');
    } else if (leakRate > 5) {
      recommendations.push(`Memory growing steadily: +${leakRate.toFixed(2)} MB/min`);
      recommendations.push('Monitor over longer period');
    } else {
      recommendations.push('No significant memory leak detected');
    }

    // Check for sudden spikes
    let maxDelta = 0;
    for (let i = 1; i < this.snapshots.length; i++) {
      const delta = this.snapshots[i].heapUsed - this.snapshots[i - 1].heapUsed;
      if (delta > maxDelta) {
        maxDelta = delta;
      }
    }

    if (maxDelta > 50) {
      recommendations.push(`Detected memory spike: +${maxDelta.toFixed(2)} MB`);
      recommendations.push('Review code that allocates large objects');
    }

    return {
      hasLeak,
      leakRate,
      snapshots: this.snapshots,
      recommendations,
    };
  }

  /**
   * Get current memory usage
   */
  getCurrentUsage(): MemorySnapshot {
    const usage = process.memoryUsage();

    return {
      timestamp: Date.now(),
      heapUsed: usage.heapUsed / 1024 / 1024,
      heapTotal: usage.heapTotal / 1024 / 1024,
      external: usage.external / 1024 / 1024,
      rss: usage.rss / 1024 / 1024,
    };
  }

  /**
   * Generate human-readable report
   */
  generateReport(report: LeakReport): string {
    let output = '\n=== Memory Profiler Report ===\n\n';

    output += `Duration: ${((report.snapshots[report.snapshots.length - 1].timestamp - report.snapshots[0].timestamp) / 1000).toFixed(0)}s\n`;
    output += `Snapshots: ${report.snapshots.length}\n\n`;

    output += 'Memory Usage:\n';
    output += `  Initial: ${report.snapshots[0].heapUsed.toFixed(2)} MB\n`;
    output += `  Final: ${report.snapshots[report.snapshots.length - 1].heapUsed.toFixed(2)} MB\n`;
    output += `  Delta: +${(report.snapshots[report.snapshots.length - 1].heapUsed - report.snapshots[0].heapUsed).toFixed(2)} MB\n\n`;

    output += 'Leak Detection:\n';
    output += `  Status: ${report.hasLeak ? '⚠️ LEAK DETECTED' : '✓ No leak'}\n`;
    output += `  Rate: ${report.leakRate.toFixed(2)} MB/min\n\n`;

    output += 'Recommendations:\n';
    report.recommendations.forEach(rec => {
      output += `  • ${rec}\n`;
    });

    return output;
  }

  /**
   * Export data for visualization
   */
  exportData(): string {
    return JSON.stringify({
      snapshots: this.snapshots,
      analysis: this.analyzeLeaks(),
    }, null, 2);
  }
}

// Example usage
if (require.main === module) {
  const profiler = new MemoryProfiler();

  console.log('Starting memory profiler for 10 seconds...');

  profiler.start(1000);

  // Simulate work
  let leakArray: any[] = [];
  const leakInterval = setInterval(() => {
    // Simulate leak (add 1MB per iteration)
    leakArray = leakArray.concat(new Array(250000).fill('x'));
  }, 2000);

  setTimeout(() => {
    clearInterval(leakInterval);

    const report = profiler.stop();
    console.log(profiler.generateReport(report));

    // Write to file
    const fs = require('fs');
    fs.writeFileSync('memory-profile.json', profiler.exportData());
    console.log('\nData exported to memory-profile.json');
  }, 10000);
}
