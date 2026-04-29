import formatFields from '../../shared/utils/utils'

interface UnregisteredComponentErrorOptions {
  /** Path to the block in the journey configuration */
  path: (string | number)[]
  /** Variant name of the unregistered component */
  variant: string
  /** Human-readable path through the journey DSL */
  formattedPath?: string
}

export default class UnregisteredComponentError extends Error {
  readonly path: (string | number)[]

  readonly variant: string

  readonly formattedPath?: string

  constructor(options: UnregisteredComponentErrorOptions) {
    super(`Component variant "${options.variant}" is not registered`)
    this.name = new.target.name
    this.path = options.path
    this.variant = options.variant
    this.formattedPath = options.formattedPath
  }

  toString() {
    const fields = [
      { label: 'Path', value: this.formattedPath ?? (this.path.length > 0 ? this.path.join('.') : 'root') },
      { label: 'Variant', value: this.variant },
    ]

    return `${this.name}: ${this.message} [${formatFields(fields)}]`
  }
}
