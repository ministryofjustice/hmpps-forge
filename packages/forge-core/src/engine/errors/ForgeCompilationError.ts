import DiagnosticErrorFormatter from '../diagnostics/DiagnosticErrorFormatter'
import type { DSLPathSegment } from '../diagnostics/sourceLocation.type'

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
  }

  toString(): string {
    return DiagnosticErrorFormatter.formatDiagnosticError(this.name, this.message, [
      { label: 'Phase', value: this.phase },
      { label: 'Path', value: this.formattedPath ?? DiagnosticErrorFormatter.formatPath(this.path) },
      { label: 'Node', value: this.nodeId },
      { label: 'Function', value: this.functionName },
      { label: 'Type', value: this.functionType },
      { label: 'Cause', value: DiagnosticErrorFormatter.formatCause(this.cause) },
    ])
  }
}
