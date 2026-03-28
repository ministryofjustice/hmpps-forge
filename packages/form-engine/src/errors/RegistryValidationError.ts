import formatFields from '@form-engine/utils/utils'

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

  toString() {
    const fields = [
      { label: 'Registry Type', value: this.registryType },
      { label: 'Item Name', value: this.itemName || 'Unknown' },
      { label: 'Expected', value: this.expected },
    ]

    if (this.received) {
      fields.push({ label: 'Received', value: this.received })
    }

    fields.push({ label: 'Message', value: this.message })

    return `${this.name}: ${this.message} [${formatFields(fields)}]`
  }
}
