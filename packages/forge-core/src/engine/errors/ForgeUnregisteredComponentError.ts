import ForgeBaseError from './ForgeBaseError'

interface ForgeUnregisteredComponentErrorOptions {
  /** Variant name of the unregistered component */
  variant: string
  /** Human-readable path through the journey DSL */
  formattedPath?: string
  /** Author callsite captured where the offending node was defined */
  callsite?: { readonly stack?: string }
}

export default class ForgeUnregisteredComponentError extends ForgeBaseError {
  readonly variant: string

  constructor(options: ForgeUnregisteredComponentErrorOptions) {
    super(`Component variant "${options.variant}" is not registered`, options)
    this.variant = options.variant
  }
}
