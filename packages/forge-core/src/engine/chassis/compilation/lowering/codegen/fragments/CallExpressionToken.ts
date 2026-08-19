import type { CodeFragment } from './CodeFragment'

/** Holds a generated function call as a target and separate arguments, so `SourceRenderer` can break long calls across multiple lines. */
export default class CallExpressionToken {
  private readonly callArguments: readonly CodeFragment[]

  constructor(
    private readonly callTarget: CodeFragment,
    args: readonly CodeFragment[],
  ) {
    this.callArguments = Object.freeze([...args])
    Object.freeze(this)
  }

  get target(): CodeFragment {
    return this.callTarget
  }

  get args(): readonly CodeFragment[] {
    return this.callArguments
  }
}
