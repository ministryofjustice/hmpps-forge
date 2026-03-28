import formatFields from '@form-engine/utils/utils'

interface ASTTransformationErrorOptions {
  /** Human-readable error message */
  message: string
  /** Path in the AST/JSON structure */
  path: (string | number)[]
  /** The problematic node */
  node?: any
  /** Original error if wrapping another error */
  cause?: Error
  /** Error code for programmatic handling */
  code?: string
}

export default class ASTTransformationError extends Error {
  readonly path: (string | number)[]

  readonly node?: any

  readonly cause?: Error

  readonly code?: string

  constructor(options: ASTTransformationErrorOptions) {
    let { message } = options

    // Add path context to the message if available
    if (options.path && options.path.length > 0) {
      message += ` at path: ${options.path.join('.')}`
    }

    // Add cause information if available
    if (options.cause) {
      message += ` - Caused by: ${options.cause.message}`
    }

    super(message)
    this.name = new.target.name
    this.message = message
    this.path = options.path
    this.node = options.node
    this.cause = options.cause
    this.code = options.code

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, new.target)
    }
  }

  toString() {
    const fields = [
      { label: 'Path', value: this.path.length ? this.path.join('.') : 'root' },
      { label: 'Code', value: this.code },
      { label: 'Message', value: this.message },
    ]

    if (this.cause) {
      fields.push({ label: 'Cause', value: this.cause.message })
    }

    if (this.node?.type) {
      fields.push({ label: 'Node Type', value: this.node.type })
    }

    return `${this.name}: ${this.message} [${formatFields(fields)}]`
  }
}
