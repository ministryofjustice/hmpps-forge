import { when } from 'jest-when'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { ExpressionType, FunctionType } from '@form-engine/form/types/enums'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionASTNode, PipelineASTNode } from '@form-engine/core/types/expressions.type'
import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import PipelineExpressionWiring from './PipelineExpressionWiring'

describe('PipelineExpressionWiring', () => {
  let mockWiringContext: jest.Mocked<WiringContext>
  let mockGraph: jest.Mocked<DependencyGraph>
  let wiring: PipelineExpressionWiring

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
    wiring = new PipelineExpressionWiring(mockWiringContext)
  })

  describe('wire', () => {
    it('should wire input and steps to pipeline node', () => {
      // Arrange
      const inputNode = ASTTestFactory.expression(ExpressionType.REFERENCE).build()
      const transformer1 = ASTTestFactory.expression(FunctionType.TRANSFORMER).build()
      const transformer2 = ASTTestFactory.expression(FunctionType.TRANSFORMER).build()

      const pipelineNode = ASTTestFactory.expression<PipelineASTNode>(ExpressionType.PIPELINE)
        .withProperty('input', inputNode)
        .withProperty('steps', [transformer1, transformer2])
        .build()

      when(mockWiringContext.findNodesByType)
        .calledWith(ASTNodeType.EXPRESSION)
        .mockReturnValue([pipelineNode])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(inputNode.id, pipelineNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'input',
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(transformer1.id, pipelineNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'steps',
        index: 0,
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(transformer2.id, pipelineNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'steps',
        index: 1,
      })
    })

    it('should wire only input when steps is empty array', () => {
      // Arrange
      const inputNode = ASTTestFactory.expression(ExpressionType.REFERENCE).build()

      const pipelineNode = ASTTestFactory.expression<PipelineASTNode>(ExpressionType.PIPELINE)
        .withProperty('input', inputNode)
        .withProperty('steps', [])
        .build()

      when(mockWiringContext.findNodesByType)
        .calledWith(ASTNodeType.EXPRESSION)
        .mockReturnValue([pipelineNode])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledTimes(1)
      expect(mockGraph.addEdge).toHaveBeenCalledWith(inputNode.id, pipelineNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'input',
      })
    })

    it('should wire only steps when input is not an AST node', () => {
      // Arrange
      const transformer1 = ASTTestFactory.expression(FunctionType.TRANSFORMER).build()
      const transformer2 = ASTTestFactory.expression(FunctionType.TRANSFORMER).build()

      const pipelineNode = ASTTestFactory.expression<PipelineASTNode>(ExpressionType.PIPELINE)
        .withProperty('input', 'literal-value')
        .withProperty('steps', [transformer1, transformer2])
        .build()

      when(mockWiringContext.findNodesByType)
        .calledWith(ASTNodeType.EXPRESSION)
        .mockReturnValue([pipelineNode])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledTimes(2)
      expect(mockGraph.addEdge).toHaveBeenCalledWith(transformer1.id, pipelineNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'steps',
        index: 0,
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(transformer2.id, pipelineNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'steps',
        index: 1,
      })
    })

    it('should filter out non-AST nodes from steps array', () => {
      // Arrange
      const inputNode = ASTTestFactory.expression(ExpressionType.REFERENCE).build()
      const transformer1 = ASTTestFactory.expression(FunctionType.TRANSFORMER).build()
      const transformer2 = ASTTestFactory.expression(FunctionType.TRANSFORMER).build()

      const pipelineNode = ASTTestFactory.expression<PipelineASTNode>(ExpressionType.PIPELINE)
        .withProperty('input', inputNode)
        .withProperty('steps', [transformer1, 'literal-transformer', transformer2, null])
        .build()

      when(mockWiringContext.findNodesByType)
        .calledWith(ASTNodeType.EXPRESSION)
        .mockReturnValue([pipelineNode])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledTimes(3)
      expect(mockGraph.addEdge).toHaveBeenCalledWith(inputNode.id, pipelineNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'input',
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(transformer1.id, pipelineNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'steps',
        index: 0,
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(transformer2.id, pipelineNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'steps',
        index: 2,
      })
    })

    describe('edge cases', () => {
      it('should handle empty expression nodes array', () => {
        // Arrange
        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([])

        // Act
        wiring.wire()

        // Assert
        expect(mockGraph.addEdge).not.toHaveBeenCalled()
      })

      it('should handle pipeline with undefined properties', () => {
        // Arrange
        const pipelineNode = ASTTestFactory.expression<PipelineASTNode>(ExpressionType.PIPELINE).build()

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([pipelineNode])

        // Act
        wiring.wire()

        // Assert
        expect(mockGraph.addEdge).not.toHaveBeenCalled()
      })

      it('should filter out non-pipeline expression types', () => {
        // Arrange
        const conditionalNode = ASTTestFactory.expression(ExpressionType.REFERENCE).build()
        const referenceNode = ASTTestFactory.expression(ExpressionType.REFERENCE).build()

        const inputNode = ASTTestFactory.expression(ExpressionType.REFERENCE).build()
        const pipelineNode = ASTTestFactory.expression<PipelineASTNode>(ExpressionType.PIPELINE)
          .withProperty('input', inputNode)
          .withProperty('steps', [])
          .build()

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([conditionalNode, referenceNode, pipelineNode] as ExpressionASTNode[])

        // Act
        wiring.wire()

        // Assert
        expect(mockGraph.addEdge).toHaveBeenCalledTimes(1)
        expect(mockGraph.addEdge).toHaveBeenCalledWith(inputNode.id, pipelineNode.id, DependencyEdgeType.DATA_FLOW, {
          property: 'input',
        })
      })
    })
  })
})
