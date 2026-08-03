interface ForgeConfigurationSchemaErrorOptions {
  /** Path to the invalid field */
  path: (string | number)[]
  /** Human-readable error message */
  message: string
  /** Expected value type/format */
  expected?: string
  /** Human-readable path through the journey DSL */
  formattedPath?: string
  /** Captured author callsite for the offending node, when available */
  callsite?: { readonly stack?: string }
}

export default class ForgeConfigurationSchemaError extends Error {
  readonly expected?: string

  readonly path: (string | number)[]

  readonly formattedPath?: string

  readonly callsite?: { readonly stack?: string }

  constructor(options: ForgeConfigurationSchemaErrorOptions) {
    super(options.message)
    this.name = new.target.name
    this.message = options.message
    this.path = options.path
    this.expected = options.expected
    this.formattedPath = options.formattedPath
    this.callsite = options.callsite
  }
}
