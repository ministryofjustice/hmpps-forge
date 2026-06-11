import { NodeId } from '../ast/ast.type'

export interface StepFieldInventory {
  readonly stepNodeId: NodeId
  readonly fieldCodes: readonly string[]
  readonly cleardownFieldCodes: readonly string[]
}
