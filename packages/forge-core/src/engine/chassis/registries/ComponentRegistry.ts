import type { BlockDefinition } from '../../../components/types/structures.type'
import ForgeRegistryDuplicateError from '../../errors/ForgeRegistryDuplicateError'
import ForgeRegistryValidationError from '../../errors/ForgeRegistryValidationError'
import { ComponentRegistryEntry } from '../../../components/types/components.type'

/**
 * Registry for managing UI components in forge.
 * Components are stored by their variant name and can be retrieved during form rendering.
 */
export default class ComponentRegistry {
  private readonly components = new Map<string, ComponentRegistryEntry<BlockDefinition, unknown>>()

  /**
   * Register multiple components at once
   * @param components - Array of components to register
   * @throws ForgeRegistryDuplicateError if a component with the same variant already exists
   * @throws ForgeRegistryValidationError if a component is invalid
   * @throws AggregateError if multiple validation errors occur
   */
  registerMany(components: ComponentRegistryEntry<BlockDefinition, unknown>[]): void {
    if (!components || components.length === 0) {
      return
    }

    const errors: Error[] = []

    components.forEach(component => {
      if (!component?.variant) {
        errors.push(
          new ForgeRegistryValidationError({
            registryType: 'component',
            expected: 'variant property',
            received: 'no variant',
            message: 'Component must have a variant property',
          }),
        )
      } else if (!component.render || typeof component.render !== 'function') {
        errors.push(
          new ForgeRegistryValidationError({
            registryType: 'component',
            itemName: component.variant,
            expected: 'render function',
            received: typeof component.render,
            message: `Component "${component.variant}" must have a render function`,
          }),
        )
      } else if (this.components.has(component.variant)) {
        errors.push(
          new ForgeRegistryDuplicateError({
            registryType: 'component',
            itemName: component.variant,
          }),
        )
      } else {
        this.components.set(component.variant, component)
      }
    })

    if (errors.length > 0) {
      throw new AggregateError(errors, 'Component registration failed')
    }
  }

  /**
   * Get a component by variant
   * @param variant - The variant of the component to retrieve
   * @returns The component or undefined if not found
   */
  get<T extends BlockDefinition, TRenderOutput = unknown>(
    variant: string,
  ): ComponentRegistryEntry<T, TRenderOutput> | undefined {
    return this.components.get(variant) as ComponentRegistryEntry<T, TRenderOutput> | undefined
  }

  /**
   * Check if a component is registered
   * @param variant - The variant of the component to check
   * @returns True if the component exists, false otherwise
   */
  has(variant: string): boolean {
    return this.components.has(variant)
  }

  /**
   * Get all registered components
   * @returns Map of all registered components
   */
  getAll(): Map<string, ComponentRegistryEntry<BlockDefinition, unknown>> {
    return new Map(this.components)
  }

  /**
   * Get the count of registered components
   * @returns Number of registered components
   */
  size(): number {
    return this.components.size
  }
}
