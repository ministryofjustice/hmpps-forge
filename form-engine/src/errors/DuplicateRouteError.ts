import { formatBox } from '@form-engine/logging/formatBox'

interface DuplicateRouteErrorOptions {
  /** The duplicate route path */
  path: string
  /** Optional additional message */
  message?: string
}

export default class DuplicateRouteError extends Error {
  readonly path: string

  constructor(options: DuplicateRouteErrorOptions) {
    super(options.message ?? `Duplicate route path: ${options.path}`)
    this.name = new.target.name
    this.path = options.path
  }

  toString() {
    return formatBox(
      [
        { label: 'Path', value: this.path },
        { label: 'Message', value: this.message },
      ],
      { title: this.name },
    )
  }
}
