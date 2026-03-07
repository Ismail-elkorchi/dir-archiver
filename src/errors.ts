/**
 * Stable machine-readable error codes emitted by `dir-archiver`.
 *
 * - `DIRARCHIVER_INVALID_SOURCE`: input bytes or paths could not be read.
 * - `DIRARCHIVER_INVALID_DESTINATION`: destination path or parent directory is
 * invalid for the requested operation.
 * - `DIRARCHIVER_PATH_TRAVERSAL`: strict extraction rejected a traversal or
 * absolute-path entry.
 * - `DIRARCHIVER_UNSUPPORTED_ENTRY`: the archive contains an entry type or
 * feature that `dir-archiver` does not support safely.
 * - `DIRARCHIVER_RESOURCE_LIMIT`: extraction exceeded configured byte limits.
 * - `DIRARCHIVER_RUNTIME_UNSUPPORTED`: the current runtime cannot satisfy a
 * required bytefold capability.
 * - `DIRARCHIVER_NORMALIZE_UNSUPPORTED`: normalization is unavailable for the
 * selected format/runtime pair.
 * - `DIRARCHIVER_USAGE`: CLI invocation is missing required flags or uses
 * unsupported values.
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
 * Stable JSON payload emitted by `DirArchiverError.toJSON()`.
 *
 * This is the machine-readable error shape used by the CLI `--json` surface and
 * by API consumers that persist `DirArchiverError` objects to logs or reports.
 */
export interface DirArchiverErrorJson {
  /** Schema version for the serialized error payload. */
  schemaVersion: '1';
  /** Stable error class name used in serialized output. */
  name: 'DirArchiverError';
  /** Stable machine-readable error code. */
  code: DirArchiverErrorCode;
  /** Human-readable summary of the failure. */
  message: string;
  /** Optional remediation hint when the error carries one. */
  hint?: string;
  /** Optional structured context for logs and diagnostics. */
  context?: Record<string, unknown>;
}

/**
 * Structured error contract for dir-archiver v3.
 */
export class DirArchiverError extends Error {
  /** Stable machine-readable error code. */
  readonly code: DirArchiverErrorCode;
  /** Optional operator-facing hint for remediation. */
  readonly hint: string | undefined;
  /** Optional structured context for logs, JSON output, or diagnostics. */
  readonly context: Record<string, unknown> | undefined;

  /**
   * Creates a structured error value safe for CLI and API consumers.
   *
   * @param code Stable machine-readable error code.
   * @param message Human-readable summary of the failure.
   * @param options Optional hint, structured context, and nested cause.
   */
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

  /**
   * Serializes the error into the stable JSON shape used by the CLI.
   *
   * The returned object always includes `schemaVersion`, `name`, `code`, and
   * `message`. Optional `hint` and `context` keys are omitted when unset.
   */
  toJSON(): DirArchiverErrorJson {
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
