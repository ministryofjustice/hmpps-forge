interface ForgeConfigurationSerialisationErrorOptions {
  /** Path to the invalid field */
  path: (string | number)[]

  type: string
  /** Human-readable error message */
  message?: string
  /** Human-readable path through the journey DSL */
  formattedPath?: string
  /** Captured author callsite for the offending node, when available */
  callsite?: { readonly stack?: string }
}

export default class ForgeConfigurationSerialisationError extends Error {
  readonly path: (string | number)[]

  readonly formattedPath?: string

  readonly type: string

  readonly callsite?: { readonly stack?: string }

  constructor(options: ForgeConfigurationSerialisationErrorOptions) {
    const message =
      options.message ??
      `${options.type} at ${options.path.length > 0 ? options.path.join('.') : 'root'} (not JSON serializable)`

    super(message)
    this.name = new.target.name
    this.path = options.path
    this.formattedPath = options.formattedPath
    this.type = options.type
    this.callsite = options.callsite
    this.message = message
  }
}
