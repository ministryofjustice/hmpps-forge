import ForgeBaseError from './ForgeBaseError'

interface ForgeConfigurationSerialisationErrorOptions {
  type: string
  /** Human-readable error message */
  message?: string
  /** Human-readable path through the journey DSL */
  formattedPath?: string
  /** Captured author callsite for the offending node, when available */
  callsite?: { readonly stack?: string }
}

export default class ForgeConfigurationSerialisationError extends ForgeBaseError {
  readonly type: string

  constructor(options: ForgeConfigurationSerialisationErrorOptions) {
    super(
      options.message ?? `${options.type} at ${options.formattedPath ?? 'unknown'} (not JSON serializable)`,
      options,
    )
    this.type = options.type
  }
}
