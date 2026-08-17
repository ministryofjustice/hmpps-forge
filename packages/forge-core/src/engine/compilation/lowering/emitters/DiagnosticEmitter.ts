import { FunctionType } from '../../../../authoring/types/enums'
import { formatCallsiteChain, resolveCallsitePositionChain } from '../../../../shared/diagnostics/formatCallsite'
import { Code, arrayCode, callCode, code, literal, positionedCode, propertyCode } from '../../codegen/Code'
import CodeGenerator from '../../codegen/CodeGenerator'
import Name from '../../codegen/Name'

export interface DiagnosticMetadata {
  readonly nodeId?: string
  readonly formattedPath?: string
  readonly functionName?: string
  readonly functionType?: string
  readonly definedAt?: string
}

const GENERATED_FUNCTION_HELPERS_PARAM = new Name('_forgeHelpers')
const RUNTIME_DIAGNOSTICS_PARAM = new Name('_forgeRuntimeDiagnostics')
const CONTEXT_PARAM = new Name('ctx')

export default class DiagnosticEmitter {
  private readonly metadataByKey = new Map<string, number>()

  private readonly metadataEntries: DiagnosticMetadata[] = []

  reset(): void {
    this.metadataByKey.clear()
    this.metadataEntries.length = 0
  }

  snapshot(): readonly DiagnosticMetadata[] {
    return Object.freeze(this.metadataEntries.map(metadata => Object.freeze({ ...metadata })))
  }

  wrapExpression(expression: Code, source: unknown, usesAwait: boolean, generator: CodeGenerator): Code {
    const metadata = this.getMetadata(source)

    if (metadata === undefined) {
      return expression
    }

    const helperName = usesAwait ? 'evaluateTrackedAsync' : 'evaluateTracked'
    const callback = generator.functionExpression(
      this.compileCallbackName(metadata),
      [],
      callbackGenerator => {
        callbackGenerator.return(usesAwait ? code`await (${expression})` : code`(${expression})`)
      },
      { async: usesAwait },
    )
    const helperCall = this.compileTrackedHelperCall(helperName, this.intern(metadata), callback)
    const wrappedCall = usesAwait ? code`(await ${helperCall})` : helperCall

    return positionedCode(wrappedCall, this.resolvePositions(source))
  }

  /**
   * Unlike `wrapExpression`, the function name is always known here (it's a
   * required parameter, not derived from `source`), so metadata is always
   * worth tracking and this always routes through the helper call.
   */
  wrapFunctionCall(helperName: string, funcName: string, argExprs: readonly Code[], source: unknown): Code {
    const metadata: DiagnosticMetadata = {
      ...this.getSourceDiagnostics(source),
      functionName: funcName,
      functionType: this.getFunctionType(source),
    }

    return positionedCode(
      this.compileFunctionHelperCall(helperName, this.intern(metadata), funcName, argExprs),
      this.resolvePositions(source),
    )
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

  /** Resolves the authored position chain innermost-first for source-map emission. */
  private resolvePositions(source: unknown) {
    return resolveCallsitePositionChain(this.getCallsite(source))
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

  private compileTrackedHelperCall(helperName: string, diagnosticReference: number, callback: Code): Code {
    return callCode(code`${GENERATED_FUNCTION_HELPERS_PARAM}${propertyCode(helperName)}`, [
      RUNTIME_DIAGNOSTICS_PARAM,
      literal(diagnosticReference),
      callback,
    ])
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
    diagnosticReference: number,
    funcName: string,
    argExprs: readonly Code[],
  ): Code {
    const args = [
      CONTEXT_PARAM,
      RUNTIME_DIAGNOSTICS_PARAM,
      literal(diagnosticReference),
      literal(funcName),
      arrayCode(argExprs),
    ]

    return callCode(code`${GENERATED_FUNCTION_HELPERS_PARAM}${propertyCode(helperName)}`, args)
  }

  private intern(metadata: DiagnosticMetadata): number {
    const key = JSON.stringify(metadata)
    const existingReference = this.metadataByKey.get(key)

    if (existingReference !== undefined) {
      return existingReference
    }

    const reference = this.metadataEntries.length

    this.metadataEntries.push(metadata)
    this.metadataByKey.set(key, reference)

    return reference
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)
}
