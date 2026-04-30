import type { DSLPathSegment } from '../diagnostics/sourceMetadata'
import formatDiagnosticStack from './formatDiagnosticStack'

interface ForgeRuntimeEvaluationErrorOptions {
  readonly phase: string
  readonly cause: unknown
  readonly nodeId?: string
  readonly path?: readonly DSLPathSegment[]
  readonly formattedPath?: string
  readonly functionName?: string
  readonly functionType?: string
}

export interface ForgeRuntimeEvaluationDiagnostics {
  readonly phase: string
  readonly nodeId?: string
  readonly path?: readonly DSLPathSegment[]
  readonly formattedPath?: string
  readonly functionName?: string
  readonly functionType?: string
}

export const FORGE_RUNTIME_EVALUATION_DIAGNOSTICS = Symbol.for('hmpps-forge.runtimeEvaluationDiagnostics')

export default class ForgeRuntimeEvaluationError extends Error {
  readonly phase: string

  readonly nodeId?: string

  readonly path?: readonly DSLPathSegment[]

  readonly formattedPath?: string

  readonly functionName?: string

  readonly functionType?: string

  readonly cause: unknown

  constructor(options: ForgeRuntimeEvaluationErrorOptions) {
    super(`Failed to evaluate compiled Forge ${options.phase} function`)
    this.name = new.target.name
    this.phase = options.phase
    this.nodeId = options.nodeId
    this.path = options.path
    this.formattedPath = options.formattedPath
    this.functionName = options.functionName
    this.functionType = options.functionType
    this.cause = options.cause
    this.stack = formatDiagnosticStack(this)
  }

  toString(): string {
    return formatForgeDiagnosticError(this.name, this.message, [
      { label: 'Phase', value: this.phase },
      { label: 'Path', value: this.formattedPath ?? formatPath(this.path) },
      { label: 'Node', value: this.nodeId },
      { label: 'Function', value: this.functionName },
      { label: 'Type', value: this.functionType },
      { label: 'Cause', value: formatCause(this.cause) },
    ])
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

  error.stack = appendForgeDiagnosticsToStack(error.stack, diagnostics)

  return error
}

export const getForgeRuntimeEvaluationDiagnostics = (error: Error): ForgeRuntimeEvaluationDiagnostics | undefined => {
  const diagnostics: unknown = Reflect.get(error, FORGE_RUNTIME_EVALUATION_DIAGNOSTICS)

  if (!isForgeRuntimeEvaluationDiagnostics(diagnostics)) {
    return undefined
  }

  return diagnostics
}

interface DiagnosticField {
  readonly label: string
  readonly value: string | undefined
}

const formatForgeDiagnosticError = (name: string, message: string, fields: readonly DiagnosticField[]): string => {
  const formattedFields = fields
    .filter(field => field.value !== undefined)
    .map(field => `  ${field.label}: ${field.value}`)

  return [`${name}: ${message}`, ...formattedFields].join('\n')
}

const appendForgeDiagnosticsToStack = (
  stack: string | undefined,
  diagnostics: ForgeRuntimeEvaluationDiagnostics,
): string | undefined => {
  if (stack === undefined) {
    return undefined
  }

  return `${stack}\n\n${formatForgeRuntimeDiagnostics(diagnostics)}`
}

const formatForgeRuntimeDiagnostics = (diagnostics: ForgeRuntimeEvaluationDiagnostics): string => {
  const formattedFields = [
    { label: 'Phase', value: diagnostics.phase },
    { label: 'Path', value: diagnostics.formattedPath ?? formatPath(diagnostics.path) },
    { label: 'Node', value: diagnostics.nodeId },
    { label: 'Function', value: diagnostics.functionName },
    { label: 'Type', value: diagnostics.functionType },
  ]
    .filter(field => field.value !== undefined)
    .map(field => `  ${field.label}: ${field.value}`)

  return ['Forge diagnostics:', ...formattedFields].join('\n')
}

const formatPath = (path: readonly DSLPathSegment[] | undefined): string | undefined => {
  if (path === undefined) {
    return undefined
  }

  return path.length > 0 ? path.map(segment => String(segment)).join('.') : 'root'
}

const formatCause = (cause: unknown): string | undefined => {
  if (cause === undefined || cause === null) {
    return undefined
  }

  if (cause instanceof Error) {
    return `${cause.name}: ${cause.message}`
  }

  return String(cause)
}

const isForgeRuntimeEvaluationDiagnostics = (value: unknown): value is ForgeRuntimeEvaluationDiagnostics => {
  return value !== null &&
    value !== undefined &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).phase === 'string'
}
