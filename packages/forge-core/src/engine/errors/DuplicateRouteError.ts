import ForgeBaseError from './ForgeBaseError'

interface DuplicateRouteErrorOptions {
  /** The duplicate route path */
  routePath: string
  /** Optional additional message */
  message?: string
}

export default class DuplicateRouteError extends ForgeBaseError {
  readonly routePath: string

  constructor(options: DuplicateRouteErrorOptions) {
    super(options.message ?? `Duplicate route path: ${options.routePath}`)
    this.routePath = options.routePath
  }
}
