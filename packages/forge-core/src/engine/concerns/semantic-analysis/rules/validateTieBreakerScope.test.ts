import { ExpressionType, BlockType } from '../../../../authoring/types/enums'
import type { ASTNode, NodeId } from '../../../chassis/contracts/ast/engine.type'
import ASTNodeIndex from '../../../chassis/compilation/ast/ast-state/ASTNodeIndex'
import { ASTTestFactory } from '../../../chassis/compilation/ast/testing-helpers/ASTTestFactory'
import FunctionRegistry from '../../../chassis/registries/FunctionRegistry'
import ComponentRegistry from '../../../chassis/registries/ComponentRegistry'
import ForgeReferenceScopeError from '../../../errors/ForgeReferenceScopeError'
import type { ASTValidationContext } from './types'
import { validateTieBreakerScope } from './validateTieBreakerScope'

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

const errorMessages = (errors: readonly Error[]): string[] =>
  errors.map(error => (error as ForgeReferenceScopeError).message)

const createTieBreaker = (): ASTNode =>
  ASTTestFactory.expression<ASTNode>(ExpressionType.TIE_BREAKER).withProperty('priority', 1).build()

describe('validateTieBreakerScope', () => {
  describe('validateTieBreakerScope()', () => {
    beforeEach(() => {
      ASTTestFactory.resetIds()
    })

    it('should return no errors when a tie-breaker is in a step reachability tieBreakers array', () => {
      // Arrange
      const tieBreaker = createTieBreaker()
      const step = ASTTestFactory.step()
        .withProperty('reachability', { tieBreakers: [tieBreaker] })
        .build()
      const context = createContext([tieBreaker, step], [[tieBreaker.id, step.id]])

      // Act
      const errors = validateTieBreakerScope(context)

      // Assert
      expect(errors).toHaveLength(0)
    })

    it('should return an error when the parent is not a step', () => {
      // Arrange
      const tieBreaker = createTieBreaker()
      const block = ASTTestFactory.block('text', BlockType.FIELD).withProperty('defaultValue', tieBreaker).build()
      const context = createContext([tieBreaker, block], [[tieBreaker.id, block.id]])

      // Act
      const errors = validateTieBreakerScope(context)

      // Assert
      expect(errorMessages(errors)).toEqual(["Tie-breakers can only be used in a step's reachability configuration"])
    })

    it('should return an error when the parent is a step but the tie-breaker is absent from tieBreakers', () => {
      // Arrange
      const tieBreaker = createTieBreaker()
      const step = ASTTestFactory.step().withProperty('reachability', { tieBreakers: [] }).build()
      const context = createContext([tieBreaker, step], [[tieBreaker.id, step.id]])

      // Act
      const errors = validateTieBreakerScope(context)

      // Assert
      expect(errorMessages(errors)).toEqual(["Tie-breakers can only be used in a step's reachability configuration"])
    })

    it('should return an error when the tie-breaker has no parent', () => {
      // Arrange
      const tieBreaker = createTieBreaker()
      const context = createContext([tieBreaker], [])

      // Act
      const errors = validateTieBreakerScope(context)

      // Assert
      expect(errorMessages(errors)).toEqual(["Tie-breakers can only be used in a step's reachability configuration"])
    })
  })
})
