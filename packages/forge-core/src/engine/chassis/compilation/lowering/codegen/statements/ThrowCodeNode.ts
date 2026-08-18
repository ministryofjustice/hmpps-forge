import { SafeCode } from '../fragments/CodeFragment'
import CodeNode from './CodeNode'

export default class ThrowCodeNode extends CodeNode {
  constructor(private readonly thrownValue: SafeCode) {
    super()
  }

  get value(): SafeCode {
    return this.thrownValue
  }
}
