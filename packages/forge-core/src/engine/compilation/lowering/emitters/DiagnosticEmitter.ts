import { FunctionType } from '../../../../authoring/types/enums'
import type { DSLPathSegment, DSLSourceLocation } from '../../../diagnostics/sourceLocation.type'

interface DiagnosticMetadata {
  readonly nodeId?: string
  readonly path?: readonly DSLPathSegment[]
  readonly formattedPath?: string
  readonly functionName?: string
  readonly functionType?: string
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

    if (usesAwait) {
      return `(await ${helperCall})`
    }

    return helperCall
  }

  wrapFunctionCall(helperName: string, funcName: string, argExprs: string[], source: unknown): string | undefined {
    const metadata = this.getMetadata(source, funcName)

    if (metadata === undefined) {
      return undefined
    }

    return this.compileFunctionHelperCall(helperName, metadata, funcName, argExprs)
  }

  private getMetadata(source: unknown, functionName?: string): DiagnosticMetadata | undefined {
    const sourceDiagnostics = this.getSourceDiagnostics(source)
    const resolvedFunctionName = functionName ?? this.getFunctionName(source)
    const functionType = this.getFunctionType(source)

    if (
      sourceDiagnostics.nodeId === undefined &&
      sourceDiagnostics.path === undefined &&
      sourceDiagnostics.formattedPath === undefined &&
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
    const sourceLocation = this.getSourceLocation(source)

    if (!isRecord(source)) {
      return {
        path: sourceLocation?.path,
        formattedPath: sourceLocation?.formattedPath,
      }
    }

    return {
      nodeId: typeof source.id === 'string' ? source.id : undefined,
      path: sourceLocation?.path,
      formattedPath: sourceLocation?.formattedPath,
    }
  }

  private getSourceLocation(source: unknown): DSLSourceLocation | undefined {
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

    const { path, formattedPath } = sourceLocation

    if (!isDSLPath(path) || typeof formattedPath !== 'string') {
      return undefined
    }

    return { path, formattedPath }
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
    const callback = `${callbackPrefix}function() {\n${indentSource(returnStatement)}\n}`
    const args = [compileRuntimeDiagnosticsArg(), this.compileMetadataLiteral(metadata), callback]

    return `${GENERATED_FUNCTION_HELPERS_PARAM}.${helperName}(\n${indentSource(args.join(',\n'))}\n)`
  }

  private compileFunctionHelperCall(
    helperName: string,
    metadata: DiagnosticMetadata,
    funcName: string,
    argExprs: string[],
  ): string {
    const args = [
      'ctx',
      compileRuntimeDiagnosticsArg(),
      this.compileMetadataLiteral(metadata),
      JSON.stringify(funcName),
      `[${argExprs.join(', ')}]`,
    ]

    return `${GENERATED_FUNCTION_HELPERS_PARAM}.${helperName}(\n${indentSource(args.join(',\n'))}\n)`
  }

  private compileMetadataLiteral(metadata: DiagnosticMetadata): string {
    return [
      '{',
      indentSource(
        [
          `nodeId: ${toSourceLiteral(metadata.nodeId)},`,
          `path: ${toSourceLiteral(metadata.path)},`,
          `formattedPath: ${toSourceLiteral(metadata.formattedPath)},`,
          `functionName: ${toSourceLiteral(metadata.functionName)},`,
          `functionType: ${toSourceLiteral(metadata.functionType)}`,
        ].join('\n'),
      ),
      '}',
    ].join('\n')
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)
}

function isDSLPath(value: unknown): value is readonly DSLPathSegment[] {
  return Array.isArray(value) && value.every(segment => typeof segment === 'string' || typeof segment === 'number')
}

function indentSource(source: string): string {
  return source
    .split('\n')
    .map(line => (line.length === 0 ? line : `  ${line}`))
    .join('\n')
}

function compileRuntimeDiagnosticsArg(): string {
  return `typeof ${RUNTIME_DIAGNOSTICS_PARAM} === "undefined" ? undefined : ${RUNTIME_DIAGNOSTICS_PARAM}`
}

function toSourceLiteral(value: unknown): string {
  if (value === undefined) {
    return 'undefined'
  }

  return JSON.stringify(value) ?? 'undefined'
}
