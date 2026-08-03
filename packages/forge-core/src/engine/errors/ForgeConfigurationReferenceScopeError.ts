import ForgeBaseError from './ForgeBaseError'

interface ForgeConfigurationReferenceScopeErrorOptions {
  /** Human-readable error message */
  message: string
  /** Human-readable path through the journey DSL */
  formattedPath: string
  /** Author callsite captured where the offending node was defined */
  callsite?: { readonly stack?: string }
}

export default class ForgeConfigurationReferenceScopeError extends ForgeBaseError {
  constructor(options: ForgeConfigurationReferenceScopeErrorOptions) {
    super(options.message, options)
  }
}
