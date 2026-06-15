import { RENDER_BLOCK_BRAND } from '../../contracts/compiled/renderBlock.brand'

interface AnswerHistory {
  current: unknown
  mutations: { value: unknown; source: string }[]
}

interface RenderAnswerHistory {
  current: unknown
  parsed?: unknown
  mutations?: { value: unknown; source: string }[]
}

interface AnswerHistoryContext {
  answers: Record<string, AnswerHistory>
}

interface RenderFieldValueContext {
  answers: Record<string, RenderAnswerHistory | undefined>
  request: Record<string, unknown>
}

interface FunctionEvaluationContext {
  conditions: {
    get(name: string): {
      evaluate(...args: unknown[]): unknown
    }
  }
}

interface RuntimeDiagnosticState {
  readonly nodeId?: string
  readonly path?: readonly (string | number)[]
  readonly formattedPath?: string
  readonly functionName?: string
  readonly functionType?: string
}

interface RuntimeEvaluationDiagnostics {
  current: RuntimeDiagnosticState | undefined
  wrap(
    error: unknown,
    nodeId?: string,
    path?: readonly (string | number)[],
    formattedPath?: string,
    functionName?: string,
    functionType?: string,
  ): unknown
}

const VALIDATION_CONDITION_FUNCTION_TYPE = 'FunctionType.Condition'

export interface ScopeFrame {
  readonly item: unknown
  readonly index: number
  readonly rawItem: unknown
  readonly inputLength: number
}

export interface GeneratedFunctionHelpers {
  renderBlockBrand: symbol
  ensureAnswerHistory(ctx: AnswerHistoryContext, code: string): AnswerHistory
  pushAnswerMutation(answerHistory: AnswerHistory, value: unknown, source: string): void
  normalizePostValue(rawValue: unknown, multiple: boolean): unknown
  resolveFieldValue(ctx: RenderFieldValueContext, blockProps: Record<string, unknown>): void
  resolveScopeReferences(value: unknown, scopeStack: ScopeFrame[]): unknown
  evaluateFunction(
    ctx: FunctionEvaluationContext,
    diagnostics: RuntimeEvaluationDiagnostics | undefined,
    metadata: RuntimeDiagnosticState,
    functionName: string,
    args: unknown[],
  ): unknown
  evaluateFunctionAsync(
    ctx: FunctionEvaluationContext,
    diagnostics: RuntimeEvaluationDiagnostics | undefined,
    metadata: RuntimeDiagnosticState,
    functionName: string,
    args: unknown[],
  ): Promise<unknown>
  evaluateTracked(
    diagnostics: RuntimeEvaluationDiagnostics | undefined,
    metadata: RuntimeDiagnosticState,
    evaluate: () => unknown,
  ): unknown
  evaluateTrackedAsync(
    diagnostics: RuntimeEvaluationDiagnostics | undefined,
    metadata: RuntimeDiagnosticState,
    evaluate: () => Promise<unknown>,
  ): Promise<unknown>
  evaluateValidationCondition(evaluate: () => unknown): boolean
  evaluateValidationConditionAsync(evaluate: () => Promise<unknown>): Promise<boolean>
}

export const generatedFunctionHelpers: GeneratedFunctionHelpers = {
  renderBlockBrand: RENDER_BLOCK_BRAND,

  ensureAnswerHistory(ctx, code) {
    let answerHistory = ctx.answers[code]

    if (!answerHistory) {
      answerHistory = { current: undefined, mutations: [] }
      ctx.answers[code] = answerHistory
    }

    return answerHistory
  },

  pushAnswerMutation(answerHistory, value, source) {
    answerHistory.mutations.push({ value, source })
    answerHistory.current = value
  },

  normalizePostValue(rawValue, multiple) {
    if (multiple) {
      if (Array.isArray(rawValue)) {
        return rawValue
      }

      return rawValue !== undefined && rawValue !== null ? [rawValue] : []
    }

    if (!Array.isArray(rawValue)) {
      return rawValue
    }

    return rawValue.find(
      value => value !== undefined && value !== null && (typeof value !== 'string' || value.trim() !== ''),
    )
  },

  resolveFieldValue(ctx, blockProps) {
    const fieldCode = blockProps.code

    if (typeof fieldCode !== 'string') {
      return
    }

    const answerHistory = ctx.answers[fieldCode]

    if (ctx.request.method === 'POST') {
      blockProps.value = resolvePostFieldValue(answerHistory)

      return
    }

    blockProps.value = resolveGetFieldValue(answerHistory, blockProps.defaultValue)
  },

  evaluateFunction(ctx, diagnostics, metadata, functionName, args) {
    return evaluateWithDiagnostics(diagnostics, metadata, () => ctx.conditions.get(functionName).evaluate(...args))
  },

  evaluateFunctionAsync(ctx, diagnostics, metadata, functionName, args) {
    return evaluateWithDiagnosticsAsync(diagnostics, metadata, async () =>
      ctx.conditions.get(functionName).evaluate(...args),
    )
  },

  evaluateTracked(diagnostics, metadata, evaluate) {
    return evaluateWithDiagnostics(diagnostics, metadata, evaluate)
  },

  evaluateTrackedAsync(diagnostics, metadata, evaluate) {
    return evaluateWithDiagnosticsAsync(diagnostics, metadata, evaluate)
  },

  evaluateValidationCondition(evaluate) {
    try {
      return !!evaluate()
    } catch (error) {
      if (isValidationConditionTypeError(error)) {
        return false
      }

      throw error
    }
  },

  async evaluateValidationConditionAsync(evaluate) {
    try {
      return !!(await evaluate())
    } catch (error) {
      if (isValidationConditionTypeError(error)) {
        return false
      }

      throw error
    }
  },

  resolveScopeReferences(value, scopeStack) {
    return resolveScopeReferencesWalk(value, scopeStack)
  },
}

function resolveScopeReferencesWalk(value: unknown, scopeStack: ScopeFrame[]): unknown {
  if (value === null || value === undefined || typeof value !== 'object') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map(item => resolveScopeReferencesWalk(item, scopeStack))
  }

  const obj = value as Record<string, unknown>

  if (
    obj.type === 'AstNode.Template' &&
    obj.originalType === 'AstNode.Expression' &&
    obj.expressionType === 'ExpressionType.Reference'
  ) {
    const properties = obj.properties as Record<string, unknown> | undefined
    const path = properties?.path as unknown[] | undefined

    if (Array.isArray(path) && path.length >= 2) {
      if (path[0] === '@scope') {
        return resolveScopeReference(path, scopeStack)
      }

      if (path[0] === '@loop') {
        return resolveLoopReference(path, scopeStack)
      }
    }
  }

  const result: Record<string, unknown> = {}

  for (const key of Object.keys(obj)) {
    result[key] = resolveScopeReferencesWalk(obj[key], scopeStack)
  }

  return result
}

function resolveScopeReference(path: unknown[], scopeStack: ScopeFrame[]): unknown {
  const level = typeof path[1] === 'string' ? parseInt(path[1] as string, 10) : (path[1] as number)
  const frame = scopeStack[level]

  if (!frame) {
    return undefined
  }

  if (path.length === 2) {
    return frame.rawItem
  }

  const property = path[2] as string

  if (property === '@key') {
    return (frame.item as Record<string, unknown>)?.['@key']
  }

  if (property === '@item') {
    return frame.rawItem
  }

  if (property === '@value') {
    return (frame.item as Record<string, unknown>)?.['@value']
  }

  let current: unknown = frame.item

  for (let i = 2; i < path.length; i++) {
    if (current === null || current === undefined) {
      return undefined
    }

    current = (current as Record<string, unknown>)[path[i] as string]
  }

  return current
}

function resolveLoopReference(path: unknown[], scopeStack: ScopeFrame[]): unknown {
  if (path.length < 3) {
    return undefined
  }

  const level = typeof path[1] === 'string' ? parseInt(path[1] as string, 10) : (path[1] as number)
  const frame = scopeStack[level]

  if (!frame) {
    return undefined
  }

  const property = path[2] as string

  switch (property) {
    case 'index':
      return frame.index + 1
    case 'index0':
      return frame.index
    case 'revindex':
      return frame.inputLength - frame.index
    case 'revindex0':
      return frame.inputLength - frame.index - 1
    case 'first':
      return frame.index === 0
    case 'last':
      return frame.index === frame.inputLength - 1
    case 'length':
      return frame.inputLength
    default:
      return undefined
  }
}

function evaluateWithDiagnostics(
  diagnostics: RuntimeEvaluationDiagnostics | undefined,
  metadata: RuntimeDiagnosticState,
  evaluate: () => unknown,
): unknown {
  const previous = enterDiagnostics(diagnostics, metadata)

  try {
    return evaluate()
  } catch (error) {
    throw wrapDiagnosticError(diagnostics, metadata, error)
  } finally {
    exitDiagnostics(diagnostics, previous)
  }
}

async function evaluateWithDiagnosticsAsync(
  diagnostics: RuntimeEvaluationDiagnostics | undefined,
  metadata: RuntimeDiagnosticState,
  evaluate: () => Promise<unknown>,
): Promise<unknown> {
  const previous = enterDiagnostics(diagnostics, metadata)

  try {
    return await evaluate()
  } catch (error) {
    throw wrapDiagnosticError(diagnostics, metadata, error)
  } finally {
    exitDiagnostics(diagnostics, previous)
  }
}

function enterDiagnostics(
  diagnostics: RuntimeEvaluationDiagnostics | undefined,
  metadata: RuntimeDiagnosticState,
): RuntimeDiagnosticState | undefined {
  if (diagnostics === undefined) {
    return undefined
  }

  const previous = diagnostics.current

  diagnostics.current = metadata

  return previous
}

function exitDiagnostics(
  diagnostics: RuntimeEvaluationDiagnostics | undefined,
  previous: RuntimeDiagnosticState | undefined,
): void {
  if (diagnostics !== undefined) {
    diagnostics.current = previous
  }
}

function wrapDiagnosticError(
  diagnostics: RuntimeEvaluationDiagnostics | undefined,
  metadata: RuntimeDiagnosticState,
  error: unknown,
): unknown {
  if (diagnostics === undefined) {
    return error
  }

  return diagnostics.wrap(
    error,
    metadata.nodeId,
    metadata.path,
    metadata.formattedPath,
    metadata.functionName,
    metadata.functionType,
  )
}

function isValidationConditionTypeError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true
  }

  if (!isRecord(error)) {
    return false
  }

  return error.cause instanceof TypeError && error.functionType === VALIDATION_CONDITION_FUNCTION_TYPE
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)
}

function resolvePostFieldValue(answerHistory: RenderAnswerHistory | undefined): unknown {
  const answerMutations = answerHistory?.mutations ?? []
  let postMutationIndex = -1
  let mutationIndex = answerMutations.length - 1

  while (mutationIndex >= 0) {
    const currentMutationIndex = mutationIndex
    const mutation = answerMutations[currentMutationIndex]

    mutationIndex -= 1

    if (mutation?.source === 'post') {
      postMutationIndex = currentMutationIndex
      break
    }
  }

  let shouldUsePostValue = postMutationIndex >= 0

  if (shouldUsePostValue) {
    let laterMutationIndex = postMutationIndex + 1

    while (laterMutationIndex < answerMutations.length) {
      const laterMutation = answerMutations[laterMutationIndex]

      laterMutationIndex += 1

      if (laterMutation?.source !== 'processed') {
        shouldUsePostValue = false
        break
      }
    }
  }

  if (shouldUsePostValue) {
    return answerMutations[postMutationIndex]?.value
  }

  return answerHistory?.current
}

function resolveGetFieldValue(answerHistory: RenderAnswerHistory | undefined, defaultValue: unknown): unknown {
  if (answerHistory?.parsed !== undefined) {
    return answerHistory.parsed
  }

  if (answerHistory) {
    return answerHistory.current
  }

  return defaultValue
}
