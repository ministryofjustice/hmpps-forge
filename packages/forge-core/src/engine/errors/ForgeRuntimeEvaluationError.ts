import DiagnosticErrorFormatter from '../diagnostics/DiagnosticErrorFormatter'
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

export default class ForgeRuntimeEvaluationError extends ForgeBaseError {
  readonly phase: string

  readonly nodeId?: string

  readonly functionName?: string

  readonly functionType?: string

  readonly definedAt?: string

  readonly cause: unknown

  constructor(options: ForgeRuntimeEvaluationErrorOptions) {
    super(`Failed to evaluate compiled Forge ${options.phase} function`, options)
    this.phase = options.phase
    this.nodeId = options.nodeId
    this.functionName = options.functionName
    this.functionType = options.functionType
    this.definedAt = options.definedAt
    this.cause = options.cause
    this.stack = DiagnosticErrorFormatter.appendRuntimeDiagnostics(this.stack, {
      phase: this.phase,
      nodeId: this.nodeId,
      formattedPath: this.formattedPath,
      functionName: this.functionName,
      functionType: this.functionType,
      definedAt: this.definedAt,
    })
  }
}

export const decorateForgeRuntimeEvaluationError = (
  error: Error,
  diagnostics: ForgeRuntimeEvaluationDiagnostics,
): Error => {
  if (getForgeRuntimeEvaluationDiagnostics(error) !== undefined) {
    return error
  }

  Object.defineProperty(error, FORGE_RUNTIME_EVALUATION_DIAGNOSTICS, {
    value: diagnostics,
  })

  error.stack = DiagnosticErrorFormatter.appendRuntimeDiagnostics(error.stack, diagnostics)

  return error
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
