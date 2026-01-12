---
name: electron-react
description: Electron + React 개발 패턴. Use when (1) IPC 통신 구현, (2) Main/Renderer 프로세스 작업, (3) Zustand 상태 관리, (4) Electron 빌드/패키징.
---
# Electron + React Development Patterns

## 아키텍처 개요

```
┌─────────────────────────────────────────────┐
│                  Electron                   │
├─────────────────┬───────────────────────────┤
│  Main Process   │     Renderer Process      │
│  (Node.js)      │     (Chromium)            │
├─────────────────┼───────────────────────────┤
│ - 시스템 API    │ - React UI               │
│ - 파일 시스템   │ - Zustand 상태관리        │
│ - Playwright    │ - IPC 클라이언트          │
│ - IPC 핸들러    │                           │
└─────────────────┴───────────────────────────┘
         │ contextBridge │
         └───────────────┘
```

## 프로젝트 구조

```
botame-admin/
├── electron/                 # Main Process
│   ├── main.ts              # 앱 진입점
│   ├── preload.ts           # Preload 스크립트
│   ├── services/            # 비즈니스 로직
│   │   ├── playbook-runner.service.ts
│   │   ├── recording.service.ts
│   │   └── supabase.service.ts
│   └── core/                # 핵심 유틸리티
│       └── self-healing.ts
├── src/                     # Renderer Process
│   ├── App.tsx
│   ├── components/          # React 컴포넌트
│   ├── stores/              # Zustand 스토어
│   ├── hooks/               # 커스텀 훅
│   └── lib/                 # 유틸리티
└── shared/                  # 공유 타입
    └── types.ts
```

## IPC 통신 패턴

### Main Process

```typescript
// electron/main.ts
import { ipcMain } from 'electron';

// 단방향 (fire-and-forget)
ipcMain.on('channel', (event, data) => {
  // 처리 후 응답
  event.sender.send('channel-response', result);
});

// 양방향 (request-response)
ipcMain.handle('channel', async (event, data) => {
  return await someAsyncOperation(data);
});
```

### Preload Script

```typescript
// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  send: (channel: string, data: any) => ipcRenderer.send(channel, data),
  invoke: (channel: string, data: any) => ipcRenderer.invoke(channel, data),
  on: (channel: string, callback: Function) => {
    ipcRenderer.on(channel, (_, ...args) => callback(...args));
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
});
```

### Renderer Process

```typescript
// src/lib/api.ts
export const api = {
  playbook: {
    run: (playbook: Playbook) => window.api.send('playbook:run', playbook),
    onResult: (cb: (r: StepResult) => void) => window.api.on('playbook:result', cb)
  }
};
```

## Zustand 상태 관리

### 기본 패턴

```typescript
// src/stores/runner.store.ts
import { create } from 'zustand';

interface RunnerState {
  status: 'idle' | 'running' | 'paused' | 'error';
  currentStep: number;
  results: StepResult[];
  error: string | null;
  
  // Actions
  setStatus: (status: RunnerState['status']) => void;
  addResult: (result: StepResult) => void;
  reset: () => void;
}

export const useRunnerStore = create<RunnerState>((set) => ({
  status: 'idle',
  currentStep: 0,
  results: [],
  error: null,
  
  setStatus: (status) => set({ status }),
  addResult: (result) => set((state) => ({ 
    results: [...state.results, result],
    currentStep: result.stepIndex + 1
  })),
  reset: () => set({ status: 'idle', currentStep: 0, results: [], error: null })
}));
```

### 컴포넌트에서 사용

```typescript
// src/components/runner/RunnerPanel.tsx
import { useRunnerStore } from '@/stores/runner.store';

export function RunnerPanel() {
  const { status, currentStep, results } = useRunnerStore();
  const setStatus = useRunnerStore((s) => s.setStatus);
  
  // ...
}
```

## 에러 처리 패턴

### Main Process

```typescript
ipcMain.handle('playbook:run', async (event, playbook) => {
  try {
    return { success: true, data: await runner.run(playbook) };
  } catch (error) {
    return { 
      success: false, 
      error: { 
        code: error.code || 'UNKNOWN',
        message: error.message 
      }
    };
  }
});
```

### Renderer Process

```typescript
const result = await window.api.invoke('playbook:run', playbook);
if (!result.success) {
  useRunnerStore.getState().setError(result.error.message);
  return;
}
```

## 빌드 설정

### electron-builder.json

```json
{
  "appId": "com.botame.admin",
  "productName": "보탬e Admin",
  "directories": {
    "output": "dist"
  },
  "files": [
    "build/**/*",
    "electron/**/*"
  ],
  "win": {
    "target": "nsis"
  }
}
```

## References
- `references/ipc-best-practices.md` - IPC 상세 가이드
- `references/zustand-patterns.md` - Zustand 고급 패턴
