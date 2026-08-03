export interface ForgeErrorDiagnostics {
  /** Human-readable path through the journey DSL */
  readonly formattedPath?: string
  /** Author callsite captured where the offending node was defined */
  readonly callsite?: { readonly stack?: string }
}

/**
 * Base class for every error the engine throws. Owns the diagnostic fields
 * shared across the family (`formattedPath`, `callsite`), stamps `name` from
 * the concrete class, and trims the constructor frames off the stack trace.
 */
export default abstract class ForgeBaseError extends Error {
  readonly formattedPath?: string

  readonly callsite?: { readonly stack?: string }

  protected constructor(message: string, diagnostics?: ForgeErrorDiagnostics) {
    super(message)
    this.name = new.target.name
    this.formattedPath = diagnostics?.formattedPath
    this.callsite = diagnostics?.callsite

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, new.target)
    }
  }
}
