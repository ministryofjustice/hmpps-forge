import ForgeBaseError from './ForgeBaseError'

interface ForgeRegistryDuplicateErrorOptions {
  /** Type of registry (function or component) */
  registryType: 'function' | 'component'
  /** Name or variant of the item being registered */
  itemName: string
  /** Optional additional message */
  message?: string
}

export default class ForgeRegistryDuplicateError extends ForgeBaseError {
  readonly registryType: 'function' | 'component'

  readonly itemName: string

  constructor(options: ForgeRegistryDuplicateErrorOptions) {
    super(options.message ?? `Duplicate ${options.registryType} registration: "${options.itemName}"`)
    this.registryType = options.registryType
    this.itemName = options.itemName
  }
}
