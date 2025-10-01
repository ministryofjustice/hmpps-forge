import { BlockDefinition, EvaluatedBlock } from '@form-engine/form/types/structures.type'

export type ComponentRenderer<T extends BlockDefinition> = (block: EvaluatedBlock<T>) => Promise<string>

/**
 * Registry component structure that matches condition/transformer pattern
 */
export interface RegistryComponent<T extends BlockDefinition> {
  spec: {
    variant: string
    render: ComponentRenderer<T>
  }
}
