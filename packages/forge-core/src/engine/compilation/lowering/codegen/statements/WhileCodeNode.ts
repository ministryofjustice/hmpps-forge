import { SafeCode } from '../fragments/CodeFragment'
import CodeNode from './CodeNode'

export default class WhileCodeNode extends CodeNode {
  constructor(
    private readonly loopCondition: SafeCode,
    private readonly loopBody: CodeNode[],
  ) {
    super()
  }

  get condition(): SafeCode {
    return this.loopCondition
  }

  get body(): readonly CodeNode[] {
    return this.loopBody
  }
}
