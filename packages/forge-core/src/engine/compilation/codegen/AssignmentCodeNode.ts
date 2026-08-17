import { SafeCode } from './Code'
import GeneratedCodeNode from './GeneratedCodeNode'

export default class AssignmentCodeNode extends GeneratedCodeNode {
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
