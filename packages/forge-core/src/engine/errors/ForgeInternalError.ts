import ForgeBaseError from './ForgeBaseError'

/**
 * A state the engine should make impossible - thrown when an internal
 * consistency check fails. Reaching one is a bug in Forge, not an authoring
 * mistake.
 */
export default class ForgeInternalError extends ForgeBaseError {
  constructor(message: string) {
    super(message)
  }
}
