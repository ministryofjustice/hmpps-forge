import { SafeCode } from '../fragments/CodeFragment'
import CodeNode from './CodeNode'

export default class ReturnCodeNode extends CodeNode {
  constructor(private readonly returnValue?: SafeCode) {
    super()
  }

  get value(): SafeCode | undefined {
    return this.returnValue
  }
}
