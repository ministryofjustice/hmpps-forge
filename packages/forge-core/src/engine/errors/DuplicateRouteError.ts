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
}
