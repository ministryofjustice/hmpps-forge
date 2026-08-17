import { SafeCode } from './Code'
import GeneratedCodeNode from './GeneratedCodeNode'

export default class WhileCodeNode extends GeneratedCodeNode {
  constructor(
    private readonly loopCondition: SafeCode,
    private readonly loopBody: GeneratedCodeNode[],
  ) {
    super()
  }

  get condition(): SafeCode {
    return this.loopCondition
  }

  get body(): readonly GeneratedCodeNode[] {
    return this.loopBody
  }
}
