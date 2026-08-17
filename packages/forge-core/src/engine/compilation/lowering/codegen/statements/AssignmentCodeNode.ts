import { SafeCode } from '../fragments/CodeFragment'
import CodeNode from './CodeNode'

export default class AssignmentCodeNode extends CodeNode {
  constructor(
    private readonly assignmentTarget: SafeCode,
    private readonly assignmentValue: SafeCode,
  ) {
    super()
  }

  get target(): SafeCode {
    return this.assignmentTarget
  }

  get value(): SafeCode {
    return this.assignmentValue
  }
}
