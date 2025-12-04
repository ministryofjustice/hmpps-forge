import { when } from 'jest-when'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { TransitionType } from '@form-engine/form/types/enums'
import { LoadTransitionASTNode } from '@form-engine/core/types/expressions.type'
import { StepASTNode } from '@form-engine/core/types/structures.type'
import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import { PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import DataPseudoNodeWiring from './DataPseudoNodeWiring'

describe('DataPseudoNodeWiring', () => {
  let mockWiringContext: jest.Mocked<WiringContext>
  let mockGraph: jest.Mocked<DependencyGraph>
  let wiring: DataPseudoNodeWiring

  function createMockWiringContext(stepNode: StepASTNode): jest.Mocked<WiringContext> {
    return {
      findPseudoNodesByType: jest.fn().mockReturnValue([]),
      findReferenceNodes: jest.fn().mockReturnValue([]),
      findLastOnLoadTransitionFrom: jest.fn().mockReturnValue(undefined),
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
    wiring = new DataPseudoNodeWiring(mockWiringContext)
  })

  describe('wire', () => {
    it('should wire onLoad transition to data pseudo node', () => {
      // Arrange
      const onLoadTrans = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode

      const step = ASTTestFactory.step()
        .withProperty('onLoad', [onLoadTrans])
        .build()

      const dataNode = ASTTestFactory.dataPseudoNode('externalField')

      mockWiringContext = createMockWiringContext(step)
      wiring = new DataPseudoNodeWiring(mockWiringContext)

      when(mockWiringContext.findPseudoNodesByType)
        .calledWith(PseudoNodeType.DATA)
        .mockReturnValue([dataNode])

      when(mockWiringContext.findReferenceNodes)
        .calledWith('data')
        .mockReturnValue([])

      when(mockWiringContext.findLastOnLoadTransitionFrom)
        .calledWith(step.id)
        .mockReturnValue(onLoadTrans)

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(onLoadTrans.id, dataNode.id, DependencyEdgeType.DATA_FLOW, {
        fieldCode: 'externalField',
      })
    })

    it('should wire onLoad transition from parent journey when step has no onLoad', () => {
      // Arrange
      const onLoadTrans = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode
      const step = ASTTestFactory.step().build()
      const dataNode = ASTTestFactory.dataPseudoNode('externalField')

      mockWiringContext = createMockWiringContext(step)
      wiring = new DataPseudoNodeWiring(mockWiringContext)

      when(mockWiringContext.findPseudoNodesByType)
        .calledWith(PseudoNodeType.DATA)
        .mockReturnValue([dataNode])

      when(mockWiringContext.findReferenceNodes)
        .calledWith('data')
        .mockReturnValue([])

      when(mockWiringContext.findLastOnLoadTransitionFrom)
        .calledWith(step.id)
        .mockReturnValue(onLoadTrans)

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(onLoadTrans.id, dataNode.id, DependencyEdgeType.DATA_FLOW, {
        fieldCode: 'externalField',
      })
    })

    it('should wire data pseudo node to Data() reference consumers', () => {
      // Arrange
      const dataNode = ASTTestFactory.dataPseudoNode('externalField')
      const dataRef = ASTTestFactory.reference(['data', 'externalField'])

      when(mockWiringContext.findPseudoNodesByType)
        .calledWith(PseudoNodeType.DATA)
        .mockReturnValue([dataNode])

      when(mockWiringContext.findReferenceNodes)
        .calledWith('data')
        .mockReturnValue([dataRef])

      when(mockWiringContext.findLastOnLoadTransitionFrom)
        .calledWith(expect.anything())
        .mockReturnValue(undefined)

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(dataNode.id, dataRef.id, DependencyEdgeType.DATA_FLOW, {
        referenceType: 'data',
        fieldCode: 'externalField',
      })
    })

    it('should handle dotted field codes in references', () => {
      // Arrange
      const dataNode = ASTTestFactory.dataPseudoNode('user')
      const dataRef = ASTTestFactory.reference(['data', 'user.name'])

      when(mockWiringContext.findPseudoNodesByType)
        .calledWith(PseudoNodeType.DATA)
        .mockReturnValue([dataNode])

      when(mockWiringContext.findReferenceNodes)
        .calledWith('data')
        .mockReturnValue([dataRef])

      when(mockWiringContext.findLastOnLoadTransitionFrom)
        .calledWith(expect.anything())
        .mockReturnValue(undefined)

      // Act
      wiring.wire()

      // Assert - should match base code 'user' from 'user.name'
      expect(mockGraph.addEdge).toHaveBeenCalledWith(dataNode.id, dataRef.id, DependencyEdgeType.DATA_FLOW, {
        referenceType: 'data',
        fieldCode: 'user',
      })
    })

    describe('edge cases', () => {
      it('should not wire reference when reference path is too short', () => {
        // Arrange
        const dataNode = ASTTestFactory.dataPseudoNode('field')
        const invalidRef = ASTTestFactory.reference(['data']) // Missing field name

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.DATA)
          .mockReturnValue([dataNode])

        when(mockWiringContext.findReferenceNodes)
          .calledWith('data')
          .mockReturnValue([invalidRef])

        when(mockWiringContext.findLastOnLoadTransitionFrom)
          .calledWith(expect.anything())
          .mockReturnValue(undefined)

        // Act
        wiring.wire()

        // Assert - no edge to invalid reference
        expect(mockGraph.addEdge).not.toHaveBeenCalled()
      })

      it('should not wire reference when field code does not match', () => {
        // Arrange
        const dataNode = ASTTestFactory.dataPseudoNode('user')
        const differentFieldRef = ASTTestFactory.reference(['data', 'settings'])

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.DATA)
          .mockReturnValue([dataNode])

        when(mockWiringContext.findReferenceNodes)
          .calledWith('data')
          .mockReturnValue([differentFieldRef])

        when(mockWiringContext.findLastOnLoadTransitionFrom)
          .calledWith(expect.anything())
          .mockReturnValue(undefined)

        // Act
        wiring.wire()

        // Assert - no edge to non-matching reference
        expect(mockGraph.addEdge).not.toHaveBeenCalled()
      })

      it('should use last transition when multiple onLoad transitions exist', () => {
        // Arrange
        const onLoadTrans3 = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode
        const step = ASTTestFactory.step().build()
        const dataNode = ASTTestFactory.dataPseudoNode('externalField')

        mockWiringContext = createMockWiringContext(step)
        wiring = new DataPseudoNodeWiring(mockWiringContext)

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.DATA)
          .mockReturnValue([dataNode])

        when(mockWiringContext.findReferenceNodes)
          .calledWith('data')
          .mockReturnValue([])

        when(mockWiringContext.findLastOnLoadTransitionFrom)
          .calledWith(step.id)
          .mockReturnValue(onLoadTrans3)

        // Act
        wiring.wire()

        // Assert - should use the last transition
        expect(mockGraph.addEdge).toHaveBeenCalledWith(onLoadTrans3.id, dataNode.id, DependencyEdgeType.DATA_FLOW, {
          fieldCode: 'externalField',
        })
      })

      it('should prefer step onLoad over parent journey onLoad when both exist', () => {
        // Arrange
        const stepOnLoad = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode
        const step = ASTTestFactory.step().build()
        const dataNode = ASTTestFactory.dataPseudoNode('externalField')

        mockWiringContext = createMockWiringContext(step)
        wiring = new DataPseudoNodeWiring(mockWiringContext)

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.DATA)
          .mockReturnValue([dataNode])

        when(mockWiringContext.findReferenceNodes)
          .calledWith('data')
          .mockReturnValue([])

        when(mockWiringContext.findLastOnLoadTransitionFrom)
          .calledWith(step.id)
          .mockReturnValue(stepOnLoad)

        // Act
        wiring.wire()

        // Assert - should use step transition
        expect(mockGraph.addEdge).toHaveBeenCalledWith(stepOnLoad.id, dataNode.id, DependencyEdgeType.DATA_FLOW, {
          fieldCode: 'externalField',
        })
      })

      it('should find onLoad from grandparent journey when step and parent have no onLoad', () => {
        // Arrange
        const grandparentOnLoad = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode
        const step = ASTTestFactory.step().build()
        const dataNode = ASTTestFactory.dataPseudoNode('externalField')

        mockWiringContext = createMockWiringContext(step)
        wiring = new DataPseudoNodeWiring(mockWiringContext)

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.DATA)
          .mockReturnValue([dataNode])

        when(mockWiringContext.findReferenceNodes)
          .calledWith('data')
          .mockReturnValue([])

        when(mockWiringContext.findLastOnLoadTransitionFrom)
          .calledWith(step.id)
          .mockReturnValue(grandparentOnLoad)

        // Act
        wiring.wire()

        // Assert - should find and use grandparent's transition
        expect(mockGraph.addEdge).toHaveBeenCalledWith(
          grandparentOnLoad.id,
          dataNode.id,
          DependencyEdgeType.DATA_FLOW,
          {
            fieldCode: 'externalField',
          },
        )
      })

      it('should traverse to parent when step has empty onLoad array', () => {
        // Arrange
        const parentOnLoad = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode
        const step = ASTTestFactory.step().build()
        const dataNode = ASTTestFactory.dataPseudoNode('externalField')

        mockWiringContext = createMockWiringContext(step)
        wiring = new DataPseudoNodeWiring(mockWiringContext)

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.DATA)
          .mockReturnValue([dataNode])

        when(mockWiringContext.findReferenceNodes)
          .calledWith('data')
          .mockReturnValue([])

        when(mockWiringContext.findLastOnLoadTransitionFrom)
          .calledWith(step.id)
          .mockReturnValue(parentOnLoad)

        // Act
        wiring.wire()

        // Assert - should use parent transition (skipping empty step array)
        expect(mockGraph.addEdge).toHaveBeenCalledWith(parentOnLoad.id, dataNode.id, DependencyEdgeType.DATA_FLOW, {
          fieldCode: 'externalField',
        })
      })
    })
  })
})
