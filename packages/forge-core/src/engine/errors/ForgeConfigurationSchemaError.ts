import ForgeBaseError from './ForgeBaseError'

interface ForgeConfigurationSchemaErrorOptions {
  /** Human-readable error message */
  message: string
  /** Expected value type/format */
  expected?: string
  /** Human-readable path through the journey DSL */
  formattedPath?: string
  /** Captured author callsite for the offending node, when available */
  callsite?: { readonly stack?: string }
}

export default class ForgeConfigurationSchemaError extends ForgeBaseError {
  readonly expected?: string

  constructor(options: ForgeConfigurationSchemaErrorOptions) {
    super(options.message, options)
    this.expected = options.expected
  }
}
