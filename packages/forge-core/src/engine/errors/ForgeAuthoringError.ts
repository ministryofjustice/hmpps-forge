import ForgeBaseError from './ForgeBaseError'

interface ForgeAuthoringErrorOptions {
  /** Human-readable error message */
  message: string
  /** Human-readable path through the journey DSL */
  formattedPath?: string
  /** Author callsite captured where the offending definition was written */
  callsite?: { readonly stack?: string }
}

/**
 * The authoring API was misused in a way the schema never gets to see -
 * thrown while builders and DSL helpers are still assembling the definition.
 */
export default class ForgeAuthoringError extends ForgeBaseError {
  constructor(options: ForgeAuthoringErrorOptions) {
    super(options.message, options)
  }
}
