import type { ZodType } from 'zod'
import { RENDER_BLOCK_BRAND } from '../../../contracts/compiled/renderBlock.brand'
import { FunctionType } from '../../../../authoring/types/enums'

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

interface RenderFieldFailureContext {
  fieldFailures: Record<string, unknown[]>
}

export interface FunctionRegistryLookupEntry {
  evaluate(...args: unknown[]): unknown
  inputSchema?: ZodType
  argumentsSchema?: ZodType
  outputSchema?: ZodType
  functionType?: FunctionType
}

interface FunctionEvaluationContext {
  conditions: {
    get(name: string): FunctionRegistryLookupEntry
  }
}

interface ComponentRegistryLookupEntry {
  inputSchema?: ZodType
}

interface ComponentInputContext {
  components: {
    get(variant: string): ComponentRegistryLookupEntry | undefined
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
  renderBlockBrand: symbol
  ensureAnswerHistory(ctx: AnswerHistoryContext, code: string): AnswerHistory
  pushAnswerMutation(answerHistory: AnswerHistory, value: unknown, source: string): void
  normalizePostValue(rawValue: unknown, multiple: boolean): unknown
  checkComponentInputValue(ctx: ComponentInputContext, variant: string, value: unknown, multiple: boolean): unknown
  resolveFieldValue(ctx: RenderFieldValueContext, blockProps: Record<string, unknown>): void
  resolveFieldFailures(ctx: RenderFieldFailureContext, blockId: unknown, blockProps: Record<string, unknown>): void
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

  /**
   * Checks a submitted value against the component variant's `inputSchema` after
   * normalisation. A value failing the schema is by definition not from the
   * rendered form, so it fails soft to absent — `[]` when multiple, else
   * `undefined` — since no legitimate user action can produce it. A passing value
   * is returned unchanged (no Zod coercion in v1). An unanswered value, an unknown
   * variant, or a variant without a schema is left untouched.
   */
  checkComponentInputValue(ctx, variant, value, multiple) {
    if (value === undefined) {
      return value
    }

    const entry = ctx.components.get(variant)

    if (entry === undefined || entry.inputSchema === undefined) {
      return value
    }

    const parsed = entry.inputSchema.safeParse(value)

    if (parsed.success) {
      return value
    }

    return multiple ? [] : undefined
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

  resolveFieldFailures(ctx, blockId, blockProps) {
    // Validation shows for the whole step at once: when any field failed, every
    // field carries errors - its own failures, or [] when it passed. When nothing
    // failed there is no errors property, matching the un-validated render.
    if (Object.keys(ctx.fieldFailures).length === 0) {
      return
    }

    blockProps.errors = ctx.fieldFailures[String(blockId)] ?? []
  },

  evaluateFunction(ctx, diagnostics, metadata, functionName, args) {
    const evaluate = () => {
      const entry = ctx.conditions.get(functionName)

      const shortCircuit = precheckShortCircuit(entry, functionName, args)

      if (shortCircuit !== undefined) {
        return shortCircuit.value
      }

      const result = entry.evaluate(...args)

      validateOutput(entry, functionName, result)

      return result
    }

    return evaluateWithDiagnostics(diagnostics, metadata, evaluate)
  },

  evaluateFunctionAsync(ctx, diagnostics, metadata, functionName, args) {
    const evaluate = async () => {
      const entry = ctx.conditions.get(functionName)

      const shortCircuit = precheckShortCircuit(entry, functionName, args)

      if (shortCircuit !== undefined) {
        return shortCircuit.value
      }

      const result = await entry.evaluate(...args)

      validateOutput(entry, functionName, result)

      return result
    }

    return evaluateWithDiagnosticsAsync(diagnostics, metadata, evaluate)
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

export function validateOutput(entry: FunctionRegistryLookupEntry, functionName: string, result: unknown): void {
  if (entry.outputSchema === undefined) {
    return
  }

  const parsed = entry.outputSchema.safeParse(result)

  if (!parsed.success) {
    throw new TypeError(`${functionName}: return value failed schema validation — ${parsed.error.message}`)
  }
}

export interface ShortCircuitOutcome {
  value: unknown
}

/**
 * Checks a function call's args against its registry entry's schemas before
 * `evaluate` runs, returning a short-circuit outcome (whose `value` replaces the
 * call result) or `undefined` to let the call proceed. Generators take no
 * injected first parameter, so their full `args` is config; every other kind
 * injects `args[0]` (value or context) and `argumentsSchema` only covers what
 * follows it. Bad config args are always an author mistake and throw, even when
 * the injected value is absent.
 *
 * An undefined injected value never reaches a condition or transformer: a
 * condition can't hold (`false`) and a transformer has nothing to transform
 * (`undefined`), regardless of any `inputSchema`. `null` is a real value and
 * flows through. Effects still receive an undefined context, since it may be
 * exactly what they act on.
 *
 * For a defined value, `inputSchema` only has a soft failure mode for
 * conditions — a wrongly-shaped field is a normal "not valid yet" outcome, so
 * they fail soft to `false`. Any other value schema failure is an author
 * mistake and throws.
 */
export function precheckShortCircuit(
  entry: FunctionRegistryLookupEntry,
  functionName: string,
  args: unknown[],
): ShortCircuitOutcome | undefined {
  const hasInjectedValue = entry.functionType !== FunctionType.GENERATOR
  const configArgs = hasInjectedValue ? args.slice(1) : args

  if (entry.argumentsSchema !== undefined) {
    const parsed = entry.argumentsSchema.safeParse(configArgs)

    if (!parsed.success) {
      throw new TypeError(`${functionName}: arguments failed schema validation — ${parsed.error.message}`)
    }
  }

  if (!hasInjectedValue) {
    return undefined
  }

  if (args[0] === undefined) {
    if (entry.functionType === FunctionType.CONDITION) {
      return { value: false }
    }

    if (entry.functionType === FunctionType.TRANSFORMER) {
      return { value: undefined }
    }
  }

  if (entry.inputSchema === undefined) {
    return undefined
  }

  const parsedValue = entry.inputSchema.safeParse(args[0])

  if (parsedValue.success) {
    return undefined
  }

  if (entry.functionType === FunctionType.CONDITION) {
    return { value: false }
  }

  throw new TypeError(`${functionName}: value failed schema validation — ${parsedValue.error.message}`)
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
