import GeneratedCodeNode from './GeneratedCodeNode'
import { SourcePosition } from './SourcePosition.type'

export default class PositionedCodeNode extends GeneratedCodeNode {
  private readonly authoredPositions: readonly SourcePosition[]

  constructor(
    private readonly positionedNode: GeneratedCodeNode,
    positions: readonly SourcePosition[],
  ) {
    super()

    this.authoredPositions = Object.freeze(positions.map(position => Object.freeze({ ...position })))
  }

  get node(): GeneratedCodeNode {
    return this.positionedNode
  }

  get positions(): readonly SourcePosition[] {
    return this.authoredPositions
  }
}
