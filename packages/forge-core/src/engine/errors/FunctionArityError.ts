import formatFields from '../../shared/utils/utils'

interface FunctionArityErrorOptions {
  /** Path to the function reference in the journey configuration */
  path: (string | number)[]
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

export default class FunctionArityError extends Error {
  readonly path: (string | number)[]

  readonly functionName: string

  readonly functionType: string

  readonly expected: string

  readonly received: number

  readonly formattedPath?: string

  readonly callsite?: { readonly stack?: string }

  constructor(options: FunctionArityErrorOptions) {
    super(
      `Function "${options.functionName}" expects ${options.expected} ${options.expected === '1' ? 'argument' : 'arguments'} but received ${options.received}`,
    )
    this.name = new.target.name
    this.path = options.path
    this.functionName = options.functionName
    this.functionType = options.functionType
    this.expected = options.expected
    this.received = options.received
    this.formattedPath = options.formattedPath
    this.callsite = options.callsite
  }

  toString() {
    const fields = [
      { label: 'Path', value: this.formattedPath ?? (this.path.length > 0 ? this.path.join('.') : 'root') },
      { label: 'Function', value: this.functionName },
      { label: 'Type', value: this.functionType },
      { label: 'Expected', value: this.expected },
      { label: 'Received', value: this.received },
    ]

    return `${this.name}: ${this.message} [${formatFields(fields)}]`
  }
}
