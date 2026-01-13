import { ASTNode } from '@form-engine/core/types/engine.type'
import {
  structuralTraverse,
  StructuralVisitResult,
  StructuralVisitor,
  StructuralContext,
} from '@form-engine/core/compilation/traversers/StructuralTraverser'
import { isReferenceExprNode } from '@form-engine/core/typeguards/expression-nodes'
import InvalidNodeError from '@form-engine/errors/InvalidNodeError'
import { isFieldBlockStructNode } from '@form-engine/core/typeguards/structure-nodes'
import { FieldBlockASTNode } from '@form-engine/core/types/structures.type'
import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { isASTNode } from '@form-engine/core/typeguards/nodes'

/**
 * Deep clone a value with special handling for AST nodes
 *
 * AST nodes are cloned without their `id` property, allowing them to be
 * re-registered with new identities.
 */
function cloneASTValue<T>(value: T): T {
  if (value === null || value === undefined) {
    return value
  }

  if (typeof value !== 'object') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map(item => cloneASTValue(item)) as unknown as T
  }

  // AST nodes: clone all properties except `id`
  if (isASTNode(value)) {
    const cloned: Record<string, unknown> = {}

    Object.entries(value).forEach(([key, val]) => {
      if (key === 'id') {
        return
      }

      cloned[key] = cloneASTValue(val)
    })

    return cloned as T
  }

  // Clone Maps with recursive value cloning
  if (value instanceof Map) {
    const clonedMap = new Map<unknown, unknown>()

    value.forEach((mapValue, key) => {
      clonedMap.set(key, cloneASTValue(mapValue))
    })

    return clonedMap as unknown as T
  }

  // Clone plain objects
  const cloned: Record<string, unknown> = {}

  Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
    cloned[key] = cloneASTValue(val)
  })

  return cloned as unknown as T
}

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
 * Recursively assign new IDs to all AST nodes in a cloned value tree.
 * This is needed when embedding cloned AST nodes inside other nodes' properties,
 * since cloneASTValue strips IDs expecting re-registration.
 */
function assignIdsToClonedValue(
  value: any,
  nodeIdGenerator: NodeIDGenerator,
  category: NodeIDCategory.COMPILE_AST | NodeIDCategory.RUNTIME_AST,
): void {
  if (value === null || value === undefined || typeof value !== 'object') {
    return
  }

  if (Array.isArray(value)) {
    value.forEach(item => assignIdsToClonedValue(item, nodeIdGenerator, category))
    return
  }

  // If this is an AST node without an ID, assign one
  if (isASTNode(value) && !value.id) {
    ;(value as any).id = nodeIdGenerator.next(category)
  }

  // Recursively process all properties (including nested nodes in 'properties')
  Object.values(value).forEach(propValue => {
    assignIdsToClonedValue(propValue, nodeIdGenerator, category)
  })
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
  constructor(
    private readonly nodeIdGenerator: NodeIDGenerator,
    private readonly category: NodeIDCategory.COMPILE_AST | NodeIDCategory.RUNTIME_AST,
  ) {}

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
    // After cloning, assign IDs to any embedded AST nodes since cloneASTValue strips them.
    const clonedCode = cloneASTValue(codeValue)
    assignIdsToClonedValue(clonedCode, this.nodeIdGenerator, this.category)
    refPath[1] = clonedCode

    return StructuralVisitResult.CONTINUE
  }

  /**
   * Normalize the AST by resolving Self() references
   */
  normalize(root: ASTNode): void {
    structuralTraverse(root, this)
  }
}
