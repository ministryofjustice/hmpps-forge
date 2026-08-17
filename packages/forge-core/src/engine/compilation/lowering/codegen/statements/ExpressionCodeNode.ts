import { SafeCode } from '../fragments/CodeFragment'
import CodeNode from './CodeNode'

export default class ExpressionCodeNode extends CodeNode {
  constructor(private readonly sourceExpression: SafeCode) {
    super()
  }

  get expression(): SafeCode {
    return this.sourceExpression
  }
}
