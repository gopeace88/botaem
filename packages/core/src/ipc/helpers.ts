import type { IpcHandlerMap, IpcEventMap, IpcChannel } from './types';

interface IpcRenderer {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  on(channel: string, listener: (...args: unknown[]) => void): void;
  removeListener(channel: string, listener: (...args: unknown[]) => void): void;
}

interface IpcMain {
  handle(
    channel: string,
    listener: (event: unknown, ...args: unknown[]) => Promise<unknown> | unknown
  ): void;
  removeHandler(channel: string): void;
}

export function createTypedInvoke(ipcRenderer: IpcRenderer) {
  return async function invoke<C extends IpcChannel>(
    channel: C,
    request: IpcHandlerMap[C]['request']
  ): Promise<IpcHandlerMap[C]['response']> {
    return ipcRenderer.invoke(channel, request) as Promise<IpcHandlerMap[C]['response']>;
  };
}

export function createTypedHandle(ipcMain: IpcMain) {
  return function handle<C extends IpcChannel>(
    channel: C,
    handler: (
      event: unknown,
      request: IpcHandlerMap[C]['request']
    ) => Promise<IpcHandlerMap[C]['response']>
  ): void {
    ipcMain.handle(channel, (event, ...args) => handler(event, args[0] as IpcHandlerMap[C]['request']));
  };
}

export function createTypedOn(ipcRenderer: IpcRenderer) {
  return function on<C extends keyof IpcEventMap>(
    channel: C,
    listener: (event: unknown, data: IpcEventMap[C]) => void
  ): () => void {
    const wrappedListener = (_event: unknown, data: unknown) => {
      listener(_event, data as IpcEventMap[C]);
    };
    ipcRenderer.on(channel, wrappedListener);
    return () => ipcRenderer.removeListener(channel, wrappedListener);
  };
}
