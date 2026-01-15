import { contextBridge, ipcRenderer } from 'electron';

// Type definitions for IPC channels
type IpcChannel =
  | 'window:minimize'
  | 'window:maximize'
  | 'window:close'
  | 'playbook:list'
  | 'playbook:load'
  | 'playbook:execute'
  | 'playbook:pause'
  | 'playbook:resume'
  | 'playbook:stop'
  | 'playbook:userAction'
  | 'playbook:skipVerification'
  // v2: DB 동기화 채널
  | 'playbook:sync:list'
  | 'playbook:sync:one'
  | 'playbook:sync:all'
  | 'playbook:sync:updated'
  | 'playbook:sync:status'
  | 'playbook:sync:cached'
  | 'playbook:sync:load'
  | 'chat:send'
  | 'auth:login'
  | 'auth:logout'
  | 'auth:getSession'
  | 'auth:refresh'
  | 'browser:highlight'
  | 'settings:updateUser'
  | 'settings:updateApp'
  | 'settings:reset'
  // Automation channels
  | 'automation:initialize'
  | 'automation:close'
  | 'automation:navigate'
  | 'automation:login'
  | 'automation:navigateMenu'
  | 'automation:click'
  | 'automation:fill'
  | 'automation:select'
  | 'automation:getPageState'
  | 'automation:screenshot'
  | 'automation:waitForElement'
  | 'automation:evaluate'
  // Recording channels
  | 'recording:start'
  | 'recording:stop'
  | 'recording:pause'
  | 'recording:resume'
  | 'recording:getState'
  | 'recording:getSteps'
  | 'recording:getActions'
  | 'recording:clear'
  | 'recording:deleteStep'
  | 'recording:updateStep'
  | 'recording:generatePlaybook'
  | 'recording:savePlaybook'
  // Supabase channels
  | 'supabase:initialize'
  | 'supabase:chat'
  // Credentials channels
  | 'credentials:set'
  | 'credentials:get'
  | 'credentials:delete'
  | 'credentials:has'
  | 'credentials:validate';

type IpcEventChannel =
  | 'playbook:step-changed'
  | 'playbook:status-changed'
  | 'playbook:completed'
  | 'playbook:error'
  | 'playbook:waiting-user'
  | 'playbook:verifying'
  | 'playbook:verify-result'
  | 'playbook:guide'
  | 'playbook:progress'
  // Recording events
  | 'recording:started'
  | 'recording:stopped'
  | 'recording:paused'
  | 'recording:resumed'
  | 'recording:action'
  | 'recording:error'
  | 'system:message'
  | 'error';

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electron', {
  // Invoke IPC handlers (request-response pattern)
  invoke: (channel: IpcChannel, ...args: unknown[]) => {
    return ipcRenderer.invoke(channel, ...args);
  },

  // Listen for events from main process
  on: (channel: IpcEventChannel, callback: (...args: unknown[]) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => {
      callback(...args);
    };
    ipcRenderer.on(channel, subscription);

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },

  // Remove event listener
  off: (channel: IpcEventChannel, callback: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, callback as never);
  },
});

// Type declarations for Window.electron are in src/electron.d.ts
