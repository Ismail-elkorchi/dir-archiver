/**
 * Stable machine-readable error-code names emitted or reserved by
 * `dir-archiver`.
 *
 * - `DIRARCHIVER_INVALID_SOURCE`: reserved for invalid source input. Some
 *   current filesystem and dependency source failures still surface as native
 *   errors.
 * - `DIRARCHIVER_INVALID_DESTINATION`: reserved for invalid destinations. Some
 *   current filesystem destination failures still surface as native errors.
 * - `DIRARCHIVER_PATH_TRAVERSAL`: extraction rejected an empty, absolute,
 *   drive-prefixed, `..`, out-of-root, or unsafe symlink-target path.
 * - `DIRARCHIVER_UNSUPPORTED_ENTRY`: an audit, entry type, link, or writer
 *   capability is unsupported by the wrapper policy.
 * - `DIRARCHIVER_RESOURCE_LIMIT`: extraction exceeded an explicit
 *   materialization byte limit.
 * - `DIRARCHIVER_RUNTIME_UNSUPPORTED`: the current JavaScript runtime is not a
 *   supported Node.js, Deno, or Bun environment.
 * - `DIRARCHIVER_NORMALIZE_UNSUPPORTED`: the opened archive reader does not
 *   expose normalization.
 * - `DIRARCHIVER_USAGE`: CLI invocation is missing required flags or uses
 *   unsupported values.
 *
 * Not every operational failure is converted into this code space. Consumers
 * must also handle native filesystem, network, cancellation, and dependency
 * errors.
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
 * This is the machine-readable error envelope used by the CLI for known
 * package failures and by API consumers that serialize `DirArchiverError`.
 */
export interface DirArchiverErrorJson {
  /** Schema version for the serialized error payload. */
  schemaVersion: '1';
  /** Stable error class name used in serialized output. */
  name: 'DirArchiverError';
  /** Stable machine-readable package code. */
  code: DirArchiverErrorCode;
  /** Human-readable summary; consumers should not parse this text. */
  message: string;
  /** Optional remediation hint when the error carries one. */
  hint?: string;
  /** Optional structured context for logs and diagnostics. */
  context?: Record<string, unknown>;
}

/**
 * Structured package error contract for dir-archiver v3.
 */
export class DirArchiverError extends Error {
  /** Stable machine-readable package code. */
  readonly code: DirArchiverErrorCode;
  /** Optional operator-facing remediation hint. */
  readonly hint: string | undefined;
  /** Optional structured context for logs, JSON output, or diagnostics. */
  readonly context: Record<string, unknown> | undefined;

  /**
   * Create a structured package error.
   *
   * @param code Stable machine-readable package code.
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
   * Serialize the error into the stable package JSON envelope.
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
