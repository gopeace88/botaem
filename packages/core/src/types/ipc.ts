export interface IpcResult<T = unknown> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}
