/**
 * Stable machine-readable error-code names emitted by `dir-archiver`.
 *
 * - `DIRARCHIVER_PATH_TRAVERSAL`: extraction rejected an empty, absolute,
 *   drive-prefixed, `..`, out-of-root, or unsafe symlink-target path.
 * - `DIRARCHIVER_UNSUPPORTED_ENTRY`: an audit, entry type, or link is
 *   unsupported by package policy.
 * - `DIRARCHIVER_RESOURCE_LIMIT`: extraction exceeded an explicit
 *   materialization byte limit.
 * - `DIRARCHIVER_NORMALIZE_UNSUPPORTED`: the opened archive reader does not
 *   expose normalization.
 * Not every operational failure is converted into this code space. Consumers
 * must also handle native filesystem, network, cancellation, and dependency
 * errors.
 */
export type DirArchiverErrorCode =
  | 'DIRARCHIVER_PATH_TRAVERSAL'
  | 'DIRARCHIVER_UNSUPPORTED_ENTRY'
  | 'DIRARCHIVER_RESOURCE_LIMIT'
  | 'DIRARCHIVER_NORMALIZE_UNSUPPORTED';

/**
 * Stable JSON payload emitted by `DirArchiverError.toJSON()`.
 *
 * This is the machine-readable error envelope used by the CLI for known
 * package failures and by API consumers that serialize `DirArchiverError`.
 */
export type DirArchiverErrorJson = {
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
};

/**
 * Structured package error contract.
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
    super(
      message,
      options.cause === undefined ? undefined : { cause: options.cause }
    );
    this.name = 'DirArchiverError';
    this.code = code;
    this.hint = options.hint;
    this.context = options.context;
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
      ...(this.hint === undefined ? {} : { hint: this.hint }),
      ...(this.context === undefined ? {} : { context: this.context })
    };
  }
}
