import { SafeCode } from './Code'
import GeneratedCodeNode from './GeneratedCodeNode'

export default class ReturnCodeNode extends GeneratedCodeNode {
  constructor(private readonly returnValue?: SafeCode) {
    super()
  }

  get value(): SafeCode | undefined {
    return this.returnValue
  }
}
