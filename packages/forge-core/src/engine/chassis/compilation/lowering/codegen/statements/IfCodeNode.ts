import { SafeCode } from '../fragments/CodeFragment'
import CodeNode from './CodeNode'

export interface IfCodeBranch {
  readonly condition: SafeCode
  readonly body: CodeNode[]
}

export default class IfCodeNode extends CodeNode {
  constructor(
    private readonly ifBranches: readonly IfCodeBranch[],
    private readonly fallbackBody?: CodeNode[],
  ) {
    super()
  }

  get branches(): readonly IfCodeBranch[] {
    return this.ifBranches
  }

  get elseBody(): readonly CodeNode[] | undefined {
    return this.fallbackBody
  }
}
