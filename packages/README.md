# 보탬e Packages

Monorepo packages for the 보탬e project.

## Structure
- @botame/types - Type definitions
- @botame/player - Execution engine
- @botame/recorder - Recording engine (admin only)

## Building
```bash
pnpm -r build
```

## Development
```bash
# Install dependencies
pnpm install

# Build all packages
pnpm -r build

# Run tests
pnpm -r test

# Watch mode for development
pnpm -r dev
```