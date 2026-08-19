import type { ZodType } from 'zod'
import { RENDER_BLOCK_BRAND } from '../../../concerns/render/contracts/renderBlock.brand'
import { FunctionType } from '../../../../authoring/types/enums'

interface AnswerHistory {
  current: unknown
  parsed?: unknown
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

interface RenderFieldFailureContext extends ComponentInputContext {
  fieldFailures: Record<string, unknown[]>
  fieldFailureAnchors: Record<string, string>
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
  errorAnchor?(props: Record<string, unknown>): string | undefined
}

interface ComponentInputContext {
  components: {
    get(variant: string): ComponentRegistryLookupEntry | undefined
  }
}

interface FieldPreparationContext extends AnswerHistoryContext, ComponentInputContext {
  post: Record<string, unknown>
}

/** One entry of a generated step's `fieldDefinitions` array; the callbacks carry the compiled authored expressions. */
interface PreparedFieldDefinition {
  code: string
  component: string
  acceptsMultipleValues: boolean
  validatesInput: boolean
  formatSubmittedValue?: (value: unknown) => unknown
  evaluateDependentWhen?: () => unknown
  resolveDefaultValue?: () => unknown
  parseStoredValue?: (value: unknown) => unknown
}

interface PreparedFieldAnswer {
  code: string
  mode: 'POST' | 'GET'
  current: unknown
  parsed: unknown
  mutations: { value: unknown; source: string }[]
}

type TransformerThunk = (value: unknown) => unknown

interface RuntimeDiagnosticState {
  readonly nodeId?: string
  readonly formattedPath?: string
  readonly functionName?: string
  readonly functionType?: string
  readonly definedAt?: string
}

interface RuntimeEvaluationDiagnostics {
  current: RuntimeDiagnosticState | undefined
  resolve(reference: number): RuntimeDiagnosticState | undefined
  wrap(error: unknown, reference?: number): unknown
}

interface RuntimeValidationRule {
  readonly condition?: () => unknown
  readonly details?: unknown | (() => unknown)
  readonly evaluate?: () => unknown
  readonly groups?: unknown
  readonly message?: unknown | (() => unknown)
  readonly passed?: unknown
  readonly submissionOnly?: boolean
}

interface RuntimeValidationFailure {
  readonly rule: RuntimeValidationRule
  readonly message: unknown
  readonly details: unknown
}

/** Identifies the field a validation failure belongs to; template fields compute their block id per iteration. */
interface FieldValidationIdentity {
  readonly blockId: unknown
  readonly blockCode: unknown
}

interface RuntimeDomainValidationFailure {
  readonly passed: false
  readonly message: unknown
  readonly submissionOnly: boolean
  readonly groups: unknown
  readonly details: unknown
}

interface RuntimeFieldValidationFailure extends RuntimeDomainValidationFailure {
  readonly blockId: unknown
  readonly blockCode: unknown
}

const VALIDATION_CONDITION_FUNCTION_TYPE = 'FunctionType.Condition'

export interface GeneratedFunctionRuntimeLibrary {
  renderBlockBrand: symbol
  ensureAnswerHistory(ctx: AnswerHistoryContext, code: string): AnswerHistory
  pushAnswerMutation(answerHistory: AnswerHistory, value: unknown, source: string): void
  normalizePostValue(rawValue: unknown, multiple: boolean): unknown
  checkComponentInputValue(ctx: ComponentInputContext, variant: string, value: unknown, multiple: boolean): unknown
  groupFieldDefinitionsByCode(definitions: readonly PreparedFieldDefinition[]): PreparedFieldDefinition[][]
  preparePostedFieldAnswerGroup(
    ctx: FieldPreparationContext,
    fields: readonly PreparedFieldDefinition[],
  ): Promise<PreparedFieldAnswer>
  prepareStoredFieldAnswerGroup(
    ctx: AnswerHistoryContext,
    fields: readonly PreparedFieldDefinition[],
  ): Promise<PreparedFieldAnswer>
  applyTransformerPipeline(value: unknown, transformers: readonly TransformerThunk[]): unknown
  applyTransformerPipelineAsync(value: unknown, transformers: readonly TransformerThunk[]): Promise<unknown>
  resolveFieldValue(ctx: RenderFieldValueContext, blockProps: Record<string, unknown>): void
  resolveFieldFailures(
    ctx: RenderFieldFailureContext,
    blockId: unknown,
    variant: string,
    blockProps: Record<string, unknown>,
  ): void
  evaluateFunction(
    ctx: FunctionEvaluationContext,
    diagnostics: RuntimeEvaluationDiagnostics | undefined,
    diagnosticReference: number,
    functionName: string,
    args: unknown[],
  ): unknown
  evaluateFunctionAsync(
    ctx: FunctionEvaluationContext,
    diagnostics: RuntimeEvaluationDiagnostics | undefined,
    diagnosticReference: number,
    functionName: string,
    args: unknown[],
  ): Promise<unknown>
  evaluateTracked(
    diagnostics: RuntimeEvaluationDiagnostics | undefined,
    diagnosticReference: number,
    evaluate: () => unknown,
  ): unknown
  evaluateTrackedAsync(
    diagnostics: RuntimeEvaluationDiagnostics | undefined,
    diagnosticReference: number,
    evaluate: () => Promise<unknown>,
  ): Promise<unknown>
  collectFieldValidationFailures(
    results: unknown,
    ruleIsActive: (rule: RuntimeValidationRule) => boolean,
    identity: FieldValidationIdentity,
  ): RuntimeFieldValidationFailure[]
  collectFieldValidationFailuresAsync(
    results: unknown,
    ruleIsActive: (rule: RuntimeValidationRule) => boolean,
    identity: FieldValidationIdentity,
  ): Promise<RuntimeFieldValidationFailure[]>
  collectDomainValidationFailures(
    results: unknown,
    ruleIsActive: (rule: RuntimeValidationRule) => boolean,
  ): RuntimeDomainValidationFailure[]
  collectDomainValidationFailuresAsync(
    results: unknown,
    ruleIsActive: (rule: RuntimeValidationRule) => boolean,
  ): Promise<RuntimeDomainValidationFailure[]>
}

export const generatedFunctionRuntimeLibrary: GeneratedFunctionRuntimeLibrary = {
  renderBlockBrand: RENDER_BLOCK_BRAND,

  // Answer-preparation functions are detached from this object by generated
  // code (`mode === "POST" ? _forgeHelpers.preparePostedFieldAnswerGroup : ...`),
  // so they and everything they call live as module functions free of `this`.
  ensureAnswerHistory,
  pushAnswerMutation,
  normalizePostValue,
  checkComponentInputValue,
  groupFieldDefinitionsByCode,
  preparePostedFieldAnswerGroup,
  prepareStoredFieldAnswerGroup,
  applyTransformerPipeline,
  applyTransformerPipelineAsync,

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

  resolveFieldFailures(ctx, blockId, variant, blockProps) {
    // Validation shows for the whole step at once: when any field failed, every
    // field carries errors - its own failures, or [] when it passed. When nothing
    // failed there is no errors property, matching the un-validated render.
    if (Object.keys(ctx.fieldFailures).length === 0) {
      return
    }

    const failures = ctx.fieldFailures[String(blockId)] ?? []

    blockProps.errors = failures

    if (failures.length === 0) {
      return
    }

    // The failing block instance's document anchor, for the error summary link.
    // The component owns the ids it renders, so it declares how to derive the
    // anchor; without a declaration the anchor is the field code.
    const anchor = ctx.components.get(variant)?.errorAnchor?.(blockProps) ?? blockProps.code

    if (typeof anchor === 'string') {
      ctx.fieldFailureAnchors[String(blockId)] = anchor
    }
  },

  evaluateFunction(ctx, diagnostics, diagnosticReference, functionName, args) {
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

    return evaluateWithDiagnostics(diagnostics, diagnosticReference, evaluate)
  },

  evaluateFunctionAsync(ctx, diagnostics, diagnosticReference, functionName, args) {
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

    return evaluateWithDiagnosticsAsync(diagnostics, diagnosticReference, evaluate)
  },

  evaluateTracked(diagnostics, diagnosticReference, evaluate) {
    return evaluateWithDiagnostics(diagnostics, diagnosticReference, evaluate)
  },

  evaluateTrackedAsync(diagnostics, diagnosticReference, evaluate) {
    return evaluateWithDiagnosticsAsync(diagnostics, diagnosticReference, evaluate)
  },

  collectFieldValidationFailures(results, ruleIsActive, identity) {
    return collectValidationFailures(results, ruleIsActive).map(failure => toFieldValidationFailure(failure, identity))
  },

  async collectFieldValidationFailuresAsync(results, ruleIsActive, identity) {
    const failures = await collectValidationFailuresAsync(results, ruleIsActive)

    return failures.map(failure => toFieldValidationFailure(failure, identity))
  },

  collectDomainValidationFailures(results, ruleIsActive) {
    return collectValidationFailures(results, ruleIsActive).map(toDomainValidationFailure)
  },

  async collectDomainValidationFailuresAsync(results, ruleIsActive) {
    const failures = await collectValidationFailuresAsync(results, ruleIsActive)

    return failures.map(toDomainValidationFailure)
  },
}

function ensureAnswerHistory(ctx: AnswerHistoryContext, code: string): AnswerHistory {
  let answerHistory = ctx.answers[code]

  if (!answerHistory) {
    answerHistory = { current: undefined, mutations: [] }
    ctx.answers[code] = answerHistory
  }

  return answerHistory
}

function pushAnswerMutation(answerHistory: AnswerHistory, value: unknown, source: string): void {
  answerHistory.mutations.push({ value, source })
  answerHistory.current = value
}

function normalizePostValue(rawValue: unknown, multiple: boolean): unknown {
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
}

/**
 * Checks a submitted value against the component variant's `inputSchema` after
 * normalisation. A value that fails the schema can't have come from the
 * rendered form, so it's replaced with an empty value (`[]` for multi-value
 * fields, `undefined` for single-value fields) rather than throwing. A passing
 * value is returned unchanged (no Zod coercion in v1). An unanswered value,
 * an unknown variant, or a variant without a schema is left untouched.
 */
function checkComponentInputValue(
  ctx: ComponentInputContext,
  variant: string,
  value: unknown,
  multiple: boolean,
): unknown {
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
}

/**
 * Groups same-code field definitions into variant groups, preserving
 * declaration order. Runs at request time because iterator template fields
 * only resolve their codes per request; entries without a resolvable code
 * each stay in their own group.
 */
function groupFieldDefinitionsByCode(definitions: readonly PreparedFieldDefinition[]): PreparedFieldDefinition[][] {
  const groups: PreparedFieldDefinition[][] = []
  const groupsByCode = new Map<string, PreparedFieldDefinition[]>()

  definitions.forEach(definition => {
    const existingGroup = definition.code === undefined ? undefined : groupsByCode.get(definition.code)

    if (existingGroup !== undefined) {
      existingGroup.push(definition)

      return
    }

    const group = [definition]

    groups.push(group)
    if (definition.code !== undefined) {
      groupsByCode.set(definition.code, group)
    }
  })

  return groups
}

/**
 * Picks the active owner of a same-code variant group: the first field in
 * declaration order whose `dependentWhen` holds (or which has none). Only the
 * owner runs preparation; inactive variants contribute nothing.
 */
async function findActiveFieldVariant(
  fields: readonly PreparedFieldDefinition[],
): Promise<PreparedFieldDefinition | undefined> {
  // Sequential on purpose: first active variant in declaration order wins.
  for (const field of fields) {
    if (field.evaluateDependentWhen === undefined || (await field.evaluateDependentWhen())) {
      return field
    }
  }

  return undefined
}

async function preparePostedFieldAnswerGroup(
  ctx: FieldPreparationContext,
  fields: readonly PreparedFieldDefinition[],
): Promise<PreparedFieldAnswer> {
  if (fields.length === 1) {
    return preparePostedFieldAnswer(ctx, fields[0])
  }

  const activeField = await findActiveFieldVariant(fields)

  if (activeField === undefined) {
    // No variant is active, so the logical field clears its stale answer once.
    pushAnswerMutation(ensureAnswerHistory(ctx, fields[0].code), undefined, 'dependentWhen')

    return buildPreparedFieldAnswer(ctx, fields[0].code, 'POST')
  }

  await runPostedFieldPipeline(ctx, activeField)

  return buildPreparedFieldAnswer(ctx, activeField.code, 'POST')
}

async function prepareStoredFieldAnswerGroup(
  ctx: AnswerHistoryContext,
  fields: readonly PreparedFieldDefinition[],
): Promise<PreparedFieldAnswer> {
  if (fields.length === 1) {
    return prepareStoredFieldAnswer(ctx, fields[0])
  }

  const activeField = await findActiveFieldVariant(fields)

  if (activeField === undefined) {
    // No variant is active: no defaults, no parsing, just the stored view.
    return buildPreparedFieldAnswer(ctx, fields[0].code, 'GET')
  }

  return prepareStoredFieldAnswer(ctx, activeField)
}

async function preparePostedFieldAnswer(
  ctx: FieldPreparationContext,
  field: PreparedFieldDefinition,
): Promise<PreparedFieldAnswer> {
  await runPostedFieldPipeline(ctx, field)

  if (field.evaluateDependentWhen !== undefined) {
    const dependentWhenResult = await field.evaluateDependentWhen()

    if (!dependentWhenResult) {
      pushAnswerMutation(ensureAnswerHistory(ctx, field.code), undefined, 'dependentWhen')
    }
  }

  return buildPreparedFieldAnswer(ctx, field.code, 'POST')
}

async function runPostedFieldPipeline(ctx: FieldPreparationContext, field: PreparedFieldDefinition): Promise<void> {
  const answerHistory = ensureAnswerHistory(ctx, field.code)
  let rawValue = normalizePostValue(ctx.post[field.code], field.acceptsMultipleValues)

  if (field.validatesInput) {
    rawValue = checkComponentInputValue(ctx, field.component, rawValue, field.acceptsMultipleValues)
  }

  pushAnswerMutation(answerHistory, rawValue, 'post')

  if (field.formatSubmittedValue !== undefined) {
    const formattedValue = await field.formatSubmittedValue(rawValue)

    if (formattedValue !== rawValue) {
      pushAnswerMutation(answerHistory, formattedValue, 'processed')
    }
  }
}

async function prepareStoredFieldAnswer(
  ctx: AnswerHistoryContext,
  field: PreparedFieldDefinition,
): Promise<PreparedFieldAnswer> {
  let answerHistory: AnswerHistory | undefined = ctx.answers[field.code]

  if (answerHistory?.current === undefined) {
    answerHistory = ensureAnswerHistory(ctx, field.code)
    const defaultValue = field.resolveDefaultValue === undefined ? undefined : await field.resolveDefaultValue()

    pushAnswerMutation(answerHistory, defaultValue, 'default')
  }

  if (answerHistory.current !== undefined && field.parseStoredValue !== undefined) {
    const parsedValue = await field.parseStoredValue(answerHistory.current)

    if (parsedValue !== undefined) {
      answerHistory.parsed = parsedValue
    }
  }

  return buildPreparedFieldAnswer(ctx, field.code, 'GET')
}

function buildPreparedFieldAnswer(
  ctx: AnswerHistoryContext,
  fieldCode: string,
  mode: 'POST' | 'GET',
): PreparedFieldAnswer {
  const preparedAnswerHistory: AnswerHistory | undefined = ctx.answers[fieldCode]

  return {
    code: fieldCode,
    mode,
    current: preparedAnswerHistory?.current,
    parsed: preparedAnswerHistory?.parsed,
    mutations: preparedAnswerHistory?.mutations.slice() ?? [],
  }
}

/**
 * Runs a field's transformer thunks in order. A thunk returning `undefined`
 * keeps the previous value; a thunk throwing a TypeError (an authored
 * transformer rejecting the value's shape) reverts to the original value and
 * abandons the rest of the pipeline. Any other error propagates.
 */
function applyTransformerPipeline(value: unknown, transformers: readonly TransformerThunk[]): unknown {
  let transformedValue = value

  try {
    transformers.forEach(transformer => {
      const transformerResult = transformer(transformedValue)

      if (transformerResult !== undefined) {
        transformedValue = transformerResult
      }
    })
  } catch (error) {
    if (isTransformerTypeError(error)) {
      return value
    }

    throw error
  }

  return transformedValue
}

async function applyTransformerPipelineAsync(
  value: unknown,
  transformers: readonly TransformerThunk[],
): Promise<unknown> {
  let transformedValue = value

  try {
    // Sequential on purpose: each transformer receives the previous one's output.
    for (const transformer of transformers) {
      const transformerResult = await transformer(transformedValue)

      if (transformerResult !== undefined) {
        transformedValue = transformerResult
      }
    }
  } catch (error) {
    if (isTransformerTypeError(error)) {
      return value
    }

    throw error
  }

  return transformedValue
}

function isTransformerTypeError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true
  }

  return isRecord(error) && error.cause instanceof TypeError
}

function collectValidationFailures(
  results: unknown,
  ruleIsActive: (rule: RuntimeValidationRule) => boolean,
): RuntimeValidationFailure[] {
  const failures: RuntimeValidationFailure[] = []
  const validationStack = [results]
  let validationRule = takeNextActiveValidationRule(validationStack, ruleIsActive)

  while (validationRule !== undefined) {
    const validationPassed = evaluateValidationRule(validationRule)

    if (!validationPassed) {
      const validationMessage = resolveValidationRuleValue(validationRule, validationRule.message, '')
      const validationDetails = resolveValidationRuleValue(validationRule, validationRule.details, undefined)

      failures.push({ rule: validationRule, message: validationMessage, details: validationDetails })
    }

    validationRule = takeNextActiveValidationRule(validationStack, ruleIsActive)
  }

  return failures
}

async function collectValidationFailuresAsync(
  results: unknown,
  ruleIsActive: (rule: RuntimeValidationRule) => boolean,
): Promise<RuntimeValidationFailure[]> {
  const failures: RuntimeValidationFailure[] = []
  const validationStack = [results]
  let validationRule = takeNextActiveValidationRule(validationStack, ruleIsActive)

  while (validationRule !== undefined) {
    const validationPassed = await evaluateValidationRuleAsync(validationRule)

    if (!validationPassed) {
      const validationMessage = await resolveValidationRuleValue(validationRule, validationRule.message, '')
      const validationDetails = await resolveValidationRuleValue(validationRule, validationRule.details, undefined)

      failures.push({ rule: validationRule, message: validationMessage, details: validationDetails })
    }

    validationRule = takeNextActiveValidationRule(validationStack, ruleIsActive)
  }

  return failures
}

function toFieldValidationFailure(
  failure: RuntimeValidationFailure,
  identity: FieldValidationIdentity,
): RuntimeFieldValidationFailure {
  return {
    blockId: identity.blockId,
    blockCode: identity.blockCode,
    ...toDomainValidationFailure(failure),
  }
}

function toDomainValidationFailure(failure: RuntimeValidationFailure): RuntimeDomainValidationFailure {
  return {
    passed: false,
    message: failure.message,
    submissionOnly: failure.rule.submissionOnly === true,
    groups: failure.rule.groups,
    details: failure.details,
  }
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
 * Validates a function call's arguments against its registry entry's schemas
 * before `evaluate` runs. Returns a short-circuit outcome (whose `value`
 * replaces the call result) or `undefined` to let the call proceed normally.
 *
 * Generators have no injected first parameter, so all their `args` are config.
 * Every other function kind (condition, transformer, effect) receives its
 * input value as `args[0]`, and `argumentsSchema` covers only the remaining
 * arguments. Invalid config arguments are always an author mistake and throw,
 * even when the input value is absent.
 *
 * An undefined input value never reaches a condition or transformer: a
 * condition can't hold (`false`) and a transformer has nothing to transform
 * (`undefined`), regardless of any `inputSchema`. `null` is a real value and
 * flows through. Effects still receive an undefined context, since it may be
 * exactly what they act on.
 *
 * For a defined value, `inputSchema` only fails softly for conditions -- a
 * wrongly-shaped field is a normal "not valid yet" outcome, so they return
 * `false`. Any other value schema failure is an author mistake and throws.
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
  diagnosticReference: number,
  evaluate: () => unknown,
): unknown {
  const previous = enterDiagnostics(diagnostics, diagnosticReference)

  try {
    return evaluate()
  } catch (error) {
    throw wrapDiagnosticError(diagnostics, diagnosticReference, error)
  } finally {
    exitDiagnostics(diagnostics, previous)
  }
}

async function evaluateWithDiagnosticsAsync(
  diagnostics: RuntimeEvaluationDiagnostics | undefined,
  diagnosticReference: number,
  evaluate: () => Promise<unknown>,
): Promise<unknown> {
  const previous = enterDiagnostics(diagnostics, diagnosticReference)

  try {
    return await evaluate()
  } catch (error) {
    throw wrapDiagnosticError(diagnostics, diagnosticReference, error)
  } finally {
    exitDiagnostics(diagnostics, previous)
  }
}

function enterDiagnostics(
  diagnostics: RuntimeEvaluationDiagnostics | undefined,
  diagnosticReference: number,
): RuntimeDiagnosticState | undefined {
  if (diagnostics === undefined) {
    return undefined
  }

  const previous = diagnostics.current
  const metadata = diagnostics.resolve(diagnosticReference)

  if (metadata !== undefined) {
    diagnostics.current = metadata
  }

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
  diagnosticReference: number,
  error: unknown,
): unknown {
  if (diagnostics === undefined) {
    return error
  }

  return diagnostics.wrap(error, diagnosticReference)
}

function takeNextActiveValidationRule(
  validationStack: unknown[],
  ruleIsActive: (rule: RuntimeValidationRule) => boolean,
): RuntimeValidationRule | undefined {
  while (validationStack.length > 0) {
    const candidate = validationStack.pop()

    if (candidate === null || candidate === undefined) {
      continue
    }

    if (Array.isArray(candidate)) {
      candidate.toReversed().forEach(item => validationStack.push(item))

      continue
    }

    const validationRule = candidate as RuntimeValidationRule

    if (ruleIsActive(validationRule)) {
      return validationRule
    }
  }

  return undefined
}

function resolveValidationRuleValue(
  rule: RuntimeValidationRule,
  evaluate: unknown | (() => unknown),
  fallback: unknown,
): unknown {
  if (typeof evaluate === 'function') {
    return evaluate.call(rule)
  }

  return evaluate === undefined ? fallback : evaluate
}

function evaluateValidationRule(rule: RuntimeValidationRule): unknown {
  if (typeof rule.condition === 'function') {
    return evaluateValidationCondition(rule, rule.condition)
  }

  if (typeof rule.evaluate === 'function') {
    return rule.evaluate.call(rule)
  }

  return rule.passed
}

async function evaluateValidationRuleAsync(rule: RuntimeValidationRule): Promise<unknown> {
  if (typeof rule.condition === 'function') {
    return evaluateValidationConditionAsync(rule, rule.condition)
  }

  return evaluateValidationRule(rule)
}

function evaluateValidationCondition(rule: RuntimeValidationRule, condition: () => unknown): boolean {
  try {
    return !!condition.call(rule)
  } catch (error) {
    if (isValidationConditionTypeError(error)) {
      return false
    }

    throw error
  }
}

async function evaluateValidationConditionAsync(
  rule: RuntimeValidationRule,
  condition: () => unknown,
): Promise<boolean> {
  try {
    return !!(await condition.call(rule))
  } catch (error) {
    if (isValidationConditionTypeError(error)) {
      return false
    }

    throw error
  }
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
