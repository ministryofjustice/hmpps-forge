import { z, type ZodType } from 'zod'
import { FunctionCallType, FunctionEntryType } from '../../shared/taxonomy'
import { captureCallsite, stampCallsite } from '../builders/utils/captureCallsite'
import { stampEntry } from '../builders/utils/stampEntry'
import type { FunctionEntry } from '../types/functions.type'

/**
 * The options every entry kind shares.
 *
 * @typeParam TPrepareArguments - The parameters `prepare` declares, which become the entry's call signature when present
 */
export interface BaseEntryOptions<TPrepareArguments extends any[]> {
  /** Validates the authored arguments at runtime, and drives arity checking at compilation. */
  argumentsSchema?: ZodType

  /** Validates the evaluator's result at runtime. */
  outputSchema?: ZodType

  /** Adjusts the authored arguments before they are embedded in the expression. Runs on every call; its parameters become the entry's call signature. */
  prepare?(...args: TPrepareArguments): unknown[]
}

/**
 * Identifies a function entry produced by `condition()` and friends, as
 * distinct from a `BaseFunctionRegistry` in a package's `functions` array.
 */
export function isFunctionEntry(value: unknown): value is FunctionEntry {
  if (typeof value !== 'function' && (typeof value !== 'object' || value === null)) {
    return false
  }

  const candidate = value as Partial<FunctionEntry>

  return typeof candidate._forge === 'string' && typeof candidate.factory === 'function'
}

interface AnyEntryOptions {
  inputSchema?: ZodType
  argumentsSchema?: ZodType
  outputSchema?: ZodType
  prepare?: (...args: any[]) => any[]
  factory: (deps: any) => (...args: any[]) => any
}

type EntryHandle = ((...args: any[]) => unknown) & FunctionEntry

export type CallResultBuilder = (name: string, prepared: any[], handle: EntryHandle) => unknown

const ENTRY_TAGS: Record<FunctionCallType, FunctionEntryType> = {
  [FunctionCallType.CONDITION]: FunctionEntryType.CONDITION,
  [FunctionCallType.TRANSFORMER]: FunctionEntryType.TRANSFORMER,
  [FunctionCallType.GENERATOR]: FunctionEntryType.GENERATOR,
  [FunctionCallType.EFFECT]: FunctionEntryType.EFFECT,
}

function compileSchema(schema: ZodType | undefined): ZodType | undefined {
  if (schema === undefined) {
    return undefined
  }

  return z.compile(schema)
}

export const createEntry = (
  functionType: FunctionCallType,
  helperName: string,
  first: string | AnyEntryOptions,
  second: AnyEntryOptions | undefined,
  buildCallResult: CallResultBuilder,
): any => {
  const name = typeof first === 'string' ? first : undefined
  const options = typeof first === 'string' ? second! : first
  const { inputSchema, argumentsSchema, outputSchema, prepare, factory } = options

  // Expressions carry the author name as a label - anonymous entries the helper
  // name. Collection resolves collisions by pointer identity and renames the
  // colliding expressions, so the label needs no uniqueness here.
  const expressionName = name ?? helperName

  const handle = (...args: any[]): unknown => {
    const prepared = prepare ? prepare(...args) : args

    return buildCallResult(expressionName, prepared, entry)
  }

  // Object.assign cannot set `name` - functions own it as read-only - so it is
  // defined explicitly; configurable, so redefinition is allowed.
  Object.defineProperty(handle, 'name', { value: name, configurable: true })

  const entry = Object.assign(handle, {
    _forge: ENTRY_TAGS[functionType],
    inputSchema: compileSchema(inputSchema),
    argumentsSchema: compileSchema(argumentsSchema),
    outputSchema: compileSchema(outputSchema),
    factory,
  }) as EntryHandle

  return entry
}

export const buildExpression =
  (type: FunctionCallType): CallResultBuilder =>
  (name, prepared, entry) => {
    const expr = { _forge: type, name, arguments: prepared }

    stampCallsite(expr, captureCallsite(entry))
    stampEntry(expr, entry)
    return expr
  }
