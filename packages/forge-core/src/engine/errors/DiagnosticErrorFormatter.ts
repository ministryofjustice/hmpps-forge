export interface RuntimeDiagnosticFields {
  readonly phase: string
  readonly nodeId?: string
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

  private static formatRuntimeDiagnostics(diagnostics: RuntimeDiagnosticFields): string {
    const formattedFields = [
      { label: 'Phase', value: diagnostics.phase },
      { label: 'Path', value: diagnostics.formattedPath },
      { label: 'Node', value: diagnostics.nodeId },
      { label: 'Function', value: diagnostics.functionName },
      { label: 'Type', value: diagnostics.functionType },
      { label: 'Defined at', value: diagnostics.definedAt },
    ]
      .filter(field => field.value !== undefined)
      .map(field => `  ${field.label}: ${field.value}`)

    return ['Forge diagnostics:', ...formattedFields].join('\n')
  }
}
