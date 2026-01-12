/**
 * Preload Script - Exposes safe IPC API to renderer
 */

import { contextBridge, ipcRenderer } from 'electron';

// Types for exposed API
type IpcCallback = (...args: unknown[]) => void;

const electronAPI = {
  // Invoke main process handlers
  invoke: (channel: string, ...args: unknown[]) => {
    const validChannels = [
      'window:minimize',
      'window:maximize',
      'window:close',
      'playbook:list',
      'playbook:load',
      'playbook:save',
      'playbook:delete',
      'playbook:export',
      'playbook:import',
      'recording:start',
      'recording:stop',
      'recording:pause',
      'recording:resume',
      'recording:getState',
      'recording:getSteps',
      'recording:clear',
      'recording:deleteStep',
      'recording:generatePlaybook',
      'supabase:configure',
      'supabase:getStatus',
      'supabase:upload',
      'supabase:uploadAll',
      'supabase:listRemote',
      'supabase:download',
      'supabase:deleteRemote',
      'supabase:getCatalog',
      'supabase:getPlaybook',
      'supabase:updatePlaybook',
      'browser:highlight',
      'browser:clearHighlight',
      'runner:run',
      'runner:runFromCatalog',
      'runner:pause',
      'runner:resume',
      'runner:stop',
      'runner:closeBrowser',
      'runner:getState',
      'runner:runStep',
      'runner:pickElement',
      'runner:cancelPicking',
      // Config (프로필 관리)
      'config:getProfile',
      'config:setProfile',
      'config:listProfiles',
      'config:getUrl',
      'config:getCategories',
    ];

    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    throw new Error(`Invalid channel: ${channel}`);
  },

  // Subscribe to events from main process
  on: (channel: string, callback: IpcCallback) => {
    const validChannels = ['recording:event', 'runner:event', 'supabase:connected'];

    if (validChannels.includes(channel)) {
      const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
        callback(...args);
      ipcRenderer.on(channel, subscription);

      // Return unsubscribe function
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    }
    throw new Error(`Invalid channel: ${channel}`);
  },
};

contextBridge.exposeInMainWorld('electron', electronAPI);

// TypeScript declaration for renderer
declare global {
  interface Window {
    electron: typeof electronAPI;
  }
}
