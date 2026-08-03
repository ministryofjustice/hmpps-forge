import ForgeBaseError from './ForgeBaseError'

interface UnregisteredComponentErrorOptions {
  /** Variant name of the unregistered component */
  variant: string
  /** Human-readable path through the journey DSL */
  formattedPath?: string
  /** Author callsite captured where the offending node was defined */
  callsite?: { readonly stack?: string }
}

export default class UnregisteredComponentError extends ForgeBaseError {
  readonly variant: string

  constructor(options: UnregisteredComponentErrorOptions) {
    super(`Component variant "${options.variant}" is not registered`, options)
    this.variant = options.variant
  }
}
