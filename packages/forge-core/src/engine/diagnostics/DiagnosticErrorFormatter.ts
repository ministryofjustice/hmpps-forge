import type { DSLPathSegment } from '../../shared/diagnostics/sourceLocation.type'

export interface RuntimeDiagnosticFields {
  readonly phase: string
  readonly nodeId?: string
  readonly path?: readonly DSLPathSegment[]
  readonly formattedPath?: string
  readonly functionName?: string
  readonly functionType?: string
  readonly definedAt?: string
}

export default class DiagnosticErrorFormatter {
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
      { label: 'Defined at', value: diagnostics.definedAt },
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
}
