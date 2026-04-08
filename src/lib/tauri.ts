import { invoke } from '@tauri-apps/api/core';

export interface AppErrorPayload {
  code: string;
  message: string;
}

function toAppErrorPayload(error: unknown): AppErrorPayload {
  if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
    const candidate = error as Record<string, unknown>;
    if (typeof candidate.code === 'string' && typeof candidate.message === 'string') {
      return {
        code: candidate.code,
        message: candidate.message,
      };
    }
  }

  if (error instanceof Error) {
    return {
      code: 'UNEXPECTED_TAURI_ERROR',
      message: error.message,
    };
  }

  return {
    code: 'UNEXPECTED_TAURI_ERROR',
    message: String(error),
  };
}

export async function invokeTauri<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw toAppErrorPayload(error);
  }
}
