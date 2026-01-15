# E2E Tests

This directory contains end-to-end tests for botame-admin using Playwright.

## Prerequisites

- Node.js 20+
- pnpm 8+

## Setup

```bash
# Install dependencies
pnpm install

# Install Playwright browsers
pnpm exec playwright install --with-deps
```

## Running Tests

### Run all E2E tests
```bash
pnpm run test:e2e
```

### Run tests in UI mode (interactive)
```bash
pnpm run test:e2e:ui
```

### Run tests in debug mode
```bash
pnpm run test:e2e:debug
```

### Run tests with visible browser
```bash
pnpm run test:e2e:headed
```

### View test report
```bash
pnpm run test:e2e:report
```

## Test Structure

```
e2e/
├── fixtures/          # Test fixtures and setup
│   └── base.fixture.ts
├── helpers/           # Helper functions for tests
│   ├── playbook.helpers.ts
│   └── test.helpers.ts
└── tests/            # Test suites
    ├── playbook.spec.ts      # Playbook CRUD operations
    ├── recording.spec.ts     # Recording flow tests
    ├── runner.spec.ts        # Playbook execution tests
    ├── offline.spec.ts       # Offline mode tests
    └── supabase.spec.ts      # Cloud sync tests
```

## Writing Tests

### Example Test

```typescript
import { test, expect } from '../fixtures/base.fixture';

test('should do something', async ({ authenticatedPage }) => {
  // Your test code here
  await authenticatedPage.click('[data-testid="some-button"]');
  await expect(authenticatedPage.locator('[data-testid="result"]')).toBeVisible();
});
```

### Best Practices

1. **Use data-testid attributes**: All test selectors should use `data-testid` for stability
2. **Wait for elements**: Use `waitForSelector` for dynamic content
3. **Clean up**: Use `beforeEach` and `afterEach` hooks for setup/teardown
4. **Mock external services**: Use test helpers to mock Supabase, browser service, etc.

## Environment Variables

Create a `.env.test` file:

```bash
# Test API Keys (optional, will use test defaults if not provided)
TEST_ANTHROPIC_API_KEY=sk-ant-test-...
TEST_SUPABASE_KEY=eyJhbGci-test...

# Test Supabase (optional)
TEST_SUPABASE_URL=https://your-project.supabase.co
```

## Continuous Integration

Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches
- Daily schedule at 2 AM KST

## Troubleshooting

### Tests fail with "browser not launched"
Make sure Playwright browsers are installed:
```bash
pnpm exec playwright install --with-deps
```

### Tests timeout
Increase timeout in `playwright.config.ts` or use `test.setTimeout()`.

### Flaky tests
Use Playwright's auto-waiting features and avoid hard-coded delays.
