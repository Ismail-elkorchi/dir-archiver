/**
 * Stable dir-archiver error codes.
 */
export type DirArchiverErrorCode =
  | 'DIRARCHIVER_INVALID_SOURCE'
  | 'DIRARCHIVER_INVALID_DESTINATION'
  | 'DIRARCHIVER_PATH_TRAVERSAL'
  | 'DIRARCHIVER_UNSUPPORTED_ENTRY'
  | 'DIRARCHIVER_RESOURCE_LIMIT'
  | 'DIRARCHIVER_RUNTIME_UNSUPPORTED'
  | 'DIRARCHIVER_NORMALIZE_UNSUPPORTED'
  | 'DIRARCHIVER_USAGE';

/**
 * Structured error contract for dir-archiver v3.
 */
export class DirArchiverError extends Error {
  readonly code: DirArchiverErrorCode;
  readonly hint: string | undefined;
  readonly context: Record<string, unknown> | undefined;

  constructor(
    code: DirArchiverErrorCode,
    message: string,
    options: {
      hint?: string | undefined;
      context?: Record<string, unknown> | undefined;
      cause?: unknown;
    } = {}
  ) {
    super(message);
    this.name = 'DirArchiverError';
    this.code = code;
    this.hint = options.hint;
    this.context = options.context;
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }

  toJSON(): {
    schemaVersion: '1';
    name: 'DirArchiverError';
    code: DirArchiverErrorCode;
    message: string;
    hint?: string;
    context?: Record<string, unknown>;
  } {
    return {
      schemaVersion: '1',
      name: 'DirArchiverError',
      code: this.code,
      message: this.message,
      ...(this.hint ? { hint: this.hint } : {}),
      ...(this.context ? { context: this.context } : {})
    };
  }
}
