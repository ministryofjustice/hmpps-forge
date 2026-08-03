import { finaliseBuilders } from './utils/finaliseBuilders'
import { captureCallsite, stampCallsite } from './utils/captureCallsite'
import { BlockDefinition, FieldBlockDefinition } from '../../components/types/structures.type'
import { JourneyDefinition, StepDefinition } from '../types/structures.type'
import { ForgePackage, RegisteredForgePackage } from '../types/package.type'
import { BlockType, StructureType } from '../types/enums'

/**
 * Creates a presentational (non-field) block for a step.
 * Use for headings, paragraphs, inset text, and other non-interactive content.
 */
export function block<D extends BlockDefinition>(definition: Omit<D, 'type' | 'blockType'>): D {
  const result = finaliseBuilders({
    ...definition,
    type: StructureType.BLOCK,
    blockType: BlockType.BASIC,
  }) as D
  stampCallsite(result, captureCallsite(block))
  return result
}

/**
 * Creates a field block that captures user input.
 * Fields have a `code` for storing answers and support `validWhen`, `dependentWhen`,
 * `defaultValue`, and `formatters`.
 */
export function field<D extends FieldBlockDefinition>(definition: Omit<D, 'type' | 'blockType'>): D {
  const result = finaliseBuilders({
    ...definition,
    type: StructureType.BLOCK,
    blockType: BlockType.FIELD,
  }) as D
  stampCallsite(result, captureCallsite(field))
  return result
}

/**
 * Creates a step (page) within a journey.
 * Steps contain blocks and define lifecycle hooks for access, submission, and actions.
 */
export function step<D extends StepDefinition>(definition: Omit<D, 'type'>): D {
  const result = finaliseBuilders({
    ...definition,
    type: StructureType.STEP,
  }) as D
  stampCallsite(result, captureCallsite(step))
  return result
}

/**
 * Creates a journey definition - a complete form flow containing steps.
 */
export function journey<D extends JourneyDefinition>(definition: Omit<D, 'type'>): D {
  const result = finaliseBuilders({
    ...definition,
    type: StructureType.JOURNEY,
  }) as D
  stampCallsite(result, captureCallsite(journey))
  return result
}

/**
 * Create a forge package that bundles a journey with its custom functions and components.
 *
 * This is the mandatory gate into Forge: it parses string journeys, finalises
 * any builders in the journey tree (stamping source locations for diagnostics),
 * and brands the result so `Forge.registerPackage()` accepts it.
 *
 * @param pkg - The forge package configuration
 * @returns The package with a finalised journey, branded for registration
 *
 * @example
 * ```typescript
 * // Package with custom functions (deps injected via registerPackage)
 * export default createForgePackage<MyDeps>({
 *   journey: myJourney,
 *   functions: {
 *     ...myEffectsImplementations,
 *     ...myTransformersImplementations,
 *   },
 * })
 *
 * // Journey only (no custom functions)
 * export default createForgePackage({
 *   journey: simpleJourney,
 * })
 * ```
 */
export function createForgePackage<TDeps = Record<string, never>>(
  pkg: ForgePackage<TDeps>,
): RegisteredForgePackage<TDeps> {
  const parsed: unknown = typeof pkg.journey === 'string' ? JSON.parse(pkg.journey) : pkg.journey

  const result: RegisteredForgePackage<TDeps> = {
    ...pkg,
    journey: finaliseBuilders(parsed) as JourneyDefinition,
    forgePackage: true,
  }
  stampCallsite(result, captureCallsite(createForgePackage))
  return result
}
