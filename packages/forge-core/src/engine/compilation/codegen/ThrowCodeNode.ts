import { SafeCode } from './Code'
import GeneratedCodeNode from './GeneratedCodeNode'

export default class ThrowCodeNode extends GeneratedCodeNode {
  constructor(private readonly thrownValue: SafeCode) {
    super()
  }

  get value(): SafeCode {
    return this.thrownValue
  }
}
