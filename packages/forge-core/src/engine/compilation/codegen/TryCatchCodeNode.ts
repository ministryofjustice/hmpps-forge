import GeneratedCodeNode from './GeneratedCodeNode'
import Name from './Name'

export default class TryCatchCodeNode extends GeneratedCodeNode {
  constructor(
    private readonly attemptedBody: GeneratedCodeNode[],
    private readonly caughtErrorName: Name,
    private readonly recoveryBody: GeneratedCodeNode[],
  ) {
    super()
  }

  get tryBody(): readonly GeneratedCodeNode[] {
    return this.attemptedBody
  }

  get errorName(): Name {
    return this.caughtErrorName
  }

  get catchBody(): readonly GeneratedCodeNode[] {
    return this.recoveryBody
  }
}
