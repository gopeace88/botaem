# IPC Patterns Reference

## 개요
Electron Main Process와 Renderer Process 간 통신 패턴.

## 채널 정의

### 플레이북 관련

| 채널 | 방향 | 용도 |
|------|------|------|
| `playbook:run` | Renderer → Main | 플레이북 실행 시작 |
| `playbook:stop` | Renderer → Main | 실행 중지 |
| `playbook:pause` | Renderer → Main | 일시 정지 |
| `playbook:resume` | Renderer → Main | 재개 |
| `playbook:step-result` | Main → Renderer | 스텝 실행 결과 |
| `playbook:complete` | Main → Renderer | 실행 완료 |
| `playbook:error` | Main → Renderer | 에러 발생 |

### 녹화 관련

| 채널 | 방향 | 용도 |
|------|------|------|
| `recording:start` | Renderer → Main | 녹화 시작 |
| `recording:stop` | Renderer → Main | 녹화 중지 |
| `recording:action` | Main → Renderer | 녹화된 동작 |
| `recording:save` | Renderer → Main | 플레이북 저장 |

### 자동 고침 관련

| 채널 | 방향 | 용도 |
|------|------|------|
| `heal:request-manual` | Main → Renderer | 수동 고침 요청 |
| `heal:manual-select` | Renderer → Main | 사용자 선택 결과 |
| `heal:result` | Main → Renderer | 고침 결과 |

### Supabase 동기화

| 채널 | 방향 | 용도 |
|------|------|------|
| `catalog:sync` | Renderer → Main | 동기화 시작 |
| `catalog:sync-result` | Main → Renderer | 동기화 결과 |
| `catalog:fetch` | Renderer → Main | 카탈로그 조회 |

## 구현 패턴

### Main Process (ipcMain)

```typescript
// electron/main.ts

import { ipcMain } from 'electron';
import { PlaybookRunnerService } from './services/playbook-runner.service';

const runnerService = new PlaybookRunnerService();

// 단방향 리스너
ipcMain.on('playbook:run', async (event, playbook: Playbook) => {
  try {
    await runnerService.run(playbook, (result) => {
      event.sender.send('playbook:step-result', result);
    });
    event.sender.send('playbook:complete');
  } catch (error) {
    event.sender.send('playbook:error', error.message);
  }
});

// 양방향 핸들러 (invoke/handle)
ipcMain.handle('catalog:fetch', async () => {
  return await supabaseService.fetchCatalog();
});
```

### Renderer Process (ipcRenderer)

```typescript
// src/lib/ipc.ts

import { ipcRenderer } from 'electron';

export const playbookIPC = {
  run: (playbook: Playbook) => {
    ipcRenderer.send('playbook:run', playbook);
  },
  
  onStepResult: (callback: (result: StepResult) => void) => {
    ipcRenderer.on('playbook:step-result', (_, result) => callback(result));
  },
  
  onComplete: (callback: () => void) => {
    ipcRenderer.on('playbook:complete', () => callback());
  },
  
  // cleanup
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('playbook:step-result');
    ipcRenderer.removeAllListeners('playbook:complete');
    ipcRenderer.removeAllListeners('playbook:error');
  }
};
```

### Preload Script

```typescript
// electron/preload.ts

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  playbook: {
    run: (playbook) => ipcRenderer.send('playbook:run', playbook),
    stop: () => ipcRenderer.send('playbook:stop'),
    onStepResult: (callback) => ipcRenderer.on('playbook:step-result', (_, r) => callback(r)),
  },
  catalog: {
    fetch: () => ipcRenderer.invoke('catalog:fetch'),
  }
});
```

## 타입 정의

```typescript
// shared/types.ts

// Window 타입 확장
declare global {
  interface Window {
    electronAPI: {
      playbook: {
        run: (playbook: Playbook) => void;
        stop: () => void;
        onStepResult: (callback: (result: StepResult) => void) => void;
      };
      catalog: {
        fetch: () => Promise<Playbook[]>;
      };
    };
  }
}
```

## 에러 처리 패턴

```typescript
// Main Process
ipcMain.on('playbook:run', async (event, playbook) => {
  try {
    // ...
  } catch (error) {
    event.sender.send('playbook:error', {
      code: error.code || 'UNKNOWN',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Renderer Process
window.electronAPI.playbook.onError((error) => {
  useRunnerStore.getState().setError(error);
});
```
