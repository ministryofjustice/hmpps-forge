import formatFields from '../../shared/utils/utils'

interface UnregisteredFunctionErrorOptions {
  /** Path to the function reference in the journey configuration */
  path: (string | number)[]
  /** Name of the unregistered function */
  functionName: string
  /** Type of the function (e.g. FunctionType.Effect) */
  functionType: string
  /** Human-readable path through the journey DSL */
  formattedPath?: string
  /** Author callsite captured where the offending node was defined */
  callsite?: { readonly stack?: string }
}

export default class UnregisteredFunctionError extends Error {
  readonly path: (string | number)[]

  readonly functionName: string

  readonly functionType: string

  readonly formattedPath?: string

  readonly callsite?: { readonly stack?: string }

  constructor(options: UnregisteredFunctionErrorOptions) {
    super(`Function "${options.functionName}" (${options.functionType}) is not registered`)
    this.name = new.target.name
    this.path = options.path
    this.functionName = options.functionName
    this.functionType = options.functionType
    this.formattedPath = options.formattedPath
    this.callsite = options.callsite
  }

  toString() {
    const fields = [
      { label: 'Path', value: this.formattedPath ?? (this.path.length > 0 ? this.path.join('.') : 'root') },
      { label: 'Function', value: this.functionName },
      { label: 'Type', value: this.functionType },
    ]

    return `${this.name}: ${this.message} [${formatFields(fields)}]`
  }
}
