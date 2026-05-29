import type { DSLPathSegment } from '../diagnostics/sourceMetadata'
import formatDiagnosticStack from './formatDiagnosticStack'

interface ForgeCompilationErrorOptions {
  readonly phase: string
  readonly cause: unknown
  readonly nodeId?: string
  readonly path?: readonly DSLPathSegment[]
  readonly formattedPath?: string
  readonly functionName?: string
  readonly functionType?: string
}

export default class ForgeCompilationError extends Error {
  readonly phase: string

  readonly nodeId?: string

  readonly path?: readonly DSLPathSegment[]

  readonly formattedPath?: string

  readonly functionName?: string

  readonly functionType?: string

  readonly cause: unknown

  constructor(options: ForgeCompilationErrorOptions) {
    super(`Failed to compile generated Forge ${options.phase} function`)
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
