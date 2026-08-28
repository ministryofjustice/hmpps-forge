import { getComponentStamp } from '../authoring/builders/utils/stampEntry'
import { isForgeComponent } from './component'
import ForgeRegistryDuplicateError from '../engine/errors/ForgeRegistryDuplicateError'
import type { ComponentRegistryEntry } from './types/components.type'

/**
 * Collects a package's components - listed in `components` or stamped onto the
 * blocks their builders created - so `createForgePackage()` can carry every
 * component the journey uses without the author listing them.
 *
 * Components dedupe by pointer identity: the same component listed and used in
 * the journey collects once. Two distinct components claiming one variant is a
 * genuine conflict and throws - unlike function entries there is no renaming,
 * because the variant is authored into every block that uses it.
 */
export class ComponentEntryCollector {
  private readonly componentsByVariant = new Map<string, ComponentRegistryEntry<object, unknown>>()

  private embeddedFound = false

  /** Registers a listed component under its variant. */
  collectListed(component: ComponentRegistryEntry<object, unknown>): void {
    this.claim(component)
  }

  /**
   * Walks a finalised journey definition and registers the component behind
   * every `__component`-stamped block.
   */
  collectEmbedded(root: unknown): void {
    this.walk(root, new WeakSet())
  }

  /** Whether the journey walk found any stamped blocks. */
  hasEmbedded(): boolean {
    return this.embeddedFound
  }

  /** The collected components, listed ones first. */
  entries(): ComponentRegistryEntry<object, unknown>[] {
    return [...this.componentsByVariant.values()]
  }

  private claim(component: ComponentRegistryEntry<object, unknown>): void {
    const existing = this.componentsByVariant.get(component.variant)

    if (existing === component) {
      return
    }

    if (existing) {
      throw new ForgeRegistryDuplicateError({
        registryType: 'component',
        itemName: component.variant,
        message:
          `Two different components claim the variant "${component.variant}" in one package - ` +
          'variants must be unique within their scope',
      })
    }

    this.componentsByVariant.set(component.variant, component)
  }

  private walk(node: unknown, seen: WeakSet<object>): void {
    if (node === null || typeof node !== 'object' || seen.has(node)) {
      return
    }

    seen.add(node)

    const component = getComponentStamp(node)

    if (component && isForgeComponent(component)) {
      this.embeddedFound = true
      this.claim(component)
    }

    if (Array.isArray(node)) {
      node.forEach(item => this.walk(item, seen))
      return
    }

    Object.values(node).forEach(value => this.walk(value, seen))
  }
}
