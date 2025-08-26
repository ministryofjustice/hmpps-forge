import { BuildableReference, createReference } from '../builders/utils/createReference'
import { createScopedReference, CreateScopedReference } from '../builders/utils/createScopedReference'
import { FieldBlockDefinition, ConditionalString } from '../types/structures.type'
import { isFieldBlockDefinition } from '../typeguards'
import { ExpressionType } from '../types/enums'

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
