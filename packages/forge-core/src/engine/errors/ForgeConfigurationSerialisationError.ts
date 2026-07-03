import formatFields from '../../shared/utils/utils'

interface ForgeConfigurationSerialisationErrorOptions {
  /** Path to the invalid field */
  path: (string | number)[]

  type: string
  /** Human-readable error message */
  message?: string
  /** Error code for programmatic handling */
  code?: string
  /** Human-readable path through the journey DSL */
  formattedPath?: string
}

export default class ForgeConfigurationSerialisationError extends Error {
  readonly code?: string

  readonly path: (string | number)[]

  readonly formattedPath?: string

  readonly type: string

  constructor(options: ForgeConfigurationSerialisationErrorOptions) {
    const message =
      options.message ??
      `${options.type} at ${options.path.length > 0 ? options.path.join('.') : 'root'} (not JSON serializable)`

    super(message)
    this.name = new.target.name
    this.path = options.path
    this.formattedPath = options.formattedPath
    this.type = options.type
    this.code = options.code
    this.message = message
  }

  toString() {
    const fields = [
      { label: 'Path', value: this.formattedPath ?? (this.path.length > 0 ? this.path.join('.') : 'root') },
      { label: 'Code', value: this.code },
    ]

    return `${this.name}: ${this.message} [${formatFields(fields)}]`
  }
}
