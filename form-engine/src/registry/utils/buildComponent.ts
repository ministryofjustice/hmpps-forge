import { ComponentRenderer, RegistryComponent } from '@form-engine/registry/types/components.type'
import { BlockDefinition } from '../../form/types/structures.type'

/**
 * Creates a registerable component function for rendering form UI elements.
 * Component functions take a block definition and context, returning HTML strings.
 * They integrate with the form engine's rendering pipeline and can access form state,
 * evaluate conditional expressions, and handle validation errors.
 *
 * @param variant - The block variant identifier (e.g., 'text', 'radio', 'fieldset')
 *                  This must match the variant property in block definitions
 *
 * @param renderer - Function that performs the actual rendering
 *                   - First parameter is the block definition with all configuration
 *                   - Second parameter is the render context with helpers and state
 *                   - Returns HTML string (can be async for data fetching)
 *
 * @returns A registerable component with:
 */
export const buildComponent = <T extends BlockDefinition>(
  variant: string,
  renderer: ComponentRenderer<T>,
): RegistryComponent<T> => {
  return {
    spec: {
      variant,
      render: renderer,
    },
  }
}
