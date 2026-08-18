import CodeNode from './CodeNode'
import { SourcePosition } from '../SourcePosition.type'

export default class PositionedCodeNode extends CodeNode {
  private readonly authoredPositions: readonly SourcePosition[]

  constructor(
    private readonly positionedNode: CodeNode,
    positions: readonly SourcePosition[],
  ) {
    super()

    this.authoredPositions = Object.freeze(positions.map(position => Object.freeze({ ...position })))
  }

  get node(): CodeNode {
    return this.positionedNode
  }

  get positions(): readonly SourcePosition[] {
    return this.authoredPositions
  }
}
