import { finaliseBuilders } from './utils/finaliseBuilders'
import { captureCallsite, stampCallsite } from './utils/captureCallsite'
import { isFunctionEntry } from '../functions/createEntry'
import { FunctionEntryRegistry } from '../functions/FunctionEntryRegistry'
import { ComponentEntryCollector } from '../../components/ComponentEntryCollector'
import { ComponentRegistryEntry } from '../../components/types/components.type'
import { BlockDefinition, FieldBlockDefinition } from '../../components/types/structures.type'
import { JourneyDefinition, StepDefinition } from '../types/structures.type'
import { ForgePackage, RegisteredForgePackage } from '../types/package.type'
import { FunctionRegistryBuilder } from '../types/functions.type'
import { ComponentCallType, StructureType } from '../../shared/taxonomy'

/**
 * Creates a presentational (non-field) block for a step.
 * Use for headings, paragraphs, inset text, and other non-interactive content.
 */
export function block<D extends BlockDefinition>(definition: Omit<D, '_forge'>): D {
  const result = finaliseBuilders({
    ...definition,
    _forge: ComponentCallType.BASIC,
  }) as D
  stampCallsite(result, captureCallsite(block))
  return result
}

/**
 * Creates a field block that captures user input.
 * Fields have a `code` for storing answers and support `validWhen`, `dependentWhen`,
 * `defaultValue`, and `formatters`.
 */
export function field<D extends FieldBlockDefinition>(definition: Omit<D, '_forge'>): D {
  const result = finaliseBuilders({
    ...definition,
    _forge: ComponentCallType.FIELD,
  }) as D
  stampCallsite(result, captureCallsite(field))
  return result
}

/**
 * Creates a step (page) within a journey.
 * Steps contain blocks and define lifecycle hooks for access, submission, and actions.
 */
export function step<D extends StepDefinition>(definition: Omit<D, '_forge'>): D {
  const result = finaliseBuilders({
    ...definition,
    _forge: StructureType.STEP,
  }) as D
  stampCallsite(result, captureCallsite(step))
  return result
}

/**
 * Creates a journey definition - a complete form flow containing steps.
 */
export function journey<D extends JourneyDefinition>(definition: Omit<D, '_forge'>): D {
  const result = finaliseBuilders({
    ...definition,
    _forge: StructureType.JOURNEY,
  }) as D
  stampCallsite(result, captureCallsite(journey))
  return result
}

/**
 * Create a forge package that bundles a journey with its custom functions and components.
 *
 * This is the mandatory gate into Forge: it parses string journeys, finalises
 * any builders in the journey tree (stamping source locations for diagnostics),
 * assembles function entries used by the journey into a registry alongside any
 * listed ones, and brands the result so `Forge.registerPackage()` accepts it.
 *
 * @param pkg - The forge package configuration
 * @returns The package with a finalised journey, branded for registration
 *
 * @example
 * ```typescript
 * // Package with custom function registries (deps injected via registerPackage)
 * export default createForgePackage<MyDeps>({
 *   journey: myJourney,
 *   functions: [myEffectsRegistry, myTransformersRegistry],
 * })
 *
 * // Journey only (entries embedded in the journey register automatically)
 * export default createForgePackage({
 *   journey: simpleJourney,
 * })
 * ```
 */
export function createForgePackage<TDeps = Record<string, never>>(
  pkg: ForgePackage<TDeps>,
): RegisteredForgePackage<TDeps> {
  const parsed: unknown = typeof pkg.journey === 'string' ? JSON.parse(pkg.journey) : pkg.journey
  const finalisedJourney = finaliseBuilders(parsed) as JourneyDefinition

  const result: RegisteredForgePackage<TDeps> = {
    ...pkg,
    journey: finalisedJourney,
    functions: assembleFunctions(pkg.functions, finalisedJourney),
    components: assembleComponents(pkg.components, finalisedJourney),
    forgePackage: true,
  }
  stampCallsite(result, captureCallsite(createForgePackage))
  return result
}

/**
 * Collects the package's function entries - listed in `functions` or embedded
 * in the journey - into a {@link FunctionEntryRegistry}, so the finalised
 * package carries ordinary registries only and the engine needs no knowledge
 * of entries. Packages without entries pass through untouched.
 */
function assembleFunctions<TDeps>(
  functions: ForgePackage<TDeps>['functions'],
  finalisedJourney: JourneyDefinition,
): RegisteredForgePackage<TDeps>['functions'] {
  const entryRegistry = new FunctionEntryRegistry<TDeps>()
  const listedRegistries: FunctionRegistryBuilder<TDeps>[] = []

  if (Array.isArray(functions)) {
    functions.forEach(item => {
      if (isFunctionEntry(item)) {
        entryRegistry.collectListed(item)
      } else {
        // The guard's negative branch cannot narrow the generic union, but a
        // non-entry item can only be a registry.
        listedRegistries.push(item as FunctionRegistryBuilder<TDeps>)
      }
    })
  } else if (functions) {
    // A depless registry is safe under any TDeps - build() just ignores the deps.
    listedRegistries.push(functions as FunctionRegistryBuilder<TDeps>)
  }

  entryRegistry.collectEmbedded(finalisedJourney)

  if (!entryRegistry.hasEntries()) {
    // The array held no entries at runtime, so its authored type narrows to
    // registries only.
    return functions as RegisteredForgePackage<TDeps>['functions']
  }

  return [...listedRegistries, entryRegistry]
}

/**
 * Collects the package's components - listed in `components` or stamped onto
 * blocks their builders created in the journey - into one listing, so the
 * engine registers every component the journey uses without the author naming
 * them. Packages whose journey embeds no components pass through untouched.
 */
function assembleComponents(
  components: ComponentRegistryEntry<object, unknown>[] | undefined,
  finalisedJourney: JourneyDefinition,
): ComponentRegistryEntry<object, unknown>[] | undefined {
  const componentCollector = new ComponentEntryCollector()

  components?.forEach(component => componentCollector.collectListed(component))
  componentCollector.collectEmbedded(finalisedJourney)

  if (!componentCollector.hasEmbedded()) {
    return components
  }

  return componentCollector.entries()
}
