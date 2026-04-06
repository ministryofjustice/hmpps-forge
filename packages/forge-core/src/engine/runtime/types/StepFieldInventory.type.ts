import { NodeId } from '../../types/ast.type'

export interface StepFieldInventory {
  stepId: NodeId
  fieldCodes: string[]
  cleardownFieldCodes: string[]
}
