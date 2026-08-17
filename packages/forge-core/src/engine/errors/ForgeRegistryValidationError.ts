import ForgeBaseError from './ForgeBaseError'

interface ForgeRegistryValidationErrorOptions {
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

export default class ForgeRegistryValidationError extends ForgeBaseError {
  readonly registryType: 'function' | 'component'

  readonly itemName?: string

  readonly expected: string

  readonly received?: string

  constructor(options: ForgeRegistryValidationErrorOptions) {
    super(options.message)
    this.registryType = options.registryType
    this.itemName = options.itemName
    this.expected = options.expected
    this.received = options.received
  }
}
