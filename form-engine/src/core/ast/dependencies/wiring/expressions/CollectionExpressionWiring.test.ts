import { when } from 'jest-when'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { ExpressionType } from '@form-engine/form/types/enums'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { CollectionASTNode, ExpressionASTNode } from '@form-engine/core/types/expressions.type'
import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import CollectionExpressionWiring from './CollectionExpressionWiring'

describe('CollectionExpressionWiring', () => {
  let mockWiringContext: jest.Mocked<WiringContext>
  let mockGraph: jest.Mocked<DependencyGraph>
  let wiring: CollectionExpressionWiring

  function createMockWiringContext(): jest.Mocked<WiringContext> {
    return {
      findNodesByType: jest.fn().mockReturnValue([]),
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
    wiring = new CollectionExpressionWiring(mockWiringContext)
  })

  describe('wire()', () => {
    it('should wire collection source to collection node', () => {
      const collectionSource = ASTTestFactory.expression(ExpressionType.REFERENCE).build()

      const collectionNode = ASTTestFactory.expression<CollectionASTNode>(ExpressionType.COLLECTION)
        .withProperty('collection', collectionSource)
        .withProperty('template', {})
        .build()

      when(mockWiringContext.findNodesByType)
        .calledWith(ASTNodeType.EXPRESSION)
        .mockReturnValue([collectionNode])

      wiring.wire()

      expect(mockGraph.addEdge).toHaveBeenCalledTimes(1)
      expect(mockGraph.addEdge).toHaveBeenCalledWith(
        collectionSource.id,
        collectionNode.id,
        DependencyEdgeType.DATA_FLOW,
        { property: 'collection' },
      )
    })

    it('should wire collection source and fallback items to collection node', () => {
      const collectionSource = ASTTestFactory.expression(ExpressionType.REFERENCE).build()
      const fallbackItem1 = ASTTestFactory.expression(ExpressionType.REFERENCE).build()
      const fallbackItem2 = ASTTestFactory.expression(ExpressionType.REFERENCE).build()

      const collectionNode = ASTTestFactory.expression<CollectionASTNode>(ExpressionType.COLLECTION)
        .withProperty('collection', collectionSource)
        .withProperty('template', {})
        .withProperty('fallback', [fallbackItem1, fallbackItem2])
        .build()

      when(mockWiringContext.findNodesByType)
        .calledWith(ASTNodeType.EXPRESSION)
        .mockReturnValue([collectionNode])

      wiring.wire()

      expect(mockGraph.addEdge).toHaveBeenCalledTimes(3)
      expect(mockGraph.addEdge).toHaveBeenCalledWith(
        collectionSource.id,
        collectionNode.id,
        DependencyEdgeType.DATA_FLOW,
        { property: 'collection' },
      )
      expect(mockGraph.addEdge).toHaveBeenCalledWith(
        fallbackItem1.id,
        collectionNode.id,
        DependencyEdgeType.DATA_FLOW,
        { property: 'fallback', index: 0 },
      )
      expect(mockGraph.addEdge).toHaveBeenCalledWith(
        fallbackItem2.id,
        collectionNode.id,
        DependencyEdgeType.DATA_FLOW,
        { property: 'fallback', index: 1 },
      )
    })

    it('should wire only fallback when collection is not an AST node', () => {
      const fallbackItem = ASTTestFactory.expression(ExpressionType.REFERENCE).build()

      const collectionNode = ASTTestFactory.expression<CollectionASTNode>(ExpressionType.COLLECTION)
        .withProperty('collection', 'literal-value')
        .withProperty('template', {})
        .withProperty('fallback', [fallbackItem])
        .build()

      when(mockWiringContext.findNodesByType)
        .calledWith(ASTNodeType.EXPRESSION)
        .mockReturnValue([collectionNode])

      wiring.wire()

      expect(mockGraph.addEdge).toHaveBeenCalledTimes(1)
      expect(mockGraph.addEdge).toHaveBeenCalledWith(fallbackItem.id, collectionNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'fallback',
        index: 0,
      })
    })

    it('should wire only collection when fallback is empty array', () => {
      const collectionSource = ASTTestFactory.expression(ExpressionType.REFERENCE).build()

      const collectionNode = ASTTestFactory.expression<CollectionASTNode>(ExpressionType.COLLECTION)
        .withProperty('collection', collectionSource)
        .withProperty('template', {})
        .withProperty('fallback', [])
        .build()

      when(mockWiringContext.findNodesByType)
        .calledWith(ASTNodeType.EXPRESSION)
        .mockReturnValue([collectionNode])

      wiring.wire()

      expect(mockGraph.addEdge).toHaveBeenCalledTimes(1)
      expect(mockGraph.addEdge).toHaveBeenCalledWith(
        collectionSource.id,
        collectionNode.id,
        DependencyEdgeType.DATA_FLOW,
        { property: 'collection' },
      )
    })

    it('should filter out non-AST nodes from fallback array', () => {
      const collectionSource = ASTTestFactory.expression(ExpressionType.REFERENCE).build()
      const fallbackItem1 = ASTTestFactory.expression(ExpressionType.REFERENCE).build()
      const fallbackItem2 = ASTTestFactory.expression(ExpressionType.REFERENCE).build()

      const collectionNode = ASTTestFactory.expression<CollectionASTNode>(ExpressionType.COLLECTION)
        .withProperty('collection', collectionSource)
        .withProperty('template', {})
        .withProperty('fallback', [fallbackItem1, 'literal-value', fallbackItem2, null])
        .build()

      when(mockWiringContext.findNodesByType)
        .calledWith(ASTNodeType.EXPRESSION)
        .mockReturnValue([collectionNode])

      wiring.wire()

      expect(mockGraph.addEdge).toHaveBeenCalledTimes(3)
      expect(mockGraph.addEdge).toHaveBeenCalledWith(
        collectionSource.id,
        collectionNode.id,
        DependencyEdgeType.DATA_FLOW,
        { property: 'collection' },
      )
      expect(mockGraph.addEdge).toHaveBeenCalledWith(
        fallbackItem1.id,
        collectionNode.id,
        DependencyEdgeType.DATA_FLOW,
        { property: 'fallback', index: 0 },
      )
      expect(mockGraph.addEdge).toHaveBeenCalledWith(
        fallbackItem2.id,
        collectionNode.id,
        DependencyEdgeType.DATA_FLOW,
        { property: 'fallback', index: 2 },
      )
    })

    describe('edge cases', () => {
      it('should handle empty expression nodes array', () => {
        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([])

        wiring.wire()

        expect(mockGraph.addEdge).not.toHaveBeenCalled()
      })

      it('should handle collection with undefined properties', () => {
        const collectionNode = ASTTestFactory.expression<CollectionASTNode>(ExpressionType.COLLECTION).build()

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([collectionNode])

        wiring.wire()

        expect(mockGraph.addEdge).not.toHaveBeenCalled()
      })

      it('should filter out non-collection expression types', () => {
        const referenceNode = ASTTestFactory.expression(ExpressionType.REFERENCE).build()
        const pipelineNode = ASTTestFactory.expression(ExpressionType.PIPELINE).build()

        const collectionSource = ASTTestFactory.expression(ExpressionType.REFERENCE).build()
        const collectionNode = ASTTestFactory.expression<CollectionASTNode>(ExpressionType.COLLECTION)
          .withProperty('collection', collectionSource)
          .withProperty('template', {})
          .build()

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([referenceNode, pipelineNode, collectionNode] as ExpressionASTNode[])

        wiring.wire()

        expect(mockGraph.addEdge).toHaveBeenCalledTimes(1)
        expect(mockGraph.addEdge).toHaveBeenCalledWith(
          collectionSource.id,
          collectionNode.id,
          DependencyEdgeType.DATA_FLOW,
          { property: 'collection' },
        )
      })
    })
  })
})
