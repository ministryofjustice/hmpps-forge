import formatFields from '@form-engine/utils/utils'

interface FormConfigurationSchemaErrorOptions {
  /** Path to the invalid field */
  path: (string | number)[]
  /** Human-readable error message */
  message: string
  /** Expected value type/format */
  expected?: string
  /** Error code for programmatic handling */
  code?: string
}

export default class FormConfigurationSchemaError extends Error {
  readonly code?: string

  readonly expected?: string

  readonly path?: (string | number)[]

  constructor(options: FormConfigurationSchemaErrorOptions) {
    super(options.message)
    this.name = new.target.name
    this.message = options.message
    this.code = options.code
    this.path = options.path
    this.expected = options.expected
  }

  toString() {
    const fields = [
      { label: 'Path', value: this.path.join('.') },
      { label: 'Code', value: this.code },
      { label: 'Expected', value: this.expected },
    ]

    return `${this.name}: ${this.message} [${formatFields(fields)}]`
  }
}
