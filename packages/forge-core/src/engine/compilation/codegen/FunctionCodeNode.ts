import GeneratedCodeNode from './GeneratedCodeNode'
import Name from './Name'

export default class FunctionCodeNode extends GeneratedCodeNode {
  constructor(
    private readonly functionName: Name,
    private readonly functionParameters: readonly Name[],
    private readonly functionBody: GeneratedCodeNode[],
    private readonly asyncFunction: boolean,
  ) {
    super()
  }

  get name(): Name {
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
