import DiagnosticErrorFormatter from './DiagnosticErrorFormatter'
import ForgeBaseError from './ForgeBaseError'

interface ForgeRuntimeEvaluationErrorOptions {
  readonly phase: string
  readonly cause: unknown
  readonly nodeId?: string
  readonly formattedPath?: string
  readonly functionName?: string
  readonly functionType?: string
  readonly definedAt?: string
}

export interface ForgeRuntimeEvaluationDiagnostics {
  readonly phase: string
  readonly nodeId?: string
  readonly formattedPath?: string
  readonly functionName?: string
  readonly functionType?: string
  readonly definedAt?: string
}

export const FORGE_RUNTIME_EVALUATION_DIAGNOSTICS = Symbol.for('hmpps-forge.runtimeEvaluationDiagnostics')

/**
 * Wraps a failure thrown while evaluating a compiled forge function. The
 * author's error stays pristine on `cause`; this wrapper renders the combined
 * story — the cause's author frames, folded forge frames, defined-at frames,
 * and the diagnostics block. `definedAt` holds the newline-joined defined-at
 * chain, innermost frame first.
 */
export default class ForgeRuntimeEvaluationError extends ForgeBaseError {
  readonly phase: string

  /** Mirrored from the cause so host error middleware keeps reading the author's HTTP status */
  readonly status?: number

  readonly statusCode?: number

  readonly nodeId?: string

  readonly functionName?: string

  readonly functionType?: string

  readonly definedAt?: string

  readonly cause: unknown

  constructor(options: ForgeRuntimeEvaluationErrorOptions) {
    super(buildMessage(options), options)
    this.phase = options.phase
    this.nodeId = options.nodeId
    this.functionName = options.functionName
    this.functionType = options.functionType
    this.definedAt = options.definedAt
    this.cause = options.cause
    this.status = readHttpStatus(options.cause)
    this.statusCode = this.status
    Object.defineProperty(this, FORGE_RUNTIME_EVALUATION_DIAGNOSTICS, {
      value: {
        phase: options.phase,
        nodeId: options.nodeId,
        formattedPath: options.formattedPath,
        functionName: options.functionName,
        functionType: options.functionType,
        definedAt: options.definedAt,
      } satisfies ForgeRuntimeEvaluationDiagnostics,
    })
  }

  protected override stackBodySource(): string | undefined {
    return this.cause instanceof Error ? (this.cause.stack ?? super.stackBodySource()) : super.stackBodySource()
  }

  protected override definedAtStackFrames(): string[] {
    return this.definedAt?.split('\n') ?? []
  }

  protected override formatDiagnosticsBlock(): string {
    return DiagnosticErrorFormatter.formatRuntimeDiagnostics({
      phase: this.phase,
      formattedPath: this.formattedPath,
      functionName: this.functionName,
      functionType: this.functionType,
    })
  }
}

const readHttpStatus = (cause: unknown): number | undefined => {
  if (cause === null || typeof cause !== 'object') {
    return undefined
  }

  const { status, statusCode } = cause as { status?: unknown; statusCode?: unknown }

  if (typeof status === 'number') {
    return status
  }

  return typeof statusCode === 'number' ? statusCode : undefined
}

const buildMessage = (options: ForgeRuntimeEvaluationErrorOptions): string => {
  const base = `Failed to evaluate compiled Forge ${options.phase} function`

  return options.cause instanceof Error ? `${base}: ${options.cause.message}` : base
}

export const getForgeRuntimeEvaluationDiagnostics = (error: Error): ForgeRuntimeEvaluationDiagnostics | undefined => {
  const diagnostics: unknown = Reflect.get(error, FORGE_RUNTIME_EVALUATION_DIAGNOSTICS)

  if (!isForgeRuntimeEvaluationDiagnostics(diagnostics)) {
    return undefined
  }

  return diagnostics
}

const isForgeRuntimeEvaluationDiagnostics = (value: unknown): value is ForgeRuntimeEvaluationDiagnostics => {
  return value !== null &&
    value !== undefined &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).phase === 'string'
}
