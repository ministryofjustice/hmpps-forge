import type { DSLPathSegment } from './sourceLocation.type'

export interface DiagnosticField {
  readonly label: string
  readonly value: string | undefined
}

export interface RuntimeDiagnosticFields {
  readonly phase: string
  readonly nodeId?: string
  readonly path?: readonly DSLPathSegment[]
  readonly formattedPath?: string
  readonly functionName?: string
  readonly functionType?: string
}

export default class DiagnosticErrorFormatter {
  static formatDiagnosticError(name: string, message: string, fields: readonly DiagnosticField[]): string {
    const formattedFields = fields
      .filter(field => field.value !== undefined)
      .map(field => `  ${field.label}: ${field.value}`)

    return [`${name}: ${message}`, ...formattedFields].join('\n')
  }

  static appendRuntimeDiagnostics(stack: string | undefined, diagnostics: RuntimeDiagnosticFields): string | undefined {
    if (stack === undefined) {
      return undefined
    }

    return `${stack}\n\n${DiagnosticErrorFormatter.formatRuntimeDiagnostics(diagnostics)}`
  }

  static formatRuntimeDiagnostics(diagnostics: RuntimeDiagnosticFields): string {
    const formattedFields = [
      { label: 'Phase', value: diagnostics.phase },
      { label: 'Path', value: diagnostics.formattedPath ?? DiagnosticErrorFormatter.formatPath(diagnostics.path) },
      { label: 'Node', value: diagnostics.nodeId },
      { label: 'Function', value: diagnostics.functionName },
      { label: 'Type', value: diagnostics.functionType },
    ]
      .filter(field => field.value !== undefined)
      .map(field => `  ${field.label}: ${field.value}`)

    return ['Forge diagnostics:', ...formattedFields].join('\n')
  }

  static formatPath(path: readonly DSLPathSegment[] | undefined): string | undefined {
    if (path === undefined) {
      return undefined
    }

    return path.length > 0 ? path.map(segment => String(segment)).join('.') : 'root'
  }

  static formatCause(cause: unknown): string | undefined {
    if (cause === undefined || cause === null) {
      return undefined
    }

    if (cause instanceof Error) {
      return `${cause.name}: ${cause.message}`
    }

    return String(cause)
  }
}
