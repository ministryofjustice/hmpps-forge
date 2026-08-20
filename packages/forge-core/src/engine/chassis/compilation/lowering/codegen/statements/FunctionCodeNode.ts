import CodeNode from './CodeNode'
import IdentifierName from '../fragments/IdentifierName'

export default class FunctionCodeNode extends CodeNode {
  constructor(
    private readonly functionName: IdentifierName,
    private readonly functionParameters: readonly IdentifierName[],
    private readonly functionBody: CodeNode[],
    private readonly asyncFunction: boolean,
  ) {
    super()
  }

  get name(): IdentifierName {
    return this.functionName
  }

  get parameters(): readonly IdentifierName[] {
    return this.functionParameters
  }

  get body(): readonly CodeNode[] {
    return this.functionBody
  }

  get async(): boolean {
    return this.asyncFunction
  }
}
