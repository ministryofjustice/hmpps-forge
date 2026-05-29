import { NodeId } from './ast.type'

export interface StepFieldInventory {
  stepId: NodeId
  fieldCodes: string[]
  cleardownFieldCodes: string[]
}
