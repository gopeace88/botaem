# @botame/types

Shared type definitions for 보탬e project.

## Overview
This package contains all shared TypeScript types used across botame-admin and botame-guide-app.

## Installation
```bash
pnpm add @botame/types
```

## Usage
```typescript
import { Playbook, PlaybookStep } from '@botame/types';
```

## Modules
- `playbook` - Playbook and step definitions
- `selector` - Selector and healing types
- `execution` - Execution context and results
- `healing` - Self-healing types
- `recording` - Recording types
- `ipc` - IPC types

## Versioning
- Major: Breaking changes (removed/renamed types)
- Minor: New optional fields (backward compatible)
- Patch: Bug fixes, documentation updates