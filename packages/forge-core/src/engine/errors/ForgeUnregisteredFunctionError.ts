import ForgeBaseError from './ForgeBaseError'

interface ForgeUnregisteredFunctionErrorOptions {
  /** Name of the unregistered function */
  functionName: string
  /** Type of the function (e.g. FunctionType.Effect) */
  functionType: string
  /** Human-readable path through the journey DSL */
  formattedPath?: string
  /** Author callsite captured where the offending node was defined */
  callsite?: { readonly stack?: string }
}

export default class ForgeUnregisteredFunctionError extends ForgeBaseError {
  readonly functionName: string

  readonly functionType: string

  constructor(options: ForgeUnregisteredFunctionErrorOptions) {
    super(`Function "${options.functionName}" (${options.functionType}) is not registered`, options)
    this.functionName = options.functionName
    this.functionType = options.functionType
  }
}
