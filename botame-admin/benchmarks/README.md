# Performance Benchmarks

This directory contains performance benchmarks for botame-admin.

## Running Benchmarks

### Run all benchmarks
```bash
pnpm run benchmark:all
```

### Run specific benchmarks
```bash
# Playbook execution performance
pnpm run benchmark

# Startup time
pnpm run benchmark:startup
```

## Benchmark Suites

### 1. Playbook Execution Benchmark

Measures:
- Playbook load time from disk
- Step execution speed (10 steps)
- Auto-healing performance
- Browser launch time
- Memory usage (100 playbooks)

**Thresholds:**
- Playbook Load: < 1 second
- Execution (10 steps): < 30 seconds
- Auto-Healing: < 5 seconds
- Browser Startup: < 10 seconds
- Memory (100 playbooks): < 100MB

### 2. Startup Time Benchmark

Measures:
- Main process initialization
- Renderer load time
- Service initialization
- Total time to interactive

**Thresholds:**
- Total Startup: < 5 seconds
- Service Init: < 1 second
- Renderer Load: < 500ms

## Interpreting Results

### Pass/Fail Criteria

Each benchmark has a threshold. If the actual time exceeds the threshold, the test **FAILS**.

Example:
```
✓ PASS Playbook Load
  Duration: 450.23ms (threshold: 1000ms)
```

```
✗ FAIL Browser Startup
  Duration: 12500.00ms (threshold: 10000ms)
```

### Memory Metrics

Memory is measured in MB (megabytes). Delta shows the increase during the benchmark.

```
Memory: +45.23MB
Before: 125.50MB, After: 170.73MB
```

## Performance Optimization Tips

### Slow Startup (> 5s)

1. **Lazy load services**: Initialize services on-demand instead of at startup
2. **Defer non-critical initialization**: Move optional features to background
3. **Optimize imports**: Use dynamic imports for large modules

### Slow Execution (> 30s for 10 steps)

1. **Profile bottlenecks**: Use Chrome DevTools Profiler
2. **Optimize selectors**: Use efficient CSS selectors
3. **Reduce waits**: Use smart waits instead of fixed timeouts
4. **Parallel operations**: Run independent steps concurrently when possible

### High Memory Usage (> 100MB for 100 playbooks)

1. **Implement caching**: LRU cache for frequently accessed playbooks
2. **Virtualize lists**: Only render visible items in lists
3. **Clean up resources**: Explicitly release unused objects
4. **Use streams**: Process large files in chunks

## Continuous Integration

Benchmarks run automatically on:
- Pull requests to `main` branch
- Before releases

Performance regression is detected if:
- Any benchmark degrades by > 20%
- Memory usage increases by > 20%

## Custom Benchmarks

To add a new benchmark:

```typescript
// benchmarks/my-benchmark.bench.ts
import { performance } from 'perf_hooks';

export class MyBenchmark {
  async run(): Promise<BenchmarkResult> {
    const start = performance.now();

    // Your benchmark code here

    const duration = performance.now() - start;

    return {
      name: 'My Benchmark',
      duration,
      passed: duration < 1000,
      threshold: 1000,
    };
  }
}
```

Then add a script to `package.json`:

```json
{
  "scripts": {
    "benchmark:my": "node -r esbuild-runner/register benchmarks/my-benchmark.bench.ts"
  }
}
```

## Troubleshooting

### Benchmarks are inconsistent

- Close other applications
- Run multiple times and average results
- Ensure thermal throttling isn't active

### Memory usage seems wrong

- Force GC before benchmark: `if (global.gc) global.gc()`
- Run in isolation (no other Node processes)
- Check for memory leaks in test code

### Benchmarks timeout

- Increase timeout in benchmark code
- Check for infinite loops or deadlocks
- Verify external services are available
