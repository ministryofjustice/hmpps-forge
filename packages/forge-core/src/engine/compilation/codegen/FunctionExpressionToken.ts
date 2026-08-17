import GeneratedCodeNode from './GeneratedCodeNode'
import Name from './Name'

export default class FunctionExpressionToken {
  constructor(
    private readonly functionName: Name | undefined,
    private readonly functionParameters: readonly Name[],
    private readonly functionBody: readonly GeneratedCodeNode[],
    private readonly asyncFunction: boolean,
  ) {}

  get name(): Name | undefined {
    return this.functionName
  }

  get parameters(): readonly Name[] {
    return this.functionParameters
  }

  get body(): readonly GeneratedCodeNode[] {
    return this.functionBody
  }

  get async(): boolean {
    return this.asyncFunction
  }
}
