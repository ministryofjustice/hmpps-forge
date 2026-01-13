import { when } from 'jest-when'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { StepASTNode } from '@form-engine/core/types/structures.type'
import { WiringContext } from '@form-engine/core/compilation/dependency-graph/WiringContext'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/compilation/dependency-graph/DependencyGraph'
import { PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import QueryWiring from './QueryWiring'

describe('QueryWiring', () => {
  let mockWiringContext: jest.Mocked<WiringContext>
  let mockGraph: jest.Mocked<DependencyGraph>
  let wiring: QueryWiring

  function createMockWiringContext(stepNode: StepASTNode): jest.Mocked<WiringContext> {
    return {
      nodeRegistry: {
        findByType: jest.fn().mockReturnValue([]),
        get: jest.fn().mockReturnValue(undefined),
      },
      findReferenceNodes: jest.fn().mockReturnValue([]),
      graph: mockGraph,
      getCurrentStepNode: jest.fn().mockReturnValue(stepNode),
    } as unknown as jest.Mocked<WiringContext>
  }

  beforeEach(() => {
    ASTTestFactory.resetIds()

    mockGraph = {
      addNode: jest.fn(),
      addEdge: jest.fn(),
    } as unknown as jest.Mocked<DependencyGraph>

    mockWiringContext = createMockWiringContext(ASTTestFactory.step().build())
    wiring = new QueryWiring(mockWiringContext)
  })

  describe('wire', () => {
    it('should wire query pseudo node to Query() reference consumers', () => {
      // Arrange
      const queryNode = ASTTestFactory.queryPseudoNode('redirect_url')
      const queryRef = ASTTestFactory.reference(['query', 'redirect_url'])

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(PseudoNodeType.QUERY)
        .mockReturnValue([queryNode])

      when(mockWiringContext.findReferenceNodes)
        .calledWith('query')
        .mockReturnValue([queryRef])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(queryNode.id, queryRef.id, DependencyEdgeType.DATA_FLOW, {
        referenceType: 'query',
        paramName: 'redirect_url',
      })
    })

    it('should handle multiple query pseudo nodes', () => {
      // Arrange
      const queryNode1 = ASTTestFactory.queryPseudoNode('redirect_url')
      const queryNode2 = ASTTestFactory.queryPseudoNode('session_id')

      const queryRef1 = ASTTestFactory.reference(['query', 'redirect_url'])
      const queryRef2 = ASTTestFactory.reference(['query', 'session_id'])

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(PseudoNodeType.QUERY)
        .mockReturnValue([queryNode1, queryNode2])

      when(mockWiringContext.findReferenceNodes)
        .calledWith('query')
        .mockReturnValue([queryRef1, queryRef2])

      // Act
      wiring.wire()

      // Assert - both consumer edges
      expect(mockGraph.addEdge).toHaveBeenCalledWith(queryNode1.id, queryRef1.id, DependencyEdgeType.DATA_FLOW, {
        referenceType: 'query',
        paramName: 'redirect_url',
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(queryNode2.id, queryRef2.id, DependencyEdgeType.DATA_FLOW, {
        referenceType: 'query',
        paramName: 'session_id',
      })
    })

    it('should wire multiple references to the same query parameter', () => {
      // Arrange
      const queryNode = ASTTestFactory.queryPseudoNode('user_id')

      const queryRef1 = ASTTestFactory.reference(['query', 'user_id'])
      const queryRef2 = ASTTestFactory.reference(['query', 'user_id'])
      const queryRef3 = ASTTestFactory.reference(['query', 'user_id'])

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(PseudoNodeType.QUERY)
        .mockReturnValue([queryNode])

      when(mockWiringContext.findReferenceNodes)
        .calledWith('query')
        .mockReturnValue([queryRef1, queryRef2, queryRef3])

      // Act
      wiring.wire()

      // Assert - all three references should be wired
      expect(mockGraph.addEdge).toHaveBeenCalledTimes(3)
      expect(mockGraph.addEdge).toHaveBeenCalledWith(queryNode.id, queryRef1.id, DependencyEdgeType.DATA_FLOW, {
        referenceType: 'query',
        paramName: 'user_id',
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(queryNode.id, queryRef2.id, DependencyEdgeType.DATA_FLOW, {
        referenceType: 'query',
        paramName: 'user_id',
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(queryNode.id, queryRef3.id, DependencyEdgeType.DATA_FLOW, {
        referenceType: 'query',
        paramName: 'user_id',
      })
    })

    describe('edge cases', () => {
      it('should handle no query pseudo nodes', () => {
        // Arrange
        when(mockWiringContext.nodeRegistry.findByType)
          .calledWith(PseudoNodeType.QUERY)
          .mockReturnValue([])

        // Act
        wiring.wire()

        // Assert - no edges created
        expect(mockGraph.addEdge).not.toHaveBeenCalled()
      })

      it('should not wire reference when reference path is too short', () => {
        // Arrange
        const queryNode = ASTTestFactory.queryPseudoNode('param')
        const invalidRef = ASTTestFactory.reference(['query']) // Missing param name

        when(mockWiringContext.nodeRegistry.findByType)
          .calledWith(PseudoNodeType.QUERY)
          .mockReturnValue([queryNode])

        when(mockWiringContext.findReferenceNodes)
          .calledWith('query')
          .mockReturnValue([invalidRef])

        // Act
        wiring.wire()

        // Assert - no edge to invalid reference
        expect(mockGraph.addEdge).not.toHaveBeenCalled()
      })

      it('should not wire reference when param name does not match', () => {
        // Arrange
        const queryNode = ASTTestFactory.queryPseudoNode('redirect_url')
        const differentParamRef = ASTTestFactory.reference(['query', 'session_id'])

        when(mockWiringContext.nodeRegistry.findByType)
          .calledWith(PseudoNodeType.QUERY)
          .mockReturnValue([queryNode])

        when(mockWiringContext.findReferenceNodes)
          .calledWith('query')
          .mockReturnValue([differentParamRef])

        // Act
        wiring.wire()

        // Assert - no edge to non-matching reference
        expect(mockGraph.addEdge).not.toHaveBeenCalled()
      })

      it('should handle query node with no consumers', () => {
        // Arrange
        const queryNode = ASTTestFactory.queryPseudoNode('unused_param')

        when(mockWiringContext.nodeRegistry.findByType)
          .calledWith(PseudoNodeType.QUERY)
          .mockReturnValue([queryNode])

        when(mockWiringContext.findReferenceNodes)
          .calledWith('query')
          .mockReturnValue([])

        // Act
        wiring.wire()

        // Assert - no edges created, but no error thrown
        expect(mockGraph.addEdge).not.toHaveBeenCalled()
      })

      it('should only wire matching param names', () => {
        // Arrange
        const queryNode1 = ASTTestFactory.queryPseudoNode('redirect_url')
        const queryNode2 = ASTTestFactory.queryPseudoNode('session_id')

        const queryRef1 = ASTTestFactory.reference(['query', 'redirect_url'])
        const queryRef2 = ASTTestFactory.reference(['query', 'user_id']) // No matching node

        when(mockWiringContext.nodeRegistry.findByType)
          .calledWith(PseudoNodeType.QUERY)
          .mockReturnValue([queryNode1, queryNode2])

        when(mockWiringContext.findReferenceNodes)
          .calledWith('query')
          .mockReturnValue([queryRef1, queryRef2])

        // Act
        wiring.wire()

        // Assert - only redirect_url should be wired
        expect(mockGraph.addEdge).toHaveBeenCalledTimes(1)
        expect(mockGraph.addEdge).toHaveBeenCalledWith(queryNode1.id, queryRef1.id, DependencyEdgeType.DATA_FLOW, {
          referenceType: 'query',
          paramName: 'redirect_url',
        })

        // Assert - user_id should not be wired
        expect(mockGraph.addEdge).not.toHaveBeenCalledWith(
          expect.anything(),
          queryRef2.id,
          expect.anything(),
          expect.anything(),
        )
      })
    })
  })
})
