interface UnknownNodeTypeErrorOptions {
  /** The unknown type encountered */
  nodeType?: string
  /** Path to the node (optional) */
  path?: (string | number)[]
  /** The actual node object */
  node?: any
  /** List of valid types (for helpful error messages) */
  validTypes?: string[]
}

export default class UnknownNodeTypeError extends Error {
  readonly nodeType?: string

  readonly path?: (string | number)[]

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

    if (options.path && options.path.length > 0) {
      message += ` at path: ${options.path.join('.')}`
    }

    super(message)
    this.name = new.target.name
    this.message = message
    this.nodeType = options.nodeType
    this.path = options.path
    this.node = options.node
    this.validTypes = options.validTypes

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, new.target)
    }
  }
}
