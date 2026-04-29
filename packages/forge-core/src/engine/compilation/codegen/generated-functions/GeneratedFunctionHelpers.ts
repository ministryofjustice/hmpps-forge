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

export interface GeneratedFunctionHelpers {
  ensureAnswerHistory(ctx: AnswerHistoryContext, code: string): AnswerHistory
  pushAnswerMutation(answerHistory: AnswerHistory, value: unknown, source: string): void
  normalizePostValue(rawValue: unknown, multiple: boolean): unknown
  resolveFieldValue(ctx: RenderFieldValueContext, blockProps: Record<string, unknown>): void
  formatString(template: string, args: readonly unknown[]): string
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

  formatString(template, args) {
    return args.reduce<string>((result, value, index) => {
      const placeholder = `%${index + 1}`
      const placeholderPattern = `${placeholder}(?!\\d)`

      return result.replace(new RegExp(placeholderPattern, 'g'), () => String(value ?? ''))
    }, template)
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
