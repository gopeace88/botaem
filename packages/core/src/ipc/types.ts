import type { IPC_CHANNELS } from './channels';
import type {
  Playbook,
  PlaybookListItem,
  PlaybookCatalogItem,
  RecordedAction,
  IpcResult,
} from '../types';
import type { StepResult, RunnerState, RunnerEvent } from '../types/execution';

export interface IpcHandlerMap {
  [IPC_CHANNELS.PLAYBOOK.RUN]: {
    request: { playbook: Playbook; startUrl?: string };
    response: IpcResult<StepResult[]>;
  };
  [IPC_CHANNELS.PLAYBOOK.STOP]: {
    request: void;
    response: IpcResult<void>;
  };
  [IPC_CHANNELS.PLAYBOOK.LIST]: {
    request: void;
    response: IpcResult<PlaybookListItem[]>;
  };
  [IPC_CHANNELS.PLAYBOOK.SAVE]: {
    request: { playbook: Playbook; overwrite?: boolean };
    response: IpcResult<{ id: string }>;
  };
  [IPC_CHANNELS.PLAYBOOK.DELETE]: {
    request: { id: string };
    response: IpcResult<void>;
  };
  [IPC_CHANNELS.PLAYBOOK.GET]: {
    request: { id: string };
    response: IpcResult<Playbook>;
  };
  [IPC_CHANNELS.RECORDING.START]: {
    request: { url?: string };
    response: IpcResult<void>;
  };
  [IPC_CHANNELS.RECORDING.STOP]: {
    request: void;
    response: IpcResult<RecordedAction[]>;
  };
  [IPC_CHANNELS.RECORDING.PAUSE]: {
    request: void;
    response: IpcResult<void>;
  };
  [IPC_CHANNELS.RECORDING.RESUME]: {
    request: void;
    response: IpcResult<void>;
  };
  [IPC_CHANNELS.BROWSER.CONNECT]: {
    request: void;
    response: IpcResult<{ connected: boolean }>;
  };
  [IPC_CHANNELS.BROWSER.DISCONNECT]: {
    request: void;
    response: IpcResult<void>;
  };
  [IPC_CHANNELS.BROWSER.NAVIGATE]: {
    request: { url: string };
    response: IpcResult<void>;
  };
  [IPC_CHANNELS.BROWSER.STATUS]: {
    request: void;
    response: IpcResult<{ connected: boolean; url?: string }>;
  };
  [IPC_CHANNELS.RUNNER.STATE]: {
    request: void;
    response: IpcResult<RunnerState>;
  };
  [IPC_CHANNELS.CATALOG.SYNC]: {
    request: void;
    response: IpcResult<{ synced: number }>;
  };
  [IPC_CHANNELS.CATALOG.LIST]: {
    request: { category?: string };
    response: IpcResult<PlaybookCatalogItem[]>;
  };
  [IPC_CHANNELS.CATALOG.GET]: {
    request: { id: string };
    response: IpcResult<Playbook>;
  };
}

export interface IpcEventMap {
  [IPC_CHANNELS.RUNNER.EVENT]: RunnerEvent;
  [IPC_CHANNELS.RECORDING.EVENT]: {
    type: 'action_recorded' | 'error';
    action?: RecordedAction;
    error?: string;
  };
}

export type IpcChannel = keyof IpcHandlerMap;
