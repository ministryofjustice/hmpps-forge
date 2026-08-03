import ForgeBaseError from './ForgeBaseError'

interface ForgeInvalidNodeErrorOptions {
  /** Specific validation failure message */
  message: string
  /** The invalid node */
  node?: any
  /** What was expected */
  expected?: string
  /** What was actually found */
  actual?: string
  /** Human-readable path through the journey DSL */
  formattedPath?: string
  /** Author callsite captured where the offending node was defined */
  callsite?: { readonly stack?: string }
}

export default class ForgeInvalidNodeError extends ForgeBaseError {
  readonly node?: any

  readonly expected?: string

  readonly actual?: string

  constructor(options: ForgeInvalidNodeErrorOptions) {
    let { message } = options

    if (options.expected && options.actual) {
      message += ` (expected: ${options.expected}, got: ${options.actual})`
    }

    if (options.formattedPath) {
      message += ` at ${options.formattedPath}`
    }

    super(message, options)
    this.node = options.node
    this.expected = options.expected
    this.actual = options.actual
  }
}
