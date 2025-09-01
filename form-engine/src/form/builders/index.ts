import { BuildableReference, createReference } from '@form-engine/form/builders/utils/createReference'
import { isFieldBlockDefinition } from '@form-engine/form/typeguards'
import { createScopedReference, CreateScopedReference } from '@form-engine/form/builders/utils/createScopedReference'
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
  LoadTransition,
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
export function loadTransition(definition: LoadTransition): LoadTransition {
  return finaliseBuilders({ ...definition, type: TransitionType.LOAD }) as LoadTransition
}

/**
 * Creates an access transition for access control and analytics.
 * Use this in the onAccess lifecycle hook.
 */
export function accessTransition(definition: AccessTransition): AccessTransition {
  return finaliseBuilders({ ...definition, type: TransitionType.ACCESS }) as AccessTransition
}

export function validation(definition: Omit<ValidationExpr, 'type'>): ValidationExpr {
  return finaliseBuilders({
    ...definition,
    type: 'validation',
  }) as any
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
export const Answer = (target: FieldBlockDefinition | ConditionalString): BuildableReference =>
  createReference({
    type: ExpressionType.REFERENCE,
    path: ['answers', isFieldBlockDefinition(target) ? target.code : (target as any)],
  })

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
    path: ['@self'],
  })
