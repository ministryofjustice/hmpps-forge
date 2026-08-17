import type { Code } from './Code'

/** Keeps a generated function call structured until source rendering. */
export default class CallExpressionToken {
  private readonly callArguments: readonly Code[]

  constructor(
    private readonly callTarget: Code,
    args: readonly Code[],
  ) {
    this.callArguments = Object.freeze([...args])
    Object.freeze(this)
  }

  get target(): Code {
    return this.callTarget
  }

  get args(): readonly Code[] {
    return this.callArguments
  }
}
