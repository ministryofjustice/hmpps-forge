import { FunctionType } from '../../../../authoring/types/enums'
import { formatCallsiteChain, resolveCallsitePositionChain } from '../../../../shared/diagnostics/formatCallsite'
import { compilePositionMarker } from '../../codegen/SourceRenderer'

interface DiagnosticMetadata {
  readonly nodeId?: string
  readonly formattedPath?: string
  readonly functionName?: string
  readonly functionType?: string
  readonly definedAt?: string
}

const GENERATED_FUNCTION_HELPERS_PARAM = '_forgeHelpers'
const RUNTIME_DIAGNOSTICS_PARAM = '_forgeRuntimeDiagnostics'

export default class DiagnosticEmitter {
  wrapExpression(expression: string, source: unknown, usesAwait: boolean): string {
    const metadata = this.getMetadata(source)

    if (metadata === undefined) {
      return expression
    }

    const returnStatement = usesAwait ? `return await (${expression});` : `return (${expression});`
    const helperName = usesAwait ? 'evaluateTrackedAsync' : 'evaluateTracked'
    const callbackPrefix = usesAwait ? 'async ' : ''
    const helperCall = this.compileTrackedHelperCall(helperName, metadata, callbackPrefix, returnStatement)
    const positionMarker = this.compilePositionMarkerFor(source)

    if (usesAwait) {
      return `${positionMarker}(await ${helperCall})`
    }

    return `${positionMarker}${helperCall}`
  }

  /**
   * Unlike `wrapExpression`, the function name is always known here (it's a
   * required parameter, not derived from `source`), so metadata is always
   * worth tracking and this always routes through the helper call.
   */
  wrapFunctionCall(helperName: string, funcName: string, argExprs: string[], source: unknown): string {
    const metadata: DiagnosticMetadata = {
      ...this.getSourceDiagnostics(source),
      functionName: funcName,
      functionType: this.getFunctionType(source),
    }

    return `${this.compilePositionMarkerFor(source)}${this.compileFunctionHelperCall(helperName, metadata, funcName, argExprs)}`
  }

  private getMetadata(source: unknown, functionName?: string): DiagnosticMetadata | undefined {
    const sourceDiagnostics = this.getSourceDiagnostics(source)
    const resolvedFunctionName = functionName ?? this.getFunctionName(source)
    const functionType = this.getFunctionType(source)

    if (
      sourceDiagnostics.nodeId === undefined &&
      sourceDiagnostics.formattedPath === undefined &&
      sourceDiagnostics.definedAt === undefined &&
      resolvedFunctionName === undefined &&
      functionType === undefined
    ) {
      return undefined
    }

    return {
      ...sourceDiagnostics,
      functionName: resolvedFunctionName,
      functionType,
    }
  }

  private getSourceDiagnostics(source: unknown): DiagnosticMetadata {
    const formattedPath = this.getFormattedPath(source)
    const definedAt = this.getDefinedAt(source)

    if (!isRecord(source)) {
      return {
        formattedPath,
        definedAt,
      }
    }

    return {
      nodeId: typeof source.id === 'string' ? source.id : undefined,
      formattedPath,
      definedAt,
    }
  }

  private getDefinedAt(source: unknown): string | undefined {
    const callsite = this.getCallsite(source)

    if (callsite === undefined) {
      return undefined
    }

    const chain = formatCallsiteChain(callsite)

    return chain.length > 0 ? chain.join('\n') : undefined
  }

  /**
   * One marker per author chain frame, innermost first, so a breakpoint binds
   * at the node's own line and at each wiring line that called into a shared
   * helper to build it.
   */
  private compilePositionMarkerFor(source: unknown): string {
    return resolveCallsitePositionChain(this.getCallsite(source)).map(compilePositionMarker).join('')
  }

  private getCallsite(source: unknown): { stack?: string } | undefined {
    if (!isRecord(source)) {
      return undefined
    }

    const diagnostics = source.diagnostics

    if (!isRecord(diagnostics)) {
      return undefined
    }

    const callsite = diagnostics.callsite

    if (!isRecord(callsite)) {
      return undefined
    }

    const { stack } = callsite

    if (stack !== undefined && typeof stack !== 'string') {
      return undefined
    }

    return { stack }
  }

  private getFormattedPath(source: unknown): string | undefined {
    if (!isRecord(source)) {
      return undefined
    }

    const diagnostics = source.diagnostics

    if (!isRecord(diagnostics)) {
      return undefined
    }

    const sourceLocation = diagnostics.source

    if (!isRecord(sourceLocation)) {
      return undefined
    }

    return typeof sourceLocation.formattedPath === 'string' ? sourceLocation.formattedPath : undefined
  }

  private getFunctionName(source: unknown): string | undefined {
    if (!isRecord(source)) {
      return undefined
    }

    const properties = isRecord(source.properties) ? source.properties : source
    const name = properties.name

    return typeof name === 'string' ? name : undefined
  }

  private getFunctionType(source: unknown): string | undefined {
    if (!isRecord(source)) {
      return undefined
    }

    const expressionType = source.expressionType

    switch (expressionType) {
      case FunctionType.CONDITION:
      case FunctionType.TRANSFORMER:
      case FunctionType.GENERATOR:
      case FunctionType.EFFECT:
        return expressionType
      default:
        return undefined
    }
  }

  private compileTrackedHelperCall(
    helperName: string,
    metadata: DiagnosticMetadata,
    callbackPrefix: string,
    returnStatement: string,
  ): string {
    const callback = `${callbackPrefix}function ${this.compileCallbackName(metadata)}() {\n${indentSource(returnStatement)}\n}`
    const args = [RUNTIME_DIAGNOSTICS_PARAM, this.compileMetadataLiteral(metadata), callback]

    return `${GENERATED_FUNCTION_HELPERS_PARAM}.${helperName}(\n${indentSource(args.join(',\n'))}\n)`
  }

  /**
   * Names the tracked callback after the node it evaluates so debugger stacks
   * read `evaluate_hidden` instead of `<anonymous>`. The `evaluate_` prefix
   * keeps the (function-scope-only) name binding clear of every identifier the
   * compilers emit, so the inner expression can never be shadowed by it.
   */
  private compileCallbackName(metadata: DiagnosticMetadata): string {
    const pathTail = metadata.formattedPath?.split(' > ').at(-1) ?? metadata.functionName

    if (pathTail === undefined) {
      return 'evaluate_expression'
    }

    const identifier = pathTail.replace(/[^\w$]+/g, '_').replace(/^_+|_+$/g, '')

    return identifier.length > 0 ? `evaluate_${identifier}` : 'evaluate_expression'
  }

  private compileFunctionHelperCall(
    helperName: string,
    metadata: DiagnosticMetadata,
    funcName: string,
    argExprs: string[],
  ): string {
    const args = [
      'ctx',
      RUNTIME_DIAGNOSTICS_PARAM,
      this.compileMetadataLiteral(metadata),
      JSON.stringify(funcName),
      `[${argExprs.join(', ')}]`,
    ]

    return `${GENERATED_FUNCTION_HELPERS_PARAM}.${helperName}(\n${indentSource(args.join(',\n'))}\n)`
  }

  private compileMetadataLiteral(metadata: DiagnosticMetadata): string {
    const fields = [
      ['nodeId', metadata.nodeId],
      ['formattedPath', metadata.formattedPath],
      ['functionName', metadata.functionName],
      ['functionType', metadata.functionType],
      ['definedAt', metadata.definedAt],
    ].filter((field): field is [string, string] => field[1] !== undefined)

    if (fields.length === 0) {
      return '{}'
    }

    const fieldLines = fields.map(([name, value]) => `${name}: ${JSON.stringify(value)}`).join(',\n')

    return ['{', indentSource(fieldLines), '}'].join('\n')
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)
}

function indentSource(source: string): string {
  return source
    .split('\n')
    .map(line => (line.length === 0 ? line : `  ${line}`))
    .join('\n')
}
