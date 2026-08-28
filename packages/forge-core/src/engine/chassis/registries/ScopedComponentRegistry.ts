import ComponentRegistry from './ComponentRegistry'
import { ComponentRegistryEntry } from '../../../components/types/components.type'

/**
 * A component registry scoped to a specific journey, with fallback to a parent registry.
 *
 * Components registered in this registry take precedence over the parent.
 * This enables journey-specific components that don't clash with components
 * from other journeys, while still inheriting globally-registered components
 * like the built-in core components.
 */
export default class ScopedComponentRegistry extends ComponentRegistry {
  constructor(private readonly parent: ComponentRegistry) {
    super()
  }

  override get(variant: string): ComponentRegistryEntry<object, unknown> | undefined {
    return super.get(variant) ?? this.parent.get(variant)
  }

  override has(variant: string): boolean {
    return super.has(variant) || this.parent.has(variant)
  }

  override getAll(): Map<string, ComponentRegistryEntry<object, unknown>> {
    const merged = this.parent.getAll()

    for (const [variant, entry] of super.getAll()) {
      merged.set(variant, entry)
    }

    return merged
  }

  override size(): number {
    return this.getAll().size
  }
}
