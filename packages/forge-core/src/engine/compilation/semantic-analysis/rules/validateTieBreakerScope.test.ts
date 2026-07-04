import { ExpressionType, BlockType } from '../../../../authoring/types/enums'
import type { ASTNode, NodeId } from '../../../contracts/ast/engine.type'
import ASTNodeIndex from '../../ast/ast-state/ASTNodeIndex'
import ASTNodeTree from '../../ast/ast-state/ASTNodeTree'
import { ASTTestFactory } from '../../ast/testing-helpers/ASTTestFactory'
import FunctionRegistry from '../../../registries/FunctionRegistry'
import ComponentRegistry from '../../../registries/ComponentRegistry'
import ForgeConfigurationReferenceScopeError from '../../../errors/ForgeConfigurationReferenceScopeError'
import type { ASTValidationContext } from './types'
import { validateTieBreakerScope } from './validateTieBreakerScope'

const createContext = (nodes: readonly ASTNode[], edges: ReadonlyArray<[NodeId, NodeId]>): ASTValidationContext => {
  const nodeIndex = new ASTNodeIndex()
  nodes.forEach(node => nodeIndex.register(node.id, node))

  const nodeTree = new ASTNodeTree()
  edges.forEach(([childId, parentId]) => nodeTree.addNode(childId, parentId))

  return {
    nodeIndex,
    nodeTree,
    functionRegistry: new FunctionRegistry(),
    componentRegistry: new ComponentRegistry(),
  }
}

const errorCodes = (errors: readonly Error[]): string[] =>
  errors.map(error => (error as ForgeConfigurationReferenceScopeError).code)

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
      expect(errorCodes(errors)).toEqual(['tiebreaker_outside_step_reachability'])
    })

    it('should return an error when the parent is a step but the tie-breaker is absent from tieBreakers', () => {
      // Arrange
      const tieBreaker = createTieBreaker()
      const step = ASTTestFactory.step().withProperty('reachability', { tieBreakers: [] }).build()
      const context = createContext([tieBreaker, step], [[tieBreaker.id, step.id]])

      // Act
      const errors = validateTieBreakerScope(context)

      // Assert
      expect(errorCodes(errors)).toEqual(['tiebreaker_outside_step_reachability'])
    })

    it('should return an error when the tie-breaker has no parent', () => {
      // Arrange
      const tieBreaker = createTieBreaker()
      const context = createContext([tieBreaker], [])

      // Act
      const errors = validateTieBreakerScope(context)

      // Assert
      expect(errorCodes(errors)).toEqual(['tiebreaker_outside_step_reachability'])
    })
  })
})
