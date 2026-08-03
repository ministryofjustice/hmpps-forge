import ForgeBaseError from './ForgeBaseError'

interface UnknownNodeTypeErrorOptions {
  /** The unknown type encountered */
  nodeType?: string
  /** The actual node object */
  node?: any
  /** List of valid types (for helpful error messages) */
  validTypes?: string[]
  /** Human-readable path through the journey DSL */
  formattedPath?: string
  /** Author callsite captured where the offending node was defined */
  callsite?: { readonly stack?: string }
}

export default class UnknownNodeTypeError extends ForgeBaseError {
  readonly nodeType?: string

  readonly node?: any

  readonly validTypes?: string[]

  constructor(options: UnknownNodeTypeErrorOptions) {
    const nodeType = options.nodeType || 'undefined'

    let message = `Unknown node type: ${nodeType}`

    if (options.node && typeof options.node === 'object') {
      const keys = Object.keys(options.node)
      if (keys.length > 0) {
        message += ` (found object with keys: ${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''})`
      } else {
        message += ' (found empty object)'
      }
    } else if (options.node !== undefined) {
      message += ` (found ${typeof options.node}: ${JSON.stringify(options.node).slice(0, 50)})`
    }

    if (options.formattedPath) {
      message += ` at ${options.formattedPath}`
    }

    super(message, options)
    this.nodeType = options.nodeType
    this.node = options.node
    this.validTypes = options.validTypes
  }
}
