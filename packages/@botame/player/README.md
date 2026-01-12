# @botame/player

Playbook execution engine for 보탬e.

## Overview
Shared playbook execution engine used by both admin and guide apps.

## Installation
```bash
# guide-app (fixed version for stability)
pnpm add @botame/player@2.1.0

# admin (caret version for flexibility)
pnpm add @botame/player@^2.1.0
```

## Usage
```typescript
import { PlaybookEngine } from '@botame/player';
```

## Architecture
- Framework-agnostic via BrowserAdapter interface
- Each app implements its own adapter (Playwright, etc.)
- Player only knows about the interface, not the implementation

## License
MIT