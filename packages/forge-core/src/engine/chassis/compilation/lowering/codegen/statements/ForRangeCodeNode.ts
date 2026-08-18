import { SafeCode } from '../fragments/CodeFragment'
import CodeNode from './CodeNode'
import IdentifierName from '../fragments/IdentifierName'

export default class ForRangeCodeNode extends CodeNode {
  constructor(
    private readonly indexName: IdentifierName,
    private readonly start: SafeCode,
    private readonly end: SafeCode,
    private readonly loopBody: CodeNode[],
  ) {
    super()
  }

  get index(): IdentifierName {
    return this.indexName
  }

  get from(): SafeCode {
    return this.start
  }

  get to(): SafeCode {
    return this.end
  }

  get body(): readonly CodeNode[] {
    return this.loopBody
  }
}
