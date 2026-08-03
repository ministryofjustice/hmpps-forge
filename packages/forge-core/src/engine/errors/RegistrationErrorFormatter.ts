import { formatCallsite } from '../../shared/diagnostics/formatCallsite'

interface DiagnosticError {
  readonly name?: unknown
  readonly message?: unknown
  readonly formattedPath?: unknown
  readonly path?: unknown
  readonly expected?: unknown
  readonly functionName?: unknown
  readonly functionType?: unknown
  readonly variant?: unknown
  readonly phase?: unknown
  readonly nodeId?: unknown
  readonly cause?: unknown
  readonly callsite?: { readonly stack?: string }
}

export default class RegistrationErrorFormatter {
  static format(error: unknown): unknown {
    if (error instanceof AggregateError) {
      return RegistrationErrorFormatter.formatAggregate(error)
    }

    return error
  }

  private static formatAggregate(error: AggregateError): string {
    const entries = error.errors.map((entry, index) => RegistrationErrorFormatter.formatEntry(entry, index))

    return [`Forge registration failed: ${error.message}`, '', ...entries].join('\n')
  }

  private static formatEntry(error: unknown, index: number): string {
    const diagnostic = RegistrationErrorFormatter.toDiagnostic(error)
    const title = RegistrationErrorFormatter.formatTitle(diagnostic, error)
    const fields = RegistrationErrorFormatter.formatFields(diagnostic)

    return [`${index + 1}. ${title}`, ...fields.map(field => `   ${field}`)].join('\n')
  }

  private static formatTitle(diagnostic: DiagnosticError | undefined, error: unknown): string {
    const name = RegistrationErrorFormatter.formatValue(diagnostic?.name)
    const message = RegistrationErrorFormatter.formatValue(diagnostic?.message)

    if (name && message) {
      return `${name}: ${message}`
    }

    if (message) {
      return message
    }

    return RegistrationErrorFormatter.formatValue(error) ?? String(error)
  }

  private static formatFields(diagnostic: DiagnosticError | undefined): string[] {
    if (!diagnostic) {
      return []
    }

    const path =
      RegistrationErrorFormatter.formatValue(diagnostic.formattedPath) ??
      RegistrationErrorFormatter.formatPath(diagnostic.path)

    const fields = [
      { label: 'Phase', value: RegistrationErrorFormatter.formatValue(diagnostic.phase) },
      { label: 'Path', value: path },
      { label: 'Node', value: RegistrationErrorFormatter.formatValue(diagnostic.nodeId) },
      { label: 'Expected', value: RegistrationErrorFormatter.formatValue(diagnostic.expected) },
      { label: 'Function', value: RegistrationErrorFormatter.formatValue(diagnostic.functionName) },
      { label: 'Type', value: RegistrationErrorFormatter.formatValue(diagnostic.functionType) },
      { label: 'Variant', value: RegistrationErrorFormatter.formatValue(diagnostic.variant) },
      { label: 'Defined at', value: RegistrationErrorFormatter.formatCallsiteValue(diagnostic.callsite) },
      { label: 'Cause', value: RegistrationErrorFormatter.formatValue(diagnostic.cause) },
    ]

    return fields
      .filter(field => field.value !== undefined)
      .map(field => `${field.label}: ${field.value}`)
  }

  private static toDiagnostic(error: unknown): DiagnosticError | undefined {
    if (!error || typeof error !== 'object') {
      return undefined
    }

    return error as DiagnosticError
  }

  private static formatCallsiteValue(callsite: { readonly stack?: string } | undefined): string | undefined {
    return typeof callsite?.stack === 'string' ? formatCallsite(callsite) : undefined
  }

  private static formatPath(value: unknown): string | undefined {
    if (Array.isArray(value)) {
      return value.length > 0 ? value.map(pathPart => String(pathPart)).join('.') : 'root'
    }

    return RegistrationErrorFormatter.formatValue(value)
  }

  private static formatValue(value: unknown): string | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined
    }

    return String(value)
  }
}
