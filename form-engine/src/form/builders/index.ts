import { isFieldBlockDefinition } from '@form-engine/form/typeguards/structures'
import { FormPackage } from '@form-engine/core/types/engine.type'
import { ReferenceBuilder } from './ReferenceBuilder'
import { ScopedReferenceBuilder } from './ScopedReferenceBuilder'
import { ChainableExpr, ChainableRef, ChainableScopedRef } from './types'
import { finaliseBuilders } from './utils/finaliseBuilders'
import {
  BlockDefinition,
  ConditionalString,
  FieldBlockDefinition,
  JourneyDefinition,
  StepDefinition,
  ValidationExpr,
} from '../types/structures.type'
import {
  AccessTransition,
  ActionTransition,
  FormatExpr,
  LoadTransition,
  NextExpr,
  SubmitTransition,
  ValueExpr,
} from '../types/expressions.type'
import { ExpressionBuilder } from './ExpressionBuilder'
import { ExpressionType, StructureType, TransitionType } from '../types/enums'

// Re-export public interfaces (for type annotations)
export type { ChainableExpr, ChainableRef, ChainableScopedRef, ChainableIterable } from './types'

// Re-export builder classes (for advanced use cases)
export { ExpressionBuilder } from './ExpressionBuilder'
export { ReferenceBuilder } from './ReferenceBuilder'
export { ScopedReferenceBuilder } from './ScopedReferenceBuilder'
export { IterableBuilder } from './IterableBuilder'

// Re-export Iterator namespace for iterator configuration
export { Iterator } from './IteratorBuilder'

// Re-export predicate combinators
export { and, or, xor, not } from './PredicateTestExprBuilder'

// Re-export conditional builders
export { when, Conditional } from './ConditionalExprBuilder'

export function block<D extends BlockDefinition>(definition: Omit<D, 'type' | 'blockType'>): D {
  return finaliseBuilders({
    ...definition,
    type: StructureType.BLOCK,
    blockType: 'basic',
  }) as D
}

export function field<D extends FieldBlockDefinition>(definition: Omit<D, 'type' | 'blockType'>): D {
  return finaliseBuilders({
    ...definition,
    type: StructureType.BLOCK,
    blockType: 'field',
  }) as D
}

export function step<D extends StepDefinition>(definition: Omit<D, 'type'>): D {
  return finaliseBuilders({
    ...definition,
    type: StructureType.STEP,
  }) as D
}

export function journey<D extends JourneyDefinition>(definition: Omit<D, 'type'>): D {
  return finaliseBuilders({
    ...definition,
    type: StructureType.JOURNEY,
  }) as D
}

/**
 * Create a form package that bundles a journey with its custom registries.
 *
 * @param pkg - The form package configuration
 * @returns The same package with proper typing
 *
 * @example
 * ```typescript
 * // Form with dependencies and custom functions
 * export default createFormPackage({
 *   journey: myJourney,
 *   createRegistries: (deps: MyDeps) => ({
 *     ...createMyEffectsRegistry(deps),
 *     ...MyTransformersRegistry,
 *   }),
 * })
 *
 * // Form with custom components
 * export default createFormPackage({
 *   journey: myJourney,
 *   components: [myCustomComponent],
 * })
 *
 * // Journey only (no custom registries)
 * export default createFormPackage({
 *   journey: simpleJourney,
 * })
 *
 * // Conditionally disabled form (via config/env var)
 * export default createFormPackage({
 *   enabled: config.forms.myFormEnabled,
 *   journey: myJourney,
 * })
 * ```
 */
export function createFormPackage<TDeps = void>(pkg: FormPackage<TDeps>): FormPackage<TDeps> {
  return pkg
}

/**
 * Creates a submission transition for handling form submissions.
 * Use this in the onSubmission array of steps.
 */
export function submitTransition(definition: Omit<SubmitTransition, 'type'>): SubmitTransition {
  return finaliseBuilders({ ...definition, type: TransitionType.SUBMIT }) as SubmitTransition
}

/**
 * Creates a load transition for data loading effects.
 * Use this in the onLoad lifecycle hook.
 */
export function loadTransition(definition: Omit<LoadTransition, 'type'>): LoadTransition {
  return finaliseBuilders({ ...definition, type: TransitionType.LOAD }) as LoadTransition
}

/**
 * Creates an access transition for access control and analytics.
 * Use this in the onAccess lifecycle hook.
 */
export function accessTransition(definition: Omit<AccessTransition, 'type'>): AccessTransition {
  return finaliseBuilders({ ...definition, type: TransitionType.ACCESS }) as AccessTransition
}

/**
 * Creates an action transition for in-page actions.
 * Use this in the onAction lifecycle hook for buttons that trigger effects
 * without navigating away (e.g., "Find address", "Add item").
 */
export function actionTransition(definition: Omit<ActionTransition, 'type'>): ActionTransition {
  return finaliseBuilders({ ...definition, type: TransitionType.ACTION }) as ActionTransition
}

export function validation(definition: Omit<ValidationExpr, 'type'>): ValidationExpr {
  return finaliseBuilders({
    ...definition,
    type: ExpressionType.VALIDATION,
  }) as ValidationExpr
}

/**
 * Creates a next navigation expression for transitions.
 * Use this in the next/redirect arrays of transitions.
 */
export function next(definition: Omit<NextExpr, 'type'>): NextExpr {
  return finaliseBuilders({
    ...definition,
    type: ExpressionType.NEXT,
  }) as NextExpr
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
 * References data defined for the step.
 */
export function Data(key: string): ChainableRef {
  return ReferenceBuilder.create(['data', ...splitKey(key)])
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
 * Item().index()  // Access iteration index
 * Item().parent.path('groupId')  // Access parent item's property
 */
export function Item(): ChainableScopedRef {
  return ScopedReferenceBuilder.create(0)
}

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
