import { formatBox } from '@form-engine/logging/formatBox'

interface RegistryDuplicateErrorOptions {
  /** Type of registry (function or component) */
  registryType: 'function' | 'component'
  /** Name or variant of the item being registered */
  itemName: string
  /** Optional additional message */
  message?: string
}

export default class RegistryDuplicateError extends Error {
  readonly registryType: 'function' | 'component'

  readonly itemName: string

  constructor(options: RegistryDuplicateErrorOptions) {
    super(options.message)
    this.name = new.target.name
    this.registryType = options.registryType
    this.itemName = options.itemName
  }

  toString() {
    return formatBox(
      [
        { label: 'Registry Type', value: this.registryType },
        { label: 'Item Name', value: this.itemName },
        { label: 'Message', value: this.message },
      ],
      { title: this.name },
    )
  }
}
