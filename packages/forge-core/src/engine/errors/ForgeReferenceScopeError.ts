import ForgeBaseError from './ForgeBaseError'

interface ForgeReferenceScopeErrorOptions {
  /** Human-readable error message */
  message: string
  /** Human-readable path through the journey DSL */
  formattedPath: string
  /** Author callsite captured where the offending node was defined */
  callsite?: { readonly stack?: string }
}

export default class ForgeReferenceScopeError extends ForgeBaseError {
  constructor(options: ForgeReferenceScopeErrorOptions) {
    super(options.message, options)
  }
}
