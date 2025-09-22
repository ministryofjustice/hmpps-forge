import { ASTNode } from '@form-engine/core/types/engine.type'
import { structuralTraverse, StructuralVisitResult } from '@form-engine/core/ast/traverser/StructuralTraverser'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { isReferenceExprNode } from '@form-engine/core/typeguards/expression-nodes'
import InvalidNodeError from '@form-engine/errors/InvalidNodeError'
import { isBlockStructNode } from '@form-engine/core/typeguards/structure-nodes'

function findContainingField(ancestors: any[], self: ASTNode): ASTNode | undefined {
  for (let i = ancestors.length - 1; i >= 0; i -= 1) {
    const a = ancestors[i]

    if (a !== self && isBlockStructNode(a) && a.blockType === 'field') {
      return a
    }
  }

  return undefined
}

function isPropertySentinel(obj: any): obj is { kind: 'property'; key: string; owner: any } {
  return obj && typeof obj === 'object' && obj.kind === 'property'
}

/**
 * Resolve Self() references by replacing `answers('@self')` path segment with the
 * nearest containing field's `code` property (string or expression AST).
 *
 * - Throws when used outside a field block.
 * - Throws when the containing field has no `code` defined.
 * - Throws when Self() is used inside the field's own `code` property to avoid recursion.
 */
export function resolveSelfReferences(root: ASTNode): void {
  structuralTraverse(root, {
    enterNode: (node, ctx) => {
      if (!isReferenceExprNode(node)) {
        return StructuralVisitResult.CONTINUE
      }

      const props = (node as any).properties as Map<string, any> | undefined

      if (!props) {
        return StructuralVisitResult.CONTINUE
      }

      const refPath = props.get('path')

      if (!Array.isArray(refPath)) {
        return StructuralVisitResult.CONTINUE
      }

      if (refPath.length < 2) {
        return StructuralVisitResult.CONTINUE
      }

      const rootSeg = refPath[0]
      const secondSeg = refPath[1]

      if (rootSeg !== 'answers' || secondSeg !== '@self') {
        return StructuralVisitResult.CONTINUE
      }

      const field = findContainingField(ctx.ancestors, node)

      if (!field) {
        throw new InvalidNodeError({
          message: 'Self() reference used outside of a field block',
          path: ctx.path as (string | number)[],
          expected: 'inside FieldBlock',
          actual: 'no containing field',
          code: 'self_outside_field',
        })
      }

      const fieldProps = (field as any).properties as Map<string, any> | undefined

      const codeValue = fieldProps?.get('code')

      if (codeValue === undefined) {
        throw new InvalidNodeError({
          message: 'Containing field has no code to resolve Self()',
          path: ctx.path as (string | number)[],
          expected: 'field.properties["code"]',
          actual: 'undefined',
          code: 'missing_field_code',
        })
      }

      // Prevent Self() inside the field's own code property (would cause recursion)
      for (let i = ctx.ancestors.length - 1; i >= 0; i -= 1) {
        const a = ctx.ancestors[i]
        if (isPropertySentinel(a) && a.key === 'code' && a.owner === field) {
          throw new InvalidNodeError({
            message: "Self() cannot be used within the field's code expression",
            path: ctx.path as (string | number)[],
            expected: 'code without Self()',
            actual: 'Self() in code',
            code: 'self_inside_code',
          })
        }
      }

      // Replace the '@self' segment with a deep-cloned field code value
      // to avoid aliasing the same AST node in multiple locations.
      refPath[1] = cloneDeep(codeValue)
      props.set('path', refPath)

      return StructuralVisitResult.CONTINUE
    },
  })
}

function cloneDeep<T>(value: T): T {
  if (value === null || value === undefined) {
    return value
  }

  if (typeof value !== 'object') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map(v => cloneDeep(v)) as unknown as T
  }

  if (isASTNode(value)) {
    const cloned: any = { ...value }

    // Remove id if already present to ensure a fresh assignment later
    delete cloned.id

    const props: Map<string, any> | undefined = (value as any).properties
    if (props instanceof Map) {
      const newMap = new Map<string, any>()

      for (const [k, v] of props.entries()) {
        newMap.set(k, cloneDeep(v))
      }

      cloned.properties = newMap
    }

    return cloned
  }

  if (value instanceof Map) {
    const newMap = new Map<any, any>()
    for (const [k, v] of value.entries()) {
      newMap.set(k, cloneDeep(v))
    }

    return newMap as unknown as T
  }

  // Plain object
  const out: any = {}
  for (const [k, v] of Object.entries(value as Record<string, any>)) {
    out[k] = cloneDeep(v)
  }

  return out
}
