import ForgeBaseError from './ForgeBaseError'

interface ForgeCompilationErrorOptions {
  readonly phase: string
  readonly cause: unknown
  readonly nodeId?: string
  readonly formattedPath?: string
  readonly functionName?: string
  readonly functionType?: string
}

export default class ForgeCompilationError extends ForgeBaseError {
  readonly phase: string

  readonly nodeId?: string

  readonly functionName?: string

  readonly functionType?: string

  readonly cause: unknown

  constructor(options: ForgeCompilationErrorOptions) {
    super(`Failed to compile generated Forge ${options.phase} function`, options)
    this.phase = options.phase
    this.nodeId = options.nodeId
    this.functionName = options.functionName
    this.functionType = options.functionType
    this.cause = options.cause
  }
}
