import FunctionRegistry from './FunctionRegistry'
import { FunctionRegistryEntry } from '../../../authoring/types/functions.type'

/**
 * A function registry scoped to a specific journey, with fallback to a parent registry.
 *
 * Functions registered in this registry take precedence over the parent.
 * This enables journey-specific functions (effects, conditions, transformers) that
 * don't clash with functions from other journeys, while still inheriting
 * globally-registered functions like built-in conditions and transformers.
 */
export default class ScopedFunctionRegistry extends FunctionRegistry {
  constructor(private readonly parent: FunctionRegistry) {
    super()
  }

  override get(name: string): FunctionRegistryEntry | undefined {
    return super.get(name) ?? this.parent.get(name)
  }

  override has(name: string): boolean {
    return super.has(name) || this.parent.has(name)
  }

  override getAll(): Map<string, FunctionRegistryEntry> {
    const merged = this.parent.getAll()

    for (const [name, entry] of super.getAll()) {
      merged.set(name, entry)
    }

    return merged
  }

  override size(): number {
    return this.getAll().size
  }
}
