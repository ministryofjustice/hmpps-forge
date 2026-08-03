interface RegistryValidationErrorOptions {
  /** Type of registry (function or component) */
  registryType: 'function' | 'component'
  /** Name or variant of the item (if available) */
  itemName?: string
  /** What was expected */
  expected: string
  /** What was actually received */
  received?: string
  /** Human-readable error message */
  message: string
}

export default class RegistryValidationError extends Error {
  readonly registryType: 'function' | 'component'

  readonly itemName?: string

  readonly expected: string

  readonly received?: string

  constructor(options: RegistryValidationErrorOptions) {
    super(options.message)
    this.name = new.target.name
    this.registryType = options.registryType
    this.itemName = options.itemName
    this.expected = options.expected
    this.received = options.received
  }
}
