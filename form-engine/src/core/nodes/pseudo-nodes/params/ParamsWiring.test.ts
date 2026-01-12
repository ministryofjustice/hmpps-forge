import { when } from 'jest-when'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { StepASTNode } from '@form-engine/core/types/structures.type'
import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import { PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import ParamsWiring from './ParamsWiring'

describe('ParamsWiring', () => {
  let mockWiringContext: jest.Mocked<WiringContext>
  let mockGraph: jest.Mocked<DependencyGraph>
  let wiring: ParamsWiring

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
    wiring = new ParamsWiring(mockWiringContext)
  })

  describe('wire', () => {
    it('should wire params pseudo node to Params() reference consumers', () => {
      // Arrange
      const paramsNode = ASTTestFactory.paramsPseudoNode('journey_id')
      const paramsRef = ASTTestFactory.reference(['params', 'journey_id'])

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(PseudoNodeType.PARAMS)
        .mockReturnValue([paramsNode])

      when(mockWiringContext.findReferenceNodes)
        .calledWith('params')
        .mockReturnValue([paramsRef])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(paramsNode.id, paramsRef.id, DependencyEdgeType.DATA_FLOW, {
        referenceType: 'params',
        paramName: 'journey_id',
      })
    })

    it('should handle multiple params pseudo nodes', () => {
      // Arrange
      const paramsNode1 = ASTTestFactory.paramsPseudoNode('journey_id')
      const paramsNode2 = ASTTestFactory.paramsPseudoNode('step_id')

      const paramsRef1 = ASTTestFactory.reference(['params', 'journey_id'])
      const paramsRef2 = ASTTestFactory.reference(['params', 'step_id'])

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(PseudoNodeType.PARAMS)
        .mockReturnValue([paramsNode1, paramsNode2])

      when(mockWiringContext.findReferenceNodes)
        .calledWith('params')
        .mockReturnValue([paramsRef1, paramsRef2])

      // Act
      wiring.wire()

      // Assert - both consumer edges
      expect(mockGraph.addEdge).toHaveBeenCalledWith(paramsNode1.id, paramsRef1.id, DependencyEdgeType.DATA_FLOW, {
        referenceType: 'params',
        paramName: 'journey_id',
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(paramsNode2.id, paramsRef2.id, DependencyEdgeType.DATA_FLOW, {
        referenceType: 'params',
        paramName: 'step_id',
      })
    })

    it('should wire multiple references to the same path parameter', () => {
      // Arrange
      const paramsNode = ASTTestFactory.paramsPseudoNode('journey_id')

      const paramsRef1 = ASTTestFactory.reference(['params', 'journey_id'])
      const paramsRef2 = ASTTestFactory.reference(['params', 'journey_id'])
      const paramsRef3 = ASTTestFactory.reference(['params', 'journey_id'])

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(PseudoNodeType.PARAMS)
        .mockReturnValue([paramsNode])

      when(mockWiringContext.findReferenceNodes)
        .calledWith('params')
        .mockReturnValue([paramsRef1, paramsRef2, paramsRef3])

      // Act
      wiring.wire()

      // Assert - all three references should be wired
      expect(mockGraph.addEdge).toHaveBeenCalledTimes(3)
      expect(mockGraph.addEdge).toHaveBeenCalledWith(paramsNode.id, paramsRef1.id, DependencyEdgeType.DATA_FLOW, {
        referenceType: 'params',
        paramName: 'journey_id',
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(paramsNode.id, paramsRef2.id, DependencyEdgeType.DATA_FLOW, {
        referenceType: 'params',
        paramName: 'journey_id',
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(paramsNode.id, paramsRef3.id, DependencyEdgeType.DATA_FLOW, {
        referenceType: 'params',
        paramName: 'journey_id',
      })
    })

    describe('edge cases', () => {
      it('should handle no params pseudo nodes', () => {
        // Arrange
        when(mockWiringContext.nodeRegistry.findByType)
          .calledWith(PseudoNodeType.PARAMS)
          .mockReturnValue([])

        // Act
        wiring.wire()

        // Assert - no edges created
        expect(mockGraph.addEdge).not.toHaveBeenCalled()
      })

      it('should not wire reference when reference path is too short', () => {
        // Arrange
        const paramsNode = ASTTestFactory.paramsPseudoNode('param')
        const invalidRef = ASTTestFactory.reference(['params']) // Missing param name

        when(mockWiringContext.nodeRegistry.findByType)
          .calledWith(PseudoNodeType.PARAMS)
          .mockReturnValue([paramsNode])

        when(mockWiringContext.findReferenceNodes)
          .calledWith('params')
          .mockReturnValue([invalidRef])

        // Act
        wiring.wire()

        // Assert - no edge to invalid reference
        expect(mockGraph.addEdge).not.toHaveBeenCalled()
      })

      it('should not wire reference when param name does not match', () => {
        // Arrange
        const paramsNode = ASTTestFactory.paramsPseudoNode('journey_id')
        const differentParamRef = ASTTestFactory.reference(['params', 'step_id'])

        when(mockWiringContext.nodeRegistry.findByType)
          .calledWith(PseudoNodeType.PARAMS)
          .mockReturnValue([paramsNode])

        when(mockWiringContext.findReferenceNodes)
          .calledWith('params')
          .mockReturnValue([differentParamRef])

        // Act
        wiring.wire()

        // Assert - no edge to non-matching reference
        expect(mockGraph.addEdge).not.toHaveBeenCalled()
      })

      it('should handle params node with no consumers', () => {
        // Arrange
        const paramsNode = ASTTestFactory.paramsPseudoNode('unused_param')

        when(mockWiringContext.nodeRegistry.findByType)
          .calledWith(PseudoNodeType.PARAMS)
          .mockReturnValue([paramsNode])

        when(mockWiringContext.findReferenceNodes)
          .calledWith('params')
          .mockReturnValue([])

        // Act
        wiring.wire()

        // Assert - no edges created, but no error thrown
        expect(mockGraph.addEdge).not.toHaveBeenCalled()
      })

      it('should only wire matching param names', () => {
        // Arrange
        const paramsNode1 = ASTTestFactory.paramsPseudoNode('journey_id')
        const paramsNode2 = ASTTestFactory.paramsPseudoNode('step_id')

        const paramsRef1 = ASTTestFactory.reference(['params', 'journey_id'])
        const paramsRef2 = ASTTestFactory.reference(['params', 'user_id']) // No matching node

        when(mockWiringContext.nodeRegistry.findByType)
          .calledWith(PseudoNodeType.PARAMS)
          .mockReturnValue([paramsNode1, paramsNode2])

        when(mockWiringContext.findReferenceNodes)
          .calledWith('params')
          .mockReturnValue([paramsRef1, paramsRef2])

        // Act
        wiring.wire()

        // Assert - only journey_id should be wired
        expect(mockGraph.addEdge).toHaveBeenCalledTimes(1)
        expect(mockGraph.addEdge).toHaveBeenCalledWith(paramsNode1.id, paramsRef1.id, DependencyEdgeType.DATA_FLOW, {
          referenceType: 'params',
          paramName: 'journey_id',
        })

        // Assert - user_id should not be wired
        expect(mockGraph.addEdge).not.toHaveBeenCalledWith(
          expect.anything(),
          paramsRef2.id,
          expect.anything(),
          expect.anything(),
        )
      })
    })
  })
})
