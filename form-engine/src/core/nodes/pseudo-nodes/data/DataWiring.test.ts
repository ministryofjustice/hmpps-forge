import { when } from 'jest-when'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { TransitionType } from '@form-engine/form/types/enums'
import { AccessTransitionASTNode } from '@form-engine/core/types/expressions.type'
import { StepASTNode } from '@form-engine/core/types/structures.type'
import { WiringContext } from '@form-engine/core/compilation/dependency-graph/WiringContext'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/compilation/dependency-graph/DependencyGraph'
import { PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import DataWiring from './DataWiring'

describe('DataWiring', () => {
  let mockWiringContext: jest.Mocked<WiringContext>
  let mockGraph: jest.Mocked<DependencyGraph>
  let wiring: DataWiring

  function createMockWiringContext(stepNode: StepASTNode): jest.Mocked<WiringContext> {
    return {
      nodeRegistry: {
        findByType: jest.fn().mockReturnValue([]),
        get: jest.fn().mockReturnValue(undefined),
      },
      findReferenceNodes: jest.fn().mockReturnValue([]),
      findLastOnAccessTransitionFrom: jest.fn().mockReturnValue(undefined),
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
    wiring = new DataWiring(mockWiringContext)
  })

  describe('wire', () => {
    it('should wire onAccess transition to data pseudo node', () => {
      // Arrange
      const onAccessTrans = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode

      const step = ASTTestFactory.step()
        .withProperty('onAccess', [onAccessTrans])
        .build()

      const dataNode = ASTTestFactory.dataPseudoNode('externalField')

      mockWiringContext = createMockWiringContext(step)
      wiring = new DataWiring(mockWiringContext)

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(PseudoNodeType.DATA)
        .mockReturnValue([dataNode])

      when(mockWiringContext.findReferenceNodes)
        .calledWith('data')
        .mockReturnValue([])

      when(mockWiringContext.findLastOnAccessTransitionFrom)
        .calledWith(step.id)
        .mockReturnValue(onAccessTrans)

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(onAccessTrans.id, dataNode.id, DependencyEdgeType.DATA_FLOW, {
        baseProperty: 'externalField',
      })
    })

    it('should wire onAccess transition from parent journey when step has no onAccess', () => {
      // Arrange
      const onAccessTrans = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode
      const step = ASTTestFactory.step().build()
      const dataNode = ASTTestFactory.dataPseudoNode('externalField')

      mockWiringContext = createMockWiringContext(step)
      wiring = new DataWiring(mockWiringContext)

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(PseudoNodeType.DATA)
        .mockReturnValue([dataNode])

      when(mockWiringContext.findReferenceNodes)
        .calledWith('data')
        .mockReturnValue([])

      when(mockWiringContext.findLastOnAccessTransitionFrom)
        .calledWith(step.id)
        .mockReturnValue(onAccessTrans)

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(onAccessTrans.id, dataNode.id, DependencyEdgeType.DATA_FLOW, {
        baseProperty: 'externalField',
      })
    })

    it('should wire data pseudo node to Data() reference consumers', () => {
      // Arrange
      const dataNode = ASTTestFactory.dataPseudoNode('externalField')
      const dataRef = ASTTestFactory.reference(['data', 'externalField'])

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(PseudoNodeType.DATA)
        .mockReturnValue([dataNode])

      when(mockWiringContext.findReferenceNodes)
        .calledWith('data')
        .mockReturnValue([dataRef])

      when(mockWiringContext.findLastOnAccessTransitionFrom)
        .calledWith(expect.anything())
        .mockReturnValue(undefined)

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(dataNode.id, dataRef.id, DependencyEdgeType.DATA_FLOW, {
        referenceType: 'data',
        baseProperty: 'externalField',
      })
    })

    it('should wire nested path to pseudo node', () => {
      // Arrange
      const dataNode = ASTTestFactory.dataPseudoNode('user')
      const dataRef = ASTTestFactory.reference(['data', 'user', 'name'])

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(PseudoNodeType.DATA)
        .mockReturnValue([dataNode])

      when(mockWiringContext.findReferenceNodes)
        .calledWith('data')
        .mockReturnValue([dataRef])

      when(mockWiringContext.findLastOnAccessTransitionFrom)
        .calledWith(expect.anything())
        .mockReturnValue(undefined)

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(dataNode.id, dataRef.id, DependencyEdgeType.DATA_FLOW, {
        referenceType: 'data',
        baseProperty: 'user',
      })
    })

    describe('edge cases', () => {
      it('should not wire reference when reference path is too short', () => {
        // Arrange
        const dataNode = ASTTestFactory.dataPseudoNode('field')
        const invalidRef = ASTTestFactory.reference(['data']) // Missing field name

        when(mockWiringContext.nodeRegistry.findByType)
          .calledWith(PseudoNodeType.DATA)
          .mockReturnValue([dataNode])

        when(mockWiringContext.findReferenceNodes)
          .calledWith('data')
          .mockReturnValue([invalidRef])

        when(mockWiringContext.findLastOnAccessTransitionFrom)
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

        when(mockWiringContext.nodeRegistry.findByType)
          .calledWith(PseudoNodeType.DATA)
          .mockReturnValue([dataNode])

        when(mockWiringContext.findReferenceNodes)
          .calledWith('data')
          .mockReturnValue([differentFieldRef])

        when(mockWiringContext.findLastOnAccessTransitionFrom)
          .calledWith(expect.anything())
          .mockReturnValue(undefined)

        // Act
        wiring.wire()

        // Assert - no edge to non-matching reference
        expect(mockGraph.addEdge).not.toHaveBeenCalled()
      })

      it('should use last transition when multiple onAccess transitions exist', () => {
        // Arrange
        const onAccessTrans3 = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode
        const step = ASTTestFactory.step().build()
        const dataNode = ASTTestFactory.dataPseudoNode('externalField')

        mockWiringContext = createMockWiringContext(step)
        wiring = new DataWiring(mockWiringContext)

        when(mockWiringContext.nodeRegistry.findByType)
          .calledWith(PseudoNodeType.DATA)
          .mockReturnValue([dataNode])

        when(mockWiringContext.findReferenceNodes)
          .calledWith('data')
          .mockReturnValue([])

        when(mockWiringContext.findLastOnAccessTransitionFrom)
          .calledWith(step.id)
          .mockReturnValue(onAccessTrans3)

        // Act
        wiring.wire()

        // Assert - should use the last transition
        expect(mockGraph.addEdge).toHaveBeenCalledWith(onAccessTrans3.id, dataNode.id, DependencyEdgeType.DATA_FLOW, {
          baseProperty: 'externalField',
        })
      })

      it('should prefer step onAccess over parent journey onAccess when both exist', () => {
        // Arrange
        const stepOnAccess = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode
        const step = ASTTestFactory.step().build()
        const dataNode = ASTTestFactory.dataPseudoNode('externalField')

        mockWiringContext = createMockWiringContext(step)
        wiring = new DataWiring(mockWiringContext)

        when(mockWiringContext.nodeRegistry.findByType)
          .calledWith(PseudoNodeType.DATA)
          .mockReturnValue([dataNode])

        when(mockWiringContext.findReferenceNodes)
          .calledWith('data')
          .mockReturnValue([])

        when(mockWiringContext.findLastOnAccessTransitionFrom)
          .calledWith(step.id)
          .mockReturnValue(stepOnAccess)

        // Act
        wiring.wire()

        // Assert - should use step transition
        expect(mockGraph.addEdge).toHaveBeenCalledWith(stepOnAccess.id, dataNode.id, DependencyEdgeType.DATA_FLOW, {
          baseProperty: 'externalField',
        })
      })

      it('should find onAccess from grandparent journey when step and parent have no onAccess', () => {
        // Arrange
        const grandparentOnAccess = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode
        const step = ASTTestFactory.step().build()
        const dataNode = ASTTestFactory.dataPseudoNode('externalField')

        mockWiringContext = createMockWiringContext(step)
        wiring = new DataWiring(mockWiringContext)

        when(mockWiringContext.nodeRegistry.findByType)
          .calledWith(PseudoNodeType.DATA)
          .mockReturnValue([dataNode])

        when(mockWiringContext.findReferenceNodes)
          .calledWith('data')
          .mockReturnValue([])

        when(mockWiringContext.findLastOnAccessTransitionFrom)
          .calledWith(step.id)
          .mockReturnValue(grandparentOnAccess)

        // Act
        wiring.wire()

        // Assert - should find and use grandparent's transition
        expect(mockGraph.addEdge).toHaveBeenCalledWith(
          grandparentOnAccess.id,
          dataNode.id,
          DependencyEdgeType.DATA_FLOW,
          {
            baseProperty: 'externalField',
          },
        )
      })

      it('should traverse to parent when step has empty onAccess array', () => {
        // Arrange
        const parentOnAccess = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode
        const step = ASTTestFactory.step().build()
        const dataNode = ASTTestFactory.dataPseudoNode('externalField')

        mockWiringContext = createMockWiringContext(step)
        wiring = new DataWiring(mockWiringContext)

        when(mockWiringContext.nodeRegistry.findByType)
          .calledWith(PseudoNodeType.DATA)
          .mockReturnValue([dataNode])

        when(mockWiringContext.findReferenceNodes)
          .calledWith('data')
          .mockReturnValue([])

        when(mockWiringContext.findLastOnAccessTransitionFrom)
          .calledWith(step.id)
          .mockReturnValue(parentOnAccess)

        // Act
        wiring.wire()

        // Assert - should use parent transition (skipping empty step array)
        expect(mockGraph.addEdge).toHaveBeenCalledWith(parentOnAccess.id, dataNode.id, DependencyEdgeType.DATA_FLOW, {
          baseProperty: 'externalField',
        })
      })
    })
  })
})
