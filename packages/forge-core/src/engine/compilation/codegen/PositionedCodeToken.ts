import { Code } from './Code'
import { SourcePosition } from './SourcePosition.type'

/** Keeps expression positions scoped to one composed fragment. */
export default class PositionedCodeToken {
  private readonly sourcePositions: readonly SourcePosition[]

  constructor(
    private readonly sourceCode: Code,
    positions: readonly SourcePosition[],
  ) {
    this.sourcePositions = Object.freeze([...positions])
    Object.freeze(this)
  }

  get value(): Code {
    return this.sourceCode
  }

  get positions(): readonly SourcePosition[] {
    return this.sourcePositions
  }
}
