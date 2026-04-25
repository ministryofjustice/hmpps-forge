import { isFieldBlockDefinition } from '../typeguards/structures'
import { ForgePackage } from '../../engine/types/engine.type'
import { ReferenceBuilder } from './ReferenceBuilder'
import { ScopedReferenceBuilder } from './ScopedReferenceBuilder'
import { LoopReferenceBuilder } from './LoopReferenceBuilder'
import { ChainableExpr, ChainableLoopRef, ChainableRef, ChainableScopedRef } from './types'
import { finaliseBuilders } from './utils/finaliseBuilders'
import { BlockDefinition, ConditionalString, FieldBlockDefinition } from '../../components/types/structures.type'
import {
  JourneyDefinition,
  StepDefinition,
  TieBreaker,
  TieBreakerProps,
  ValidationExpr,
  ValidationProps,
} from '../types/structures.type'
import {
  AccessHook,
  FormatExpr,
  RedirectOutcome,
  SubmitHook,
  ThrowErrorOutcome,
  ValueExpr,
} from '../types/expressions.type'
import { ExpressionBuilder } from './ExpressionBuilder'
import { BlockType, ExpressionType, OutcomeType, StructureType, HookType } from '../types/enums'

// Re-export public interfaces (for type annotations)
export type { ChainableExpr, ChainableLoopRef, ChainableRef, ChainableScopedRef, ChainableIterable } from './types'

// Re-export builder classes (for advanced use cases)
export { ExpressionBuilder } from './ExpressionBuilder'
export { ReferenceBuilder } from './ReferenceBuilder'
export { ScopedReferenceBuilder } from './ScopedReferenceBuilder'
export { LoopReferenceBuilder } from './LoopReferenceBuilder'
export { IterableBuilder } from './IterableBuilder'

// Re-export Iterator namespace for iterator configuration
export { Iterator } from './IteratorBuilder'

// Re-export predicate combinators
export { and, or, xor, not } from './PredicateTestExprBuilder'

// Re-export conditional builders
export { when, Conditional } from './ConditionalExprBuilder'

// Re-export match builder
export { match } from './MatchExprBuilder'

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

/**
 * Creates a submission hook for handling form submissions.
 * Use this in the onSubmission array of steps.
 */
export function submit(definition: Omit<SubmitHook, 'type'>): SubmitHook {
  return finaliseBuilders({ ...definition, type: HookType.SUBMIT }) as SubmitHook
}

/**
 * Creates an access hook for access control, data loading, and analytics.
 * Use this in the onAccess array of journeys or steps.
 */
export function access(definition: Omit<AccessHook, 'type'>): AccessHook {
  return finaliseBuilders({ ...definition, type: HookType.ACCESS }) as AccessHook
}

/**
 * Creates a validation rule for a field or step.
 * Add to the `validWhen` array - rules are checked in order.
 */
export function validation(definition: ValidationProps): ValidationExpr {
  return finaliseBuilders({
    ...definition,
    type: ExpressionType.VALIDATION,
  }) as ValidationExpr
}

/**
 * Creates a tie-breaker rule for a step. Add to `reachability.tieBreakers` —
 * entries are evaluated top-to-bottom and the first matching `when` (or an
 * entry with no `when`) supplies the step's priority.
 *
 * @example
 * tieBreaker({ priority: 100, when: Answer('income_started').match(true) })
 */
export function tieBreaker(definition: TieBreakerProps): TieBreaker {
  return finaliseBuilders({
    ...definition,
    type: ExpressionType.TIE_BREAKER,
  }) as TieBreaker
}

/**
 * Creates a redirect outcome for hooks.
 * When matched, halts hook processing and redirects to the specified path.
 *
 * @example
 * // Unconditional redirect
 * redirect({ goto: '/overview' })
 *
 * @example
 * // Conditional redirect
 * redirect({
 *   when: Data('needsSetup').match(Condition.Equals(true)),
 *   goto: '/setup',
 * })
 */
export function redirect(definition: Omit<RedirectOutcome, 'type'>): RedirectOutcome {
  return finaliseBuilders({
    ...definition,
    type: OutcomeType.REDIRECT,
  }) as RedirectOutcome
}

/**
 * Creates an error outcome for hooks.
 * When matched, halts hook processing and throws an HTTP error.
 *
 * @example
 * // Not found error
 * throwError({
 *   when: Data('notFound').match(Condition.Equals(true)),
 *   status: 404,
 *   message: 'Item not found',
 * })
 *
 * @example
 * // Dynamic error message
 * throwError({
 *   when: Data('saveError').match(Condition.IsRequired()),
 *   status: 500,
 *   message: Format('Failed to save: %1', Data('saveError')),
 * })
 */
export function throwError(definition: Omit<ThrowErrorOutcome, 'type'>): ThrowErrorOutcome {
  return finaliseBuilders({
    ...definition,
    type: OutcomeType.THROW_ERROR,
  }) as ThrowErrorOutcome
}

/**
 * Split a key string into path segments
 * 'user.name' -> ['user', 'name']
 * 'simple' -> ['simple']
 */
const splitKey = (key: string): string[] => (key.includes('.') ? key.split('.') : [key])

/**
 * References POST body data from form submission.
 */
export function Post(key: string): ChainableRef {
  return ReferenceBuilder.create(['post', ...splitKey(key)])
}

/**
 * References URL parameters (e.g., /users/:id).
 */
export function Params(key: string): ChainableRef {
  return ReferenceBuilder.create(['params', ...splitKey(key)])
}

/**
 * References query string parameters (e.g., ?search=test).
 */
export function Query(key: string): ChainableRef {
  return ReferenceBuilder.create(['query', ...splitKey(key)])
}

/**
 * References request metadata from the current request context.
 */
export const Request = {
  Url(): ChainableRef {
    return ReferenceBuilder.create(['request', 'url'])
  },

  Path(): ChainableRef {
    return ReferenceBuilder.create(['request', 'path'])
  },

  Method(): ChainableRef {
    return ReferenceBuilder.create(['request', 'method'])
  },

  Headers(name: string): ChainableRef {
    return ReferenceBuilder.create(['request', 'headers', name])
  },

  Cookies(name: string): ChainableRef {
    return ReferenceBuilder.create(['request', 'cookies', name])
  },

  State(key: string): ChainableRef {
    return ReferenceBuilder.create(['request', 'state', ...splitKey(key)])
  },
}

/**
 * References data defined for the step.
 */
export function Data(key: string): ChainableRef {
  return ReferenceBuilder.create(['data', ...splitKey(key)])
}

/**
 * References server-side session data from the current request context.
 */
export function Session(key: string): ChainableRef {
  return ReferenceBuilder.create(['session', ...splitKey(key)])
}

/**
 * References an answer using its target field or a string code.
 *
 * @example
 * Answer('email')  // Reference by code string
 * Answer(emailField)  // Reference by field definition
 * Answer('user.address.postcode')  // Nested path
 */
export function Answer(target: FieldBlockDefinition | ConditionalString): ChainableRef {
  // If it's a field block definition, use its code property
  if (isFieldBlockDefinition(target)) {
    const { code } = target

    // String code - split dot notation
    if (typeof code === 'string') {
      return ReferenceBuilder.create(['answers', ...splitKey(code)])
    }

    // Dynamic code (expression) - pass through
    return ReferenceBuilder.create(['answers', code as any])
  }

  // String target - split dot notation
  if (typeof target === 'string') {
    return ReferenceBuilder.create(['answers', ...splitKey(target)])
  }

  // Otherwise, use the target directly (expression types like Format)
  return ReferenceBuilder.create(['answers', target as any])
}

/**
 * References the current collection item when inside a collection scope.
 *
 * @example
 * Item().path('name')  // Access item.name
 * Item().value()  // Access the whole item
 * Item().parent.path('groupId')  // Access parent item's property
 */
export function Item(): ChainableScopedRef {
  return ScopedReferenceBuilder.create(0)
}

/**
 * References metadata for the current collection loop.
 *
 * @example
 * Loop.Index()  // 1-based iteration position
 * Loop.Index0()  // 0-based iteration index
 * Loop.Parent.Index()  // Parent loop position in nested iterations
 */
export const Loop: ChainableLoopRef = LoopReferenceBuilder.create(0)

/**
 * References the block/field it's in scope of.
 *
 * @example
 * Self().match(Condition.IsRequired())
 * Self().not.match(Condition.String.IsEmpty())
 * Self().pipe(Transformer.String.Trim).match(Condition.IsRequired())
 */
export function Self(): ChainableRef {
  return ReferenceBuilder.create(['answers', '@self'])
}

/**
 * Creates a string formatting expression with placeholder substitution.
 * Placeholders are %1, %2, etc.
 *
 * @example
 * Format('Hello %1!', Answer('name'))
 * Format('%1 %2', Answer('firstName'), Answer('lastName'))
 */
export function Format(template: string, ...args: ConditionalString[]): FormatExpr {
  return {
    type: ExpressionType.FORMAT,
    template,
    arguments: args,
  }
}

/**
 * Wraps a static/literal value to make it chainable with .pipe() and .match().
 *
 * Use this when you have static data that you want to transform or test
 * using the fluent expression API.
 *
 * @param value - Any static value (array, object, primitive)
 * @returns A chainable expression (only exposes .pipe(), .match(), .not)
 *
 * @example
 * // Static array with transformations
 * Literal(['apple', 'banana', 'cherry']).pipe(Transformer.Array.Filter(...))
 *
 * // Static value with condition
 * Literal(42).match(Condition.Number.GreaterThan(0))
 *
 * // Use with .each() for iteration
 * Literal([1, 2, 3]).each(Iterator.Map(Item().value()))
 */
export function Literal<T extends ValueExpr>(value: T): ChainableExpr<T> {
  return ExpressionBuilder.from(value)
}
