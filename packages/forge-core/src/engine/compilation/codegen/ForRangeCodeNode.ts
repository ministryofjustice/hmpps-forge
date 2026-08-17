import { SafeCode } from './Code'
import GeneratedCodeNode from './GeneratedCodeNode'
import Name from './Name'

export default class ForRangeCodeNode extends GeneratedCodeNode {
  constructor(
    private readonly indexName: Name,
    private readonly start: SafeCode,
    private readonly end: SafeCode,
    private readonly loopBody: GeneratedCodeNode[],
  ) {
    super()
  }

  get index(): Name {
    return this.indexName
  }

  get from(): SafeCode {
    return this.start
  }

  get to(): SafeCode {
    return this.end
  }

  get body(): readonly GeneratedCodeNode[] {
    return this.loopBody
  }
}
