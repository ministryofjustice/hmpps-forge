import { BlockDefinition } from '@form-engine/form/types/structures.type'
import RegistryDuplicateError from '@form-engine/errors/RegistryDuplicateError'
import RegistryValidationError from '@form-engine/errors/RegistryValidationError'
import { govukFrontendComponents } from '@form-engine/registry/components/govuk-frontend'
import { ComponentRenderer, RegistryComponent } from '@form-engine/registry/types/components.type'
import { coreComponents } from '@form-engine/registry/components/core'

/**
 * Registry for managing UI components in the form engine.
 * Components are stored by their variant name and can be retrieved during form rendering.
 */
export default class ComponentRegistry {
  private readonly components = new Map<
    string,
    {
      variant: string
      render: ComponentRenderer<any>
    }
  >()

  /**
   * Register multiple components at once
   * @param components - Array of registry components to register
   * @throws RegistryDuplicateError if a component with the same variant already exists
   * @throws RegistryValidationError if a component has invalid spec
   * @throws AggregateError if multiple validation errors occur
   */
  registerMany(components: RegistryComponent<any>[]): void {
    if (!components || components.length === 0) {
      return
    }

    const errors: Error[] = []

    for (const component of components) {
      if (!component?.spec?.variant) {
        errors.push(
          new RegistryValidationError({
            registryType: 'component',
            expected: 'spec with variant property',
            received: component?.spec ? 'spec without variant' : 'no spec',
            message: 'Component must have a spec with a variant property',
          }),
        )
      } else if (!component.spec.render || typeof component.spec.render !== 'function') {
        errors.push(
          new RegistryValidationError({
            registryType: 'component',
            itemName: component.spec.variant,
            expected: 'spec with render function',
            received: typeof component.spec.render,
            message: `Component "${component.spec.variant}" must have a spec with a render function`,
          }),
        )
      } else if (this.components.has(component.spec.variant)) {
        errors.push(
          new RegistryDuplicateError({
            registryType: 'component',
            itemName: component.spec.variant,
          }),
        )
      } else {
        this.components.set(component.spec.variant, component.spec)
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, 'Component registration failed')
    }
  }

  registerBuiltInComponents() {
    this.registerMany([
      ...coreComponents,
      ...govukFrontendComponents,
      // ...mojFrontendComponents
    ])
  }

  /**
   * Get a component by variant
   * @param variant - The variant of the component to retrieve
   * @returns The component spec or undefined if not found
   */
  get<T extends BlockDefinition>(variant: string): { variant: string; render: ComponentRenderer<T> } | undefined {
    return this.components.get(variant) as { variant: string; render: ComponentRenderer<T> } | undefined
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
  getAll(): Map<string, { variant: string; render: ComponentRenderer<any> }> {
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
