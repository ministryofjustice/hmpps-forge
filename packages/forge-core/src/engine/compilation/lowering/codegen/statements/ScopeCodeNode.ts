import CodeNode from './CodeNode'

export default class ScopeCodeNode extends CodeNode {
  constructor(private readonly scopeBody: CodeNode[]) {
    super()
  }

  get body(): readonly CodeNode[] {
    return this.scopeBody
  }
}
