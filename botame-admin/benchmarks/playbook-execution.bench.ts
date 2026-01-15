/**
 * Performance Benchmarks for Playbook Execution
 *
 * Measures:
 * - Playbook load time
 * - Step execution time
 * - Total run duration
 * - Memory usage
 */

import { performance } from 'perf_hooks';
import { PlaybookService } from '../electron/services/playbook.service';
import { PlaybookRunnerService } from '../electron/services/playbook-runner.service';
import { BrowserService } from '../electron/services/browser.service';

interface BenchmarkResult {
  name: string;
  duration: number;
  memoryBefore: number;
  memoryAfter: number;
  memoryDelta: number;
  passed: boolean;
  threshold: number;
}

export class PerformanceBenchmarks {
  private playbookService: PlaybookService;
  private browserService: BrowserService;
  private runnerService: PlaybookRunnerService;
  private results: BenchmarkResult[] = [];

  constructor() {
    this.playbookService = new PlaybookService();
    this.browserService = new BrowserService();
    this.runnerService = new PlaybookRunnerService(this.browserService);
  }

  /**
   * Measure playbook loading performance
   */
  async benchmarkPlaybookLoad(): Promise<BenchmarkResult> {
    const memoryBefore = process.memoryUsage().heapUsed / 1024 / 1024;
    const start = performance.now();

    // Load a sample playbook
    const result = await this.playbookService.loadPlaybook('sample-playbook');

    const duration = performance.now() - start;
    const memoryAfter = process.memoryUsage().heapUsed / 1024 / 1024;

    const benchmark: BenchmarkResult = {
      name: 'Playbook Load',
      duration,
      memoryBefore,
      memoryAfter,
      memoryDelta: memoryAfter - memoryBefore,
      passed: duration < 1000, // Should load within 1 second
      threshold: 1000,
    };

    this.results.push(benchmark);
    return benchmark;
  }

  /**
   * Measure playbook execution performance
   */
  async benchmarkPlaybookExecution(): Promise<BenchmarkResult> {
    // Create a test playbook with 10 steps
    const testPlaybook = {
      id: 'benchmark-test',
      name: 'Performance Test Playbook',
      description: 'Used for performance benchmarking',
      startUrl: 'https://www.losims.go.kr/lss.do',
      category: 'test',
      steps: Array.from({ length: 10 }, (_, i) => ({
        id: `step-${i}`,
        type: 'click',
        selector: `#test-element-${i}`,
        message: `Test step ${i + 1}`,
        smartSelector: {
          primary: `#test-element-${i}`,
          fallback: [],
        },
      })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const memoryBefore = process.memoryUsage().heapUsed / 1024 / 1024;
    const start = performance.now();

    // Execute playbook (simulate)
    await this.runnerService.runPlaybook(testPlaybook, testPlaybook.startUrl);

    const duration = performance.now() - start;
    const memoryAfter = process.memoryUsage().heapUsed / 1024 / 1024;

    const benchmark: BenchmarkResult = {
      name: 'Playbook Execution (10 steps)',
      duration,
      memoryBefore,
      memoryAfter,
      memoryDelta: memoryAfter - memoryBefore,
      passed: duration < 30000, // Should complete within 30 seconds
      threshold: 30000,
    };

    this.results.push(benchmark);
    return benchmark;
  }

  /**
   * Measure memory usage with many playbooks
   */
  async benchmarkMemoryUsage(): Promise<BenchmarkResult> {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const memoryBefore = process.memoryUsage().heapUsed / 1024 / 1024;
    const start = performance.now();

    // Load 100 playbooks
    const loadPromises = Array.from({ length: 100 }, (_, i) =>
      this.playbookService.loadPlaybook(`playbook-${i}`)
    );

    await Promise.allSettled(loadPromises);

    const duration = performance.now() - start;
    const memoryAfter = process.memoryUsage().heapUsed / 1024 / 1024;

    const benchmark: BenchmarkResult = {
      name: 'Memory Usage (100 playbooks)',
      duration,
      memoryBefore,
      memoryAfter,
      memoryDelta: memoryAfter - memoryBefore,
      passed: memoryDelta < 100, // Should use less than 100MB
      threshold: 100,
    };

    this.results.push(benchmark);
    return benchmark;
  }

  /**
   * Measure browser startup time
   */
  async benchmarkBrowserStartup(): Promise<BenchmarkResult> {
    const memoryBefore = process.memoryUsage().heapUsed / 1024 / 1024;
    const start = performance.now();

    await this.browserService.initialize();

    const duration = performance.now() - start;
    const memoryAfter = process.memoryUsage().heapUsed / 1024 / 1024;

    const benchmark: BenchmarkResult = {
      name: 'Browser Startup',
      duration,
      memoryBefore,
      memoryAfter,
      memoryDelta: memoryAfter - memoryBefore,
      passed: duration < 10000, // Should start within 10 seconds
      threshold: 10000,
    };

    this.results.push(benchmark);
    return benchmark;
  }

  /**
   * Measure auto-healing performance
   */
  async benchmarkAutoHealing(): Promise<BenchmarkResult> {
    // Create a playbook with failing selectors
    const testPlaybook = {
      id: 'healing-test',
      name: 'Auto-Healing Test',
      description: 'Tests auto-healing performance',
      startUrl: 'https://www.losims.go.kr/lss.do',
      category: 'test',
      steps: [
        {
          id: 'step-1',
          type: 'click',
          selector: '#nonexistent-selector',
          message: 'Click button',
          smartSelector: {
            primary: '#nonexistent-selector',
            fallback: ['#backup-1', '#backup-2'],
          },
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const memoryBefore = process.memoryUsage().heapUsed / 1024 / 1024;
    const start = performance.now();

    // Run and measure healing time
    await this.runnerService.runPlaybook(testPlaybook, testPlaybook.startUrl);

    const duration = performance.now() - start;
    const memoryAfter = process.memoryUsage().heapUsed / 1024 / 1024;

    const benchmark: BenchmarkResult = {
      name: 'Auto-Healing (fallback)',
      duration,
      memoryBefore,
      memoryAfter,
      memoryDelta: memoryAfter - memoryBefore,
      passed: duration < 5000, // Should heal within 5 seconds
      threshold: 5000,
    };

    this.results.push(benchmark);
    return benchmark;
  }

  /**
   * Run all benchmarks
   */
  async runAll(): Promise<BenchmarkResult[]> {
    console.log('Starting performance benchmarks...\n');

    await this.benchmarkPlaybookLoad();
    console.log(`✓ Playbook Load: ${this.results[0].duration.toFixed(2)}ms`);

    await this.benchmarkBrowserStartup();
    console.log(`✓ Browser Startup: ${this.results[1].duration.toFixed(2)}ms`);

    await this.benchmarkPlaybookExecution();
    console.log(`✓ Playbook Execution: ${this.results[2].duration.toFixed(2)}ms`);

    await this.benchmarkAutoHealing();
    console.log(`✓ Auto-Healing: ${this.results[3].duration.toFixed(2)}ms`);

    await this.benchmarkMemoryUsage();
    console.log(`✓ Memory Usage: ${this.results[4].memoryDelta.toFixed(2)}MB\n`);

    return this.results;
  }

  /**
   * Generate benchmark report
   */
  generateReport(): string {
    let report = '\n=== Performance Benchmark Report ===\n\n';

    this.results.forEach(result => {
      const status = result.passed ? '✓ PASS' : '✗ FAIL';
      report += `${status} ${result.name}\n`;
      report += `  Duration: ${result.duration.toFixed(2)}ms (threshold: ${result.threshold}ms)\n`;
      report += `  Memory: +${result.memoryDelta.toFixed(2)}MB\n`;
      report += `  Before: ${result.memoryBefore.toFixed(2)}MB, After: ${result.memoryAfter.toFixed(2)}MB\n\n`;
    });

    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    const totalMemoryDelta = this.results.reduce((sum, r) => sum + r.memoryDelta, 0);
    const passRate = (this.results.filter(r => r.passed).length / this.results.length * 100).toFixed(0);

    report += `Total Duration: ${totalDuration.toFixed(2)}ms\n`;
    report += `Total Memory Delta: +${totalMemoryDelta.toFixed(2)}MB\n`;
    report += `Pass Rate: ${passRate}%\n`;

    return report;
  }

  /**
   * Export results to JSON
   */
  exportResults(): object {
    return {
      timestamp: new Date().toISOString(),
      results: this.results,
      summary: {
        totalDuration: this.results.reduce((sum, r) => sum + r.duration, 0),
        totalMemoryDelta: this.results.reduce((sum, r) => sum + r.memoryDelta, 0),
        passCount: this.results.filter(r => r.passed).length,
        failCount: this.results.filter(r => !r.passed).length,
        passRate: this.results.filter(r => r.passed).length / this.results.length,
      },
    };
  }

  /**
   * Cleanup
   */
  async cleanup() {
    await this.browserService?.cleanup();
  }
}

// Run benchmarks if executed directly
if (require.main === module) {
  const benchmarks = new PerformanceBenchmarks();

  benchmarks.runAll()
    .then(() => {
      console.log(benchmarks.generateReport());
      console.log('\nJSON Results:');
      console.log(JSON.stringify(benchmarks.exportResults(), null, 2));
    })
    .catch(error => {
      console.error('Benchmark failed:', error);
      process.exit(1);
    })
    .finally(() => {
      return benchmarks.cleanup();
    });
}
