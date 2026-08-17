import ForgeBaseError from './ForgeBaseError'

interface ForgeFunctionArityErrorOptions {
  /** Name of the function whose arity is wrong */
  functionName: string
  /** Type of the function (e.g. FunctionType.Condition) */
  functionType: string
  /** Human-readable description of the expected arity (e.g. "2", "at least 2", "between 1 and 3") */
  expected: string
  /** Number of arguments the author actually supplied */
  received: number
  /** Human-readable path through the journey DSL */
  formattedPath?: string
  /** Author callsite captured where the offending node was defined */
  callsite?: { readonly stack?: string }
}

export default class ForgeFunctionArityError extends ForgeBaseError {
  readonly functionName: string

  readonly functionType: string

  readonly expected: string

  readonly received: number

  constructor(options: ForgeFunctionArityErrorOptions) {
    super(
      `Function "${options.functionName}" expects ${options.expected} ${options.expected === '1' ? 'argument' : 'arguments'} but received ${options.received}`,
      options,
    )
    this.functionName = options.functionName
    this.functionType = options.functionType
    this.expected = options.expected
    this.received = options.received
  }
}
