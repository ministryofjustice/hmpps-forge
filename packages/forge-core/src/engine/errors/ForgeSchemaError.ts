import ForgeBaseError from './ForgeBaseError'

interface ForgeSchemaErrorOptions {
  /** Human-readable error message */
  message: string
  /** Expected value type/format */
  expected?: string
  /** Human-readable path through the journey DSL */
  formattedPath?: string
  /** Captured author callsite for the offending node, when available */
  callsite?: { readonly stack?: string }
}

export default class ForgeSchemaError extends ForgeBaseError {
  readonly expected?: string

  constructor(options: ForgeSchemaErrorOptions) {
    super(options.message, options)
    this.expected = options.expected
  }
}
