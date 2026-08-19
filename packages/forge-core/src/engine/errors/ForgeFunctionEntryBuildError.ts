import ForgeBaseError from './ForgeBaseError'

interface ForgeFunctionEntryBuildErrorOptions {
  /** Author-facing name of the function - its assigned registry name */
  functionName: string
  /** Type of the function (e.g. FunctionType.Condition) */
  functionType: string
  /** What the factory threw */
  cause: unknown
  /** Human-readable path through the journey DSL, where known */
  formattedPath?: string
  /** Author callsite captured where the expression was built, where known */
  callsite?: { readonly stack?: string }
}

/**
 * Raised when a function entry's factory throws while its evaluator is built
 * during registration.
 */
export default class ForgeFunctionEntryBuildError extends ForgeBaseError {
  readonly functionName: string

  readonly functionType: string

  readonly cause: unknown

  constructor(options: ForgeFunctionEntryBuildErrorOptions) {
    super(`Function "${options.functionName}" (${options.functionType}) factory threw during registration`, options)
    this.functionName = options.functionName
    this.functionType = options.functionType
    this.cause = options.cause
  }
}
