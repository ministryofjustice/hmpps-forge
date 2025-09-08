import { formatBox } from '@form-engine/logging/formatBox'

interface FormConfigurationSerialisationErrorOptions {
  /** Path to the invalid field */
  path: (string | number)[]

  type: string
  /** Human-readable error message */
  message?: string
  /** Error code for programmatic handling */
  code?: string
}

export default class FormConfigurationSerialisationError extends Error {
  readonly code?: string

  readonly path: (string | number)[]

  readonly type: string

  constructor(options: FormConfigurationSerialisationErrorOptions) {
    super(options.message)
    this.name = new.target.name
    this.message = options.message
    this.type = options.type
    this.code = options.code
    this.path = options.path
  }

  private getMessage() {
    return this.message ?? `${this.type} at ${this.path.length ? this.path.join('.') : 'root'} (not JSON serializable)`
  }

  toString() {
    return formatBox(
      [
        { label: 'Path', value: this.path.join('.') },
        { label: 'Code', value: this.code },
        { label: 'Message', value: this.getMessage() },
      ],
      { title: this.name },
    )
  }
}
