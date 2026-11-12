/**
 * Standard IPC response envelope.
 *
 * Every IPC handler returns ApiResponse<T>.  The renderer checks
 * `result.success` before reading `result.data`, giving a single
 * consistent pattern for success and business errors.
 */

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    /** Machine-readable error category (e.g. VALIDATION, NOT_FOUND, DB_ERROR) */
    code: string;
    /** Human-readable message suitable for display */
    message: string;
    /** Field-level validation errors keyed by field name */
    fields?: Record<string, string[]>;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ── Helper constructors used in backend services and IPC handlers ──────────

export function ok<T>(data: T): ApiSuccess<T> {
  return { success: true, data };
}

export function fail(
  code: string,
  message: string,
  fields?: Record<string, string[]>,
): ApiError {
  return { success: false, error: { code, message, fields } };
}

export function exception(err: unknown, fallbackMessage: string): ApiError {
  const message = err instanceof Error ? `${fallbackMessage}: ${err.message}` : fallbackMessage;
  return fail('SERVER_ERROR', message);
}
