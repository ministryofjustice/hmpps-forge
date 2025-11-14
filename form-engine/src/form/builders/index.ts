import { BuildableReference, createReference } from '@form-engine/form/builders/utils/createReference'
import { createScopedReference, CreateScopedReference } from '@form-engine/form/builders/utils/createScopedReference'
import { isFieldBlockDefinition } from '@form-engine/form/typeguards/structures'
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
  CollectionExpr,
  FormatExpr,
  LoadTransition,
  NextExpr,
  PipelineExpr,
  ReferenceExpr,
  SkipValidationTransition,
  SubmitTransition,
  ValidatingTransition,
} from '../types/expressions.type'
import { ExpressionType, StructureType, TransitionType } from '../types/enums'

export function block<D extends BlockDefinition>(definition: Omit<D, 'type'>): D {
  return finaliseBuilders({
    ...definition,
    type: StructureType.BLOCK,
  }) as D
}

export function field<D extends FieldBlockDefinition>(definition: Omit<D, 'type'>): D {
  return finaliseBuilders({
    ...definition,
    type: StructureType.BLOCK,
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
 * Creates a submission transition for handling form submissions.
 * Use this in the onSubmission array of steps.
 */
export function submitTransition(definition: Omit<ValidatingTransition, 'type'>): ValidatingTransition
export function submitTransition(definition: Omit<SkipValidationTransition, 'type'>): SkipValidationTransition
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
 * References POST body data from form submission
 */
export function Post(key: string): BuildableReference {
  return createReference({
    type: ExpressionType.REFERENCE,
    path: ['post', key],
  })
}

/**
 * References URL parameters (e.g., /users/:id)
 */
export function Params(key: string): BuildableReference {
  return createReference({
    type: ExpressionType.REFERENCE,
    path: ['params', key],
  })
}

/**
 * References query string parameters (e.g., ?search=test)
 */
export function Query(key: string): BuildableReference {
  return createReference({
    type: ExpressionType.REFERENCE,
    path: ['query', key],
  })
}

/**
 * References data defined for the step
 */
export const Data = (key: string): BuildableReference =>
  createReference({
    type: ExpressionType.REFERENCE,
    path: ['data', key],
  })

/**
 * References an answer using its target field, or a string
 */
export const Answer = (target: FieldBlockDefinition | ConditionalString): BuildableReference => {
  // If it's a field block definition, use its code property
  if (isFieldBlockDefinition(target)) {
    const { code } = target
    return createReference({
      type: ExpressionType.REFERENCE,
      path: ['answers', code as any],
    })
  }

  // Otherwise, use the target directly (string, or other ConditionalString types)
  return createReference({
    type: ExpressionType.REFERENCE,
    path: ['answers', target as any],
  })
}

/**
 * References the current collection item when inside a collection scope
 */
export const Item = (): CreateScopedReference => createScopedReference(0)

/**
 * References the block/field it's in scope of
 */
export const Self = (): BuildableReference =>
  createReference({
    type: ExpressionType.REFERENCE,
    path: ['answers', '@self'],
  })

export const Format = (template: string, ...args: ConditionalString[]): FormatExpr => {
  return {
    type: ExpressionType.FORMAT,
    template,
    arguments: args,
  }
}

/**
 * Creates a collection expression that iterates over data to produce repeated templates.
 * Collections allow dynamic generation of form elements based on arrays of data.
 *
 * @param collection - The data source to iterate over (array or expression)
 * @param template - Template blocks to render for each item
 * @param fallback - Optional fallback blocks when collection is empty
 * @returns Collection expression
 *
 * @example
 * // With fallback
 * Collection({
 *   collection: Data('items'),
 *   template: [field({ code: 'item_name', variant: 'text' })],
 *   fallback: [block({ variant: 'html', content: 'No items found' })]
 * })
 */
export const Collection = <T = any>({
  collection,
  template,
  fallback,
}: {
  collection: ReferenceExpr | PipelineExpr | any[]
  template: T[]
  fallback?: T[]
}): CollectionExpr<T> => {
  return {
    type: ExpressionType.COLLECTION,
    collection,
    template,
    fallback: fallback ?? [],
  }
}
