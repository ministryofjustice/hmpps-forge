import { SafeCode } from './Code'
import GeneratedCodeNode from './GeneratedCodeNode'

export default class ExpressionCodeNode extends GeneratedCodeNode {
  constructor(private readonly sourceExpression: SafeCode) {
    super()
  }

  get expression(): SafeCode {
    return this.sourceExpression
  }
}
