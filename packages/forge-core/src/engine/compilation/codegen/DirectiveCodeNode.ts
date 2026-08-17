import GeneratedCodeNode from './GeneratedCodeNode'

export default class DirectiveCodeNode extends GeneratedCodeNode {
  constructor(private readonly directiveValue: string) {
    super()
  }

  get value(): string {
    return this.directiveValue
  }
}
