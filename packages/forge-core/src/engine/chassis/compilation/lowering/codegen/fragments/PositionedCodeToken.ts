import { CodeFragment } from './CodeFragment'
import { SourcePosition } from '../SourcePosition.type'

/** Pairs a `CodeFragment` fragment with source positions (file/line/column from the authored definition), so source maps can trace generated code back to the definition that produced it. */
export default class PositionedCodeToken {
  private readonly sourcePositions: readonly SourcePosition[]

  constructor(
    private readonly sourceCode: CodeFragment,
    positions: readonly SourcePosition[],
  ) {
    this.sourcePositions = Object.freeze([...positions])
    Object.freeze(this)
  }

  get value(): CodeFragment {
    return this.sourceCode
  }

  get positions(): readonly SourcePosition[] {
    return this.sourcePositions
  }
}
