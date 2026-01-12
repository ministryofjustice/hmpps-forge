import { when } from 'jest-when'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { ExpressionType } from '@form-engine/form/types/enums'
import { ReferenceASTNode } from '@form-engine/core/types/expressions.type'
import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import ReferenceWiring from './ReferenceWiring'

describe('ReferenceWiring', () => {
  let mockWiringContext: jest.Mocked<WiringContext>
  let mockGraph: jest.Mocked<DependencyGraph>
  let wiring: ReferenceWiring

  function createMockWiringContext(): jest.Mocked<WiringContext> {
    return {
      nodeRegistry: {
        findByType: jest.fn().mockReturnValue([]),
        get: jest.fn().mockReturnValue(undefined),
      },
      graph: mockGraph,
    } as unknown as jest.Mocked<WiringContext>
  }

  beforeEach(() => {
    ASTTestFactory.resetIds()

    mockGraph = {
      addNode: jest.fn(),
      addEdge: jest.fn(),
    } as unknown as jest.Mocked<DependencyGraph>

    mockWiringContext = createMockWiringContext()
    wiring = new ReferenceWiring(mockWiringContext)
  })

  describe('wire', () => {
    it('should wire dynamic path segment to reference node', () => {
      // Arrange
      const indexNode = ASTTestFactory.reference(['data', 'currentIndex'])

      const referenceNode = ASTTestFactory.expression<ReferenceASTNode>(ExpressionType.REFERENCE)
        .withPath(['items', indexNode])
        .build()

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(ExpressionType.REFERENCE)
        .mockReturnValue([referenceNode])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(indexNode.id, referenceNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'path',
        index: 1,
      })
    })

    it('should wire multiple dynamic path segments', () => {
      // Arrange
      const arrayIndexNode = ASTTestFactory.reference(['data', 'arrayIndex'])
      const propertyNode = ASTTestFactory.reference(['data', 'propertyName'])

      const referenceNode = ASTTestFactory.expression<ReferenceASTNode>(ExpressionType.REFERENCE)
        .withPath(['items', arrayIndexNode, propertyNode])
        .build()

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(ExpressionType.REFERENCE)
        .mockReturnValue([referenceNode])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledTimes(2)
      expect(mockGraph.addEdge).toHaveBeenCalledWith(
        arrayIndexNode.id,
        referenceNode.id,
        DependencyEdgeType.DATA_FLOW,
        {
          property: 'path',
          index: 1,
        },
      )
      expect(mockGraph.addEdge).toHaveBeenCalledWith(propertyNode.id, referenceNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'path',
        index: 2,
      })
    })

    it('should skip wiring when path contains only static segments', () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['answers', 'email'])

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(ExpressionType.REFERENCE)
        .mockReturnValue([referenceNode])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).not.toHaveBeenCalled()
    })

    it('should wire multiple reference nodes', () => {
      // Arrange
      const indexNode1 = ASTTestFactory.reference(['data', 'index1'])
      const indexNode2 = ASTTestFactory.reference(['data', 'index2'])

      const referenceNode1 = ASTTestFactory.expression<ReferenceASTNode>(ExpressionType.REFERENCE)
        .withPath(['items', indexNode1])
        .build()

      const referenceNode2 = ASTTestFactory.expression<ReferenceASTNode>(ExpressionType.REFERENCE)
        .withPath(['data', indexNode2, 'value'])
        .build()

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(ExpressionType.REFERENCE)
        .mockReturnValue([referenceNode1, referenceNode2])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledTimes(2)
      expect(mockGraph.addEdge).toHaveBeenCalledWith(indexNode1.id, referenceNode1.id, DependencyEdgeType.DATA_FLOW, {
        property: 'path',
        index: 1,
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(indexNode2.id, referenceNode2.id, DependencyEdgeType.DATA_FLOW, {
        property: 'path',
        index: 1,
      })
    })

    it('should handle path with mixed static and dynamic segments', () => {
      // Arrange
      const dynamicSegment = ASTTestFactory.reference(['scope', 'key'])

      const referenceNode = ASTTestFactory.expression<ReferenceASTNode>(ExpressionType.REFERENCE)
        .withPath(['answers', dynamicSegment, 'nested', 0])
        .build()

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(ExpressionType.REFERENCE)
        .mockReturnValue([referenceNode])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledTimes(1)
      expect(mockGraph.addEdge).toHaveBeenCalledWith(
        dynamicSegment.id,
        referenceNode.id,
        DependencyEdgeType.DATA_FLOW,
        {
          property: 'path',
          index: 1,
        },
      )
    })
  })
})
