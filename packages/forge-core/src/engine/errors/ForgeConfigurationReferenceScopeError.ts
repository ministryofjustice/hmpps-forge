interface ForgeConfigurationReferenceScopeErrorOptions {
  /** Path to the invalid reference expression */
  path: (string | number)[]
  /** Human-readable error message */
  message: string
  /** Human-readable path through the journey DSL */
  formattedPath: string
  /** Author callsite captured where the offending node was defined */
  callsite?: { readonly stack?: string }
}

export default class ForgeConfigurationReferenceScopeError extends Error {
  readonly path: (string | number)[]

  readonly formattedPath: string

  readonly callsite?: { readonly stack?: string }

  constructor(options: ForgeConfigurationReferenceScopeErrorOptions) {
    super(options.message)
    this.name = new.target.name
    this.message = options.message
    this.path = options.path
    this.formattedPath = options.formattedPath
    this.callsite = options.callsite
  }
}
