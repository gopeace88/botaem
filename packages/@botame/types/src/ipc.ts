/**
 * IPC Types - IPC 공통 타입
 * @module @botame/types/ipc
 */

/** IPC 결과 */
export interface IpcResult<T = unknown> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}

/** IPC 채널 */
export type IpcChannel =
  | "playbook:execute"
  | "playbook:stop"
  | "playbook:pause"
  | "playbook:resume"
  | "recording:start"
  | "recording:stop"
  | "recording:pause"
  | "browser:navigate"
  | "browser:click"
  | "supabase:sync";
