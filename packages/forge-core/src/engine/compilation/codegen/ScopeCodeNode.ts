import GeneratedCodeNode from './GeneratedCodeNode'

export default class ScopeCodeNode extends GeneratedCodeNode {
  constructor(private readonly scopeBody: GeneratedCodeNode[]) {
    super()
  }

  get body(): readonly GeneratedCodeNode[] {
    return this.scopeBody
  }
}
