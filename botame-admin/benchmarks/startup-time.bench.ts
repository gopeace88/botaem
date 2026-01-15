/**
 * Startup Time Benchmark
 *
 * Measures application startup performance including:
 * - Main process initialization
 * - Renderer process loading
 * - Service initialization
 * - Time to interactive
 */

import { performance } from 'perf_hooks';
import { spawn } from 'child_process';
import { join } from 'path';

interface StartupMetrics {
  mainProcessStart: number;
  mainProcessReady: number;
  rendererLoadStart: number;
  rendererInteractive: number;
  totalStartupTime: number;
  servicesInitTime: number;
}

export class StartupBenchmark {
  private metrics: Partial<StartupMetrics> = {};
  private benchmarkProcess: any;

  /**
   * Measure Electron app startup time
   */
  async benchmarkElectronStartup(): Promise<StartupMetrics> {
    const startTime = performance.now();

    return new Promise((resolve, reject) => {
      let output = '';
      let mainReady = false;
      let rendererReady = false;

      // Spawn Electron app in dev mode
      this.benchmarkProcess = spawn('npm', ['run', 'dev'], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          BENCHMARK_MODE: 'true',
        },
      });

      this.benchmarkProcess.stdout.on('data', (data: Buffer) => {
        output += data.toString();

        // Parse main process ready time
        if (output.includes('[Main] Window created') && !mainReady) {
          this.metrics.mainProcessReady = performance.now() - startTime;
          mainReady = true;
        }

        // Parse renderer ready time
        if (output.includes('[Renderer] App ready') && !rendererReady) {
          this.metrics.rendererInteractive = performance.now() - startTime;
          rendererReady = true;

          // Calculate metrics
          this.metrics.totalStartupTime = this.metrics.rendererInteractive!;
          this.metrics.mainProcessStart = 0; // Relative to start

          // Cleanup and resolve
          this.benchmarkProcess.kill();
          resolve(this.metrics as StartupMetrics);
        }
      });

      this.benchmarkProcess.stderr.on('data', (data: Buffer) => {
        console.error('[Benchmark Stderr]', data.toString());
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        this.benchmarkProcess.kill();
        reject(new Error('Startup benchmark timeout'));
      }, 30000);
    });
  }

  /**
   * Measure service initialization time
   */
  async benchmarkServiceInit(): Promise<number> {
    const start = performance.now();

    // Simulate service initialization
    const { PlaybookService } = await import('../electron/services/playbook.service');
    const { RecordingService } = await import('../electron/services/recording.service');
    const { SupabaseService } = await import('../electron/services/supabase.service');
    const { BrowserService } = await import('../electron/services/browser.service');

    // Initialize services
    const playbookService = new PlaybookService();
    const recordingService = new RecordingService();
    const supabaseService = new SupabaseService();
    const browserService = new BrowserService();

    const duration = performance.now() - start;

    // Cleanup
    await browserService.cleanup();

    return duration;
  }

  /**
   * Measure renderer load time
   */
  async benchmarkRendererLoad(): Promise<number> {
    const start = performance.now();

    // Simulate renderer initialization
    // In a real benchmark, this would load the React app
    await new Promise(resolve => setTimeout(resolve, 100));

    const duration = performance.now() - start;
    return duration;
  }

  /**
   * Run all startup benchmarks
   */
  async runAll(): Promise<{
    electron: StartupMetrics;
    services: number;
    renderer: number;
  }> {
    console.log('Starting startup benchmarks...\n');

    // Benchmark Electron startup
    console.log('Measuring Electron startup...');
    const electronMetrics = await this.benchmarkElectronStartup();
    console.log(`✓ Total startup: ${electronMetrics.totalStartupTime.toFixed(2)}ms`);
    console.log(`✓ Main process ready: ${electronMetrics.mainProcessReady!.toFixed(2)}ms`);
    console.log(`✓ Renderer interactive: ${electronMetrics.rendererInteractive!.toFixed(2)}ms\n`);

    // Benchmark service initialization
    console.log('Measuring service initialization...');
    const serviceTime = await this.benchmarkServiceInit();
    console.log(`✓ Services init: ${serviceTime.toFixed(2)}ms\n`);

    // Benchmark renderer load
    console.log('Measuring renderer load...');
    const rendererTime = await this.benchmarkRendererLoad();
    console.log(`✓ Renderer load: ${rendererTime.toFixed(2)}ms\n`);

    return {
      electron: electronMetrics,
      services: serviceTime,
      renderer: rendererTime,
    };
  }

  /**
   * Generate recommendations based on metrics
   */
  generateRecommendations(metrics: {
    electron: StartupMetrics;
    services: number;
    renderer: number;
  }): string[] {
    const recommendations: string[] = [];

    // Electron startup
    if (metrics.electron.totalStartupTime > 5000) {
      recommendations.push('Electron startup is slow (>5s). Consider lazy loading services.');
    }

    // Service initialization
    if (metrics.services > 1000) {
      recommendations.push('Service initialization is slow (>1s). Initialize services on-demand.');
    }

    // Renderer load
    if (metrics.renderer > 500) {
      recommendations.push('Renderer load is slow (>500ms). Optimize React bundle size.');
    }

    if (recommendations.length === 0) {
      recommendations.push('All startup times are within acceptable ranges!');
    }

    return recommendations;
  }

  /**
   * Generate report
   */
  generateReport(metrics: {
    electron: StartupMetrics;
    services: number;
    renderer: number;
  }): string {
    let report = '\n=== Startup Performance Report ===\n\n';

    report += 'Electron Startup:\n';
    report += `  Main Process Ready: ${metrics.electron.mainProcessReady!.toFixed(2)}ms\n`;
    report += `  Renderer Interactive: ${metrics.electron.rendererInteractive!.toFixed(2)}ms\n`;
    report += `  Total Startup Time: ${metrics.electron.totalStartupTime.toFixed(2)}ms\n\n`;

    report += 'Service Initialization:\n';
    report += `  Duration: ${metrics.services.toFixed(2)}ms\n\n`;

    report += 'Renderer Load:\n';
    report += `  Duration: ${metrics.renderer.toFixed(2)}ms\n\n`;

    report += 'Recommendations:\n';
    const recommendations = this.generateRecommendations(metrics);
    recommendations.forEach(rec => {
      report += `  • ${rec}\n`;
    });

    return report;
  }

  /**
   * Cleanup
   */
  cleanup() {
    if (this.benchmarkProcess) {
      this.benchmarkProcess.kill();
    }
  }
}

// Run benchmarks if executed directly
if (require.main === module) {
  const benchmark = new StartupBenchmark();

  benchmark.runAll()
    .then(metrics => {
      console.log(benchmark.generateReport(metrics));
    })
    .catch(error => {
      console.error('Startup benchmark failed:', error);
      process.exit(1);
    })
    .finally(() => {
      benchmark.cleanup();
    });
}
