import CodeNode from './CodeNode'
import IdentifierName from '../fragments/IdentifierName'

export default class TryCatchCodeNode extends CodeNode {
  constructor(
    private readonly attemptedBody: CodeNode[],
    private readonly caughtErrorName: IdentifierName,
    private readonly recoveryBody: CodeNode[],
  ) {
    super()
  }

  get tryBody(): readonly CodeNode[] {
    return this.attemptedBody
  }

  get errorName(): IdentifierName {
    return this.caughtErrorName
  }

  get catchBody(): readonly CodeNode[] {
    return this.recoveryBody
  }
}
