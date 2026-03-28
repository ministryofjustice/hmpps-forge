import { BlockDefinition } from '@form-engine/form/types/structures.type'
import RegistryDuplicateError from '@form-engine/errors/RegistryDuplicateError'
import RegistryValidationError from '@form-engine/errors/RegistryValidationError'
import { ComponentRegistryEntry } from '@form-engine/registry/types/components.type'
import { coreComponents } from '@form-engine/registry/components'

/**
 * Registry for managing UI components in the form engine.
 * Components are stored by their variant name and can be retrieved during form rendering.
 */
export default class ComponentRegistry {
  private readonly components = new Map<string, ComponentRegistryEntry<any>>()

  /**
   * Register multiple components at once
   * @param components - Array of components to register
   * @throws RegistryDuplicateError if a component with the same variant already exists
   * @throws RegistryValidationError if a component is invalid
   * @throws AggregateError if multiple validation errors occur
   */
  registerMany(components: ComponentRegistryEntry<any>[]): void {
    if (!components || components.length === 0) {
      return
    }

    const errors: Error[] = []

    components.forEach(component => {
      if (!component?.variant) {
        errors.push(
          new RegistryValidationError({
            registryType: 'component',
            expected: 'variant property',
            received: 'no variant',
            message: 'Component must have a variant property',
          }),
        )
      } else if (!component.render || typeof component.render !== 'function') {
        errors.push(
          new RegistryValidationError({
            registryType: 'component',
            itemName: component.variant,
            expected: 'render function',
            received: typeof component.render,
            message: `Component "${component.variant}" must have a render function`,
          }),
        )
      } else if (this.components.has(component.variant)) {
        errors.push(
          new RegistryDuplicateError({
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

  registerBuiltInComponents() {
    this.registerMany([...coreComponents])
  }

  /**
   * Get a component by variant
   * @param variant - The variant of the component to retrieve
   * @returns The component or undefined if not found
   */
  get<T extends BlockDefinition>(variant: string): ComponentRegistryEntry<T> | undefined {
    return this.components.get(variant) as ComponentRegistryEntry<T> | undefined
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
  getAll(): Map<string, ComponentRegistryEntry<any>> {
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
