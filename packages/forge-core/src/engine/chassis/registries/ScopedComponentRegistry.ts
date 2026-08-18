import type { BlockDefinition } from '../../../components/types/structures.type'
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

  override get<T extends BlockDefinition, TRenderOutput = unknown>(
    variant: string,
  ): ComponentRegistryEntry<T, TRenderOutput> | undefined {
    return super.get<T, TRenderOutput>(variant) ?? this.parent.get<T, TRenderOutput>(variant)
  }

  override has(variant: string): boolean {
    return super.has(variant) || this.parent.has(variant)
  }

  override getAll(): Map<string, ComponentRegistryEntry<BlockDefinition, unknown>> {
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
