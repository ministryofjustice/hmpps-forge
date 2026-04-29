import formatFields from '../../shared/utils/utils'

interface ForgeConfigurationSchemaErrorOptions {
  /** Path to the invalid field */
  path: (string | number)[]
  /** Human-readable error message */
  message: string
  /** Expected value type/format */
  expected?: string
  /** Error code for programmatic handling */
  code?: string
  /** Human-readable path through the journey DSL */
  formattedPath?: string
}

export default class ForgeConfigurationSchemaError extends Error {
  readonly code?: string

  readonly expected?: string

  readonly path: (string | number)[]

  readonly formattedPath?: string

  constructor(options: ForgeConfigurationSchemaErrorOptions) {
    super(options.message)
    this.name = new.target.name
    this.message = options.message
    this.code = options.code
    this.path = options.path
    this.expected = options.expected
    this.formattedPath = options.formattedPath
  }

  toString() {
    const fields = [
      { label: 'Path', value: this.formattedPath ?? (this.path.length > 0 ? this.path.join('.') : 'root') },
      { label: 'Code', value: this.code },
      { label: 'Expected', value: this.expected },
    ]

    return `${this.name}: ${this.message} [${formatFields(fields)}]`
  }
}
