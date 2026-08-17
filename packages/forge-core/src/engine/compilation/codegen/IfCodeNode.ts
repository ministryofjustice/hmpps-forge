import { SafeCode } from './Code'
import GeneratedCodeNode from './GeneratedCodeNode'

export interface IfCodeBranch {
  readonly condition: SafeCode
  readonly body: GeneratedCodeNode[]
}

export default class IfCodeNode extends GeneratedCodeNode {
  constructor(
    private readonly ifBranches: readonly IfCodeBranch[],
    private readonly fallbackBody?: GeneratedCodeNode[],
  ) {
    super()
  }

  get branches(): readonly IfCodeBranch[] {
    return this.ifBranches
  }

  get elseBody(): readonly GeneratedCodeNode[] | undefined {
    return this.fallbackBody
  }
}
