import { ExpressionType, IteratorType } from '../../../../authoring/types/enums'
import type { ASTNode, NodeId } from '../../../chassis/contracts/ast/engine.type'
import type { IterateASTNode } from '../../../chassis/contracts/ast/expressions.type'
import ASTNodeIndex from '../../../chassis/compilation/ast/ast-state/ASTNodeIndex'
import { ASTTestFactory } from '../../../chassis/compilation/ast/testing-helpers/ASTTestFactory'
import FunctionRegistry from '../../../chassis/registries/FunctionRegistry'
import ComponentRegistry from '../../../chassis/registries/ComponentRegistry'
import ForgeReferenceScopeError from '../../../errors/ForgeReferenceScopeError'
import type { ASTValidationContext } from './types'
import { validateReferenceScopes } from './validateReferenceScopes'

const createContext = (nodes: readonly ASTNode[], edges: ReadonlyArray<[NodeId, NodeId]>): ASTValidationContext => {
  const byId = new Map<NodeId, ASTNode>(nodes.map(node => [node.id, node]))

  edges.forEach(([childId, parentId]) => {
    const child = byId.get(childId)
    const parent = byId.get(parentId)

    if (child !== undefined && parent !== undefined) {
      Object.defineProperty(child, 'parent', { value: parent, enumerable: false })
    }
  })

  const nodeIndex = new ASTNodeIndex()
  nodes.forEach(node => nodeIndex.register(node.id, node))

  return {
    nodeIndex,
    functionRegistry: new FunctionRegistry(),
    componentRegistry: new ComponentRegistry(),
  }
}

const scopeErrors = (errors: readonly Error[]): ForgeReferenceScopeError[] =>
  errors.filter((error): error is ForgeReferenceScopeError => {
    return error instanceof ForgeReferenceScopeError
  })

describe('validateReferenceScopes', () => {
  describe('validateReferenceScopes()', () => {
    beforeEach(() => {
      ASTTestFactory.resetIds()
    })

    it('should reject an Item reference wrapped in a raw array as an iterate input', () => {
      // Arrange
      const reference = ASTTestFactory.reference(['@scope', '0', 'firstName'])
      const iterate = ASTTestFactory.expression<IterateASTNode>(ExpressionType.ITERATE)
        .withProperty('input', [reference, 'other'])
        .withProperty('iterator', { type: IteratorType.MAP })
        .build()
      const context = createContext([reference, iterate], [[reference.id, iterate.id]])

      // Act
      const errors = validateReferenceScopes(context)

      // Assert
      const [scopeError] = scopeErrors(errors)
      expect(scopeError.message).toBe('Item() can only be used inside an iterator')
    })
  })
})
