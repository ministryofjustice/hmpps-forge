import { finaliseBuilders } from './utils/finaliseBuilders'
import { BlockDefinition, FieldBlockDefinition } from '../../components/types/structures.type'
import { JourneyDefinition, StepDefinition } from '../types/structures.type'
import { ForgePackage } from '../types/package.type'
import { BlockType, StructureType } from '../types/enums'

/**
 * Creates a presentational (non-field) block for a step.
 * Use for headings, paragraphs, inset text, and other non-interactive content.
 */
export function block<D extends BlockDefinition>(definition: Omit<D, 'type' | 'blockType'>): D {
  return finaliseBuilders({
    ...definition,
    type: StructureType.BLOCK,
    blockType: BlockType.BASIC,
  }) as D
}

/**
 * Creates a field block that captures user input.
 * Fields have a `code` for storing answers and support `validWhen`, `dependentWhen`,
 * `defaultValue`, and `formatters`.
 */
export function field<D extends FieldBlockDefinition>(definition: Omit<D, 'type' | 'blockType'>): D {
  return finaliseBuilders({
    ...definition,
    type: StructureType.BLOCK,
    blockType: BlockType.FIELD,
  }) as D
}

/**
 * Creates a step (page) within a journey.
 * Steps contain blocks and define lifecycle hooks for access, submission, and actions.
 */
export function step<D extends StepDefinition>(definition: Omit<D, 'type'>): D {
  return finaliseBuilders({
    ...definition,
    type: StructureType.STEP,
  }) as D
}

/**
 * Creates a journey definition - a complete form flow containing steps.
 */
export function journey<D extends JourneyDefinition>(definition: Omit<D, 'type'>): D {
  return finaliseBuilders({
    ...definition,
    type: StructureType.JOURNEY,
  }) as D
}

/**
 * Create a forge package that bundles a journey with its custom functions and components.
 *
 * @param pkg - The forge package configuration
 * @returns The same package with proper typing
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
export function createForgePackage<TDeps = Record<string, never>>(pkg: ForgePackage<TDeps>): ForgePackage<TDeps> {
  return pkg
}
