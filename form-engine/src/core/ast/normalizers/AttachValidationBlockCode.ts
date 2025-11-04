import { ASTNode } from '@form-engine/core/types/engine.type'
import {
  structuralTraverse,
  StructuralVisitResult,
  StructuralVisitor,
  StructuralContext,
} from '@form-engine/core/ast/traverser/StructuralTraverser'
import { isValidationExprNode } from '@form-engine/core/typeguards/expression-nodes'
import { BlockASTNode } from '@form-engine/core/types/structures.type'
import { isBlockStructNode } from '@form-engine/core/typeguards/structure-nodes'
import { isASTNode } from '@form-engine/core/typeguards/nodes'

/**
 * Normalizer that records the owning block's code on validation expressions.
 * Allows runtime validation handlers to avoid walking back up the AST.
 */
export class AttachValidationBlockCodeNormalizer implements StructuralVisitor {
  /**
   * Visitor method: called when entering a node during traversal
   */
  enterNode(node: ASTNode, ctx: StructuralContext): StructuralVisitResult {
    if (!isValidationExprNode(node)) {
      return StructuralVisitResult.CONTINUE
    }

    const owningBlock = findOwningBlock(ctx.ancestors)

    if (!owningBlock) {
      return StructuralVisitResult.CONTINUE
    }

    const resolvedCode = resolveBlockCode(owningBlock)

    if (resolvedCode === undefined) {
      node.properties.delete('resolvedBlockCode')
    } else {
      node.properties.set('resolvedBlockCode', resolvedCode)
    }

    return StructuralVisitResult.CONTINUE
  }

  /**
   * Normalize the AST by attaching validation block codes
   */
  normalize(root: ASTNode): void {
    structuralTraverse(root, this)
  }
}

function findOwningBlock(ancestors: any[]): BlockASTNode | undefined {
  for (let i = ancestors.length - 1; i >= 0; i -= 1) {
    const candidate = ancestors[i]

    if (isBlockStructNode(candidate)) {
      return candidate
    }
  }

  return undefined
}

function resolveBlockCode(block: BlockASTNode): string | unknown | undefined {
  const { properties } = block

  const code = properties.get('code')

  return cloneValue(code)
}

function cloneValue<T>(value: T): T {
  if (value === null || value === undefined) {
    return value
  }

  if (typeof value !== 'object') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map(item => cloneValue(item)) as unknown as T
  }

  if (isASTNode(value)) {
    const cloned: any = { ...value }

    delete cloned.id

    const props: Map<string, any> | undefined = (value as any).properties

    if (props instanceof Map) {
      const newProps = new Map<string, any>()

      props.forEach((propValue, key) => {
        newProps.set(key, cloneValue(propValue))
      })

      cloned.properties = newProps
    }

    return cloned
  }

  if (value instanceof Map) {
    const newMap = new Map<any, any>()

    value.forEach((mapValue, key) => {
      newMap.set(key, cloneValue(mapValue))
    })

    return newMap as unknown as T
  }

  const result: Record<string, unknown> = {}

  Object.entries(value as Record<string, unknown>).forEach(([key, entryValue]) => {
    result[key] = cloneValue(entryValue)
  })

  return result as unknown as T
}
