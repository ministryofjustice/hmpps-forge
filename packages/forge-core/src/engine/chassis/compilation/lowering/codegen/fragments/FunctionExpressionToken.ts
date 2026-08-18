import CodeNode from '../statements/CodeNode'
import IdentifierName from './IdentifierName'

export default class FunctionExpressionToken {
  constructor(
    private readonly functionName: IdentifierName | undefined,
    private readonly functionParameters: readonly IdentifierName[],
    private readonly functionBody: readonly CodeNode[],
    private readonly asyncFunction: boolean,
  ) {}

  get name(): IdentifierName | undefined {
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
