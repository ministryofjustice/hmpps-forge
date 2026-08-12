import DiagnosticErrorFormatter from './DiagnosticErrorFormatter'

export interface ForgeErrorDiagnostics {
  /** Human-readable path through the journey DSL */
  readonly formattedPath?: string
  /** Author callsite captured where the offending node was defined */
  readonly callsite?: { readonly stack?: string }
}

/**
 * Base class for every error the engine throws. Owns the diagnostic fields
 * shared across the family (`formattedPath`, `callsite`), stamps `name` from
 * the concrete class, and owns `stack` rendering: raw frames are captured once
 * at construction (with constructor frames trimmed) and the display string —
 * folded forge-internal frames, defined-at frames, diagnostics block — is
 * assembled lazily on first read, so errors that get caught and handled never
 * pay for formatting. The unfolded original stays reachable via the
 * non-enumerable `rawStack`, and `FORGE_FULL_STACK=1` renders every frame.
 */
export default abstract class ForgeBaseError extends Error {
  readonly formattedPath?: string

  readonly callsite?: { readonly stack?: string }

  declare readonly rawStack: string | undefined

  private readonly rawStackHolder: { stack?: string }

  protected constructor(message: string, diagnostics?: ForgeErrorDiagnostics) {
    super(message)
    this.name = new.target.name
    this.formattedPath = diagnostics?.formattedPath
    this.callsite = diagnostics?.callsite
    const canCapture = typeof Error.captureStackTrace === 'function'

    this.rawStackHolder = canCapture ? {} : { stack: this.stack }

    if (canCapture) {
      Error.captureStackTrace(this.rawStackHolder, new.target)
    }

    Object.defineProperty(this, 'stack', {
      get: () => this.renderStack(),
      set: (value: string | undefined) => {
        Object.defineProperty(this, 'stack', { value, writable: true, configurable: true, enumerable: false })
      },
      configurable: true,
      enumerable: false,
    })
    Object.defineProperty(this, 'rawStack', {
      get: () => this.renderRawStack(),
      configurable: true,
      enumerable: false,
    })
  }

  /** ForgeInternalError opts out: when the engine itself is broken, the internals are the story. */
  protected get foldsInternalStackFrames(): boolean {
    return true
  }

  /** The stack string whose frames form the rendered body — subclasses may substitute a cause's stack. */
  protected stackBodySource(): string | undefined {
    return this.rawStackHolder.stack
  }

  /** Definition-site frames rendered after the execution frames as `at [defined] ...` lines. */
  protected definedAtStackFrames(): string[] {
    return []
  }

  /** The `Forge diagnostics:` block appended after the frames, if the subclass carries one. */
  protected formatDiagnosticsBlock(): string | undefined {
    return undefined
  }

  private renderStack(): string {
    const frames = DiagnosticErrorFormatter.extractStackFrames(this.stackBodySource())
    const foldDisabled = process.env.FORGE_FULL_STACK === '1' || !this.foldsInternalStackFrames
    const frameLines = foldDisabled
      ? frames.map(frame => `    at ${frame}`)
      : DiagnosticErrorFormatter.foldStackFrames(frames)
    const definedLines = this.definedAtStackFrames().map(frame => `    at [defined] ${frame}`)
    const diagnosticsBlock = this.formatDiagnosticsBlock()

    const sections = [
      [`${this.name}: ${this.message}`, ...frameLines].join('\n'),
      definedLines.length > 0 ? definedLines.join('\n') : undefined,
      diagnosticsBlock,
    ].filter(section => section !== undefined)

    return sections.join('\n\n')
  }

  private renderRawStack(): string | undefined {
    const rawFrames = DiagnosticErrorFormatter.extractStackFrames(this.rawStackHolder.stack)

    return [`${this.name}: ${this.message}`, ...rawFrames.map(frame => `    at ${frame}`)].join('\n')
  }
}
