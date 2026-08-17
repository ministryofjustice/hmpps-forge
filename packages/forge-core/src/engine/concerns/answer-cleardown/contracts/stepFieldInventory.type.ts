import { NodeId } from '../../../contracts/ast/ast.type'

export interface StepFieldInventory {
  stepId: NodeId
  fieldCodes: string[]
  cleardownFieldCodes: string[]
}
