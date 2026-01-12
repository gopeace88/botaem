export const IPC_CHANNELS = {
  PLAYBOOK: {
    RUN: 'playbook:run',
    STOP: 'playbook:stop',
    LIST: 'playbook:list',
    SAVE: 'playbook:save',
    DELETE: 'playbook:delete',
    GET: 'playbook:get',
  },
  RECORDING: {
    START: 'recording:start',
    STOP: 'recording:stop',
    PAUSE: 'recording:pause',
    RESUME: 'recording:resume',
    EVENT: 'recording:event',
  },
  BROWSER: {
    CONNECT: 'browser:connect',
    DISCONNECT: 'browser:disconnect',
    NAVIGATE: 'browser:navigate',
    STATUS: 'browser:status',
  },
  RUNNER: {
    EVENT: 'runner:event',
    STATE: 'runner:state',
  },
  CATALOG: {
    SYNC: 'catalog:sync',
    LIST: 'catalog:list',
    GET: 'catalog:get',
  },
} as const;

type ExtractChannelValues<T> = T extends Record<string, infer V>
  ? V extends string
    ? V
    : V extends Record<string, string>
      ? V[keyof V]
      : never
  : never;

export type IpcChannelPath = ExtractChannelValues<typeof IPC_CHANNELS>;
