import CodeNode from './CodeNode'

export default class DirectiveCodeNode extends CodeNode {
  constructor(private readonly directiveValue: string) {
    super()
  }

  get value(): string {
    return this.directiveValue
  }
}
