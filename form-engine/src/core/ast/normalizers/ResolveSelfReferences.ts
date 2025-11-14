import { ASTNode } from '@form-engine/core/types/engine.type'
import {
  structuralTraverse,
  StructuralVisitResult,
  StructuralVisitor,
  StructuralContext,
} from '@form-engine/core/ast/traverser/StructuralTraverser'
import { isReferenceExprNode } from '@form-engine/core/typeguards/expression-nodes'
import InvalidNodeError from '@form-engine/errors/InvalidNodeError'
import { isFieldBlockStructNode } from '@form-engine/core/typeguards/structure-nodes'
import { FieldBlockASTNode } from '@form-engine/core/types/structures.type'
import { cloneASTValue } from '@form-engine/core/ast/utils/cloneASTValue'

function findContainingField(ancestors: any[], self: ASTNode): FieldBlockASTNode | undefined {
  for (let i = ancestors.length - 1; i >= 0; i -= 1) {
    const a = ancestors[i]

    if (a !== self && isFieldBlockStructNode(a)) {
      return a
    }
  }

  return undefined
}

function isPropertySentinel(obj: any): obj is { kind: 'property'; key: string; owner: any } {
  return obj && typeof obj === 'object' && obj.kind === 'property'
}

/**
 * Normalizer that resolves Self() references by replacing `answers('@self')` path segment
 * with the nearest containing field's `code` property (string or expression AST).
 *
 * - Throws when used outside a field block.
 * - Throws when the containing field has no `code` defined.
 * - Throws when Self() is used inside the field's own `code` property to avoid recursion.
 */
export class ResolveSelfReferencesNormalizer implements StructuralVisitor {
  /**
   * Visitor method: called when entering a node during traversal
   */
  enterNode(node: ASTNode, ctx: StructuralContext): StructuralVisitResult {
    if (!isReferenceExprNode(node)) {
      return StructuralVisitResult.CONTINUE
    }

    const props = (node as any).properties

    if (!props) {
      return StructuralVisitResult.CONTINUE
    }

    const refPath = props.path

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

    const fieldProps = (field as any).properties

    const codeValue = fieldProps?.code

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
    refPath[1] = cloneASTValue(codeValue)

    return StructuralVisitResult.CONTINUE
  }

  /**
   * Normalize the AST by resolving Self() references
   */
  normalize(root: ASTNode): void {
    structuralTraverse(root, this)
  }
}
