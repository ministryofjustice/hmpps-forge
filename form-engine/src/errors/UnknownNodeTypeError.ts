import { formatBox } from '@form-engine/logging/formatBox'

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

  toString() {
    const fields = [
      { label: 'Path', value: this.path?.length ? this.path.join('.') : 'root' },
      { label: 'Type', value: this.nodeType || 'undefined' },
      { label: 'Message', value: this.message },
    ]

    if (this.validTypes && this.validTypes.length > 0) {
      fields.push({ label: 'Valid Types', value: this.validTypes.join(', ') })
    }

    if (this.node && typeof this.node === 'object') {
      const keys = Object.keys(this.node).slice(0, 5)
      if (keys.length > 0) {
        fields.push({ label: 'Node Keys', value: keys.join(', ') + (Object.keys(this.node).length > 5 ? '...' : '') })
      }
    }

    return formatBox(fields, { title: this.name })
  }
}
