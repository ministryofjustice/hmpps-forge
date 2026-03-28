import formatFields from '@form-engine/utils/utils'

interface InvalidNodeErrorOptions {
  /** Specific validation failure message */
  message: string
  /** Path to the invalid node (optional) */
  path?: (string | number)[]
  /** The invalid node */
  node?: any
  /** What was expected */
  expected?: string
  /** What was actually found */
  actual?: string
  /** Error code for programmatic handling */
  code?: string
}

export default class InvalidNodeError extends Error {
  readonly path?: (string | number)[]

  readonly node?: any

  readonly expected?: string

  readonly actual?: string

  readonly code?: string

  constructor(options: InvalidNodeErrorOptions) {
    let { message } = options

    if (options.path && options.path.length > 0) {
      message += ` at path: ${options.path.join('.')}`
    }

    if (options.expected && options.actual) {
      message += ` (expected: ${options.expected}, got: ${options.actual})`
    }

    super(message)
    this.name = new.target.name
    this.message = message
    this.path = options.path
    this.node = options.node
    this.expected = options.expected
    this.actual = options.actual
    this.code = options.code

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, new.target)
    }
  }

  toString() {
    const fields = [
      { label: 'Path', value: this.path?.length ? this.path.join('.') : 'root' },
      { label: 'Code', value: this.code },
      { label: 'Message', value: this.message },
    ]

    if (this.expected) {
      fields.push({ label: 'Expected', value: this.expected })
    }

    if (this.actual) {
      fields.push({ label: 'Actual', value: this.actual })
    }

    if (this.node?.type) {
      fields.push({ label: 'Node Type', value: this.node.type })
    }

    return `${this.name}: ${this.message} [${formatFields(fields)}]`
  }
}
