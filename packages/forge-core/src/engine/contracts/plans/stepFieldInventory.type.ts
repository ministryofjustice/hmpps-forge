import { NodeId } from '../ast/ast.type'

export interface StepFieldInventory {
  readonly stepId: NodeId
  readonly fieldCodes: readonly string[]
  readonly cleardownFieldCodes: readonly string[]
}
