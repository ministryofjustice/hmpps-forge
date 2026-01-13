import { when } from 'jest-when'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { BlockType, ExpressionType } from '@form-engine/form/types/enums'
import { WiringContext } from '@form-engine/core/compilation/dependency-graph/WiringContext'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/compilation/dependency-graph/DependencyGraph'
import NodeRegistry from '@form-engine/core/compilation/registries/NodeRegistry'
import MetadataRegistry from '@form-engine/core/compilation/registries/MetadataRegistry'
import { NodeId } from '@form-engine/core/types/engine.type'
import StructuralWiring from './StructuralWiring'

describe('StructuralWiring', () => {
  let mockWiringContext: jest.Mocked<WiringContext>
  let mockGraph: jest.Mocked<Pick<DependencyGraph, 'addNode' | 'addEdge'>>
  let mockNodeRegistry: jest.Mocked<Pick<NodeRegistry, 'get' | 'getAll'>>
  let mockMetadataRegistry: jest.Mocked<MetadataRegistry>
  let wiring: StructuralWiring

  function createMockWiringContext(): jest.Mocked<WiringContext> {
    return {
      getParentNodeId: jest.fn().mockReturnValue(undefined),
      nodeRegistry: mockNodeRegistry,
      metadataRegistry: mockMetadataRegistry,
      graph: mockGraph,
    } as unknown as jest.Mocked<WiringContext>
  }

  beforeEach(() => {
    ASTTestFactory.resetIds()

    mockGraph = {
      addNode: jest.fn(),
      addEdge: jest.fn(),
    }

    mockNodeRegistry = {
      get: jest.fn(),
      getAll: jest.fn().mockReturnValue(new Map()),
    }

    mockMetadataRegistry = {} as jest.Mocked<MetadataRegistry>

    mockWiringContext = createMockWiringContext()
    wiring = new StructuralWiring(mockWiringContext)
  })

  describe('wire', () => {
    describe('structural child-parent relationships', () => {
      it('should wire complete hierarchy: block → step → journey', () => {
        // Arrange
        const journey = ASTTestFactory.journey().build()
        const step = ASTTestFactory.step().build()
        const block = ASTTestFactory.block('TextInput', BlockType.FIELD).build()

        const nodesMap = new Map()
        nodesMap.set(journey.id, journey)
        nodesMap.set(step.id, step)
        nodesMap.set(block.id, block)

        when(mockNodeRegistry.getAll).calledWith().mockReturnValue(nodesMap)

        when(mockWiringContext.getParentNodeId).calledWith(journey.id).mockReturnValue(undefined)
        when(mockWiringContext.getParentNodeId).calledWith(step.id).mockReturnValue(journey.id)
        when(mockWiringContext.getParentNodeId).calledWith(block.id).mockReturnValue(step.id)

        when(mockNodeRegistry.get).calledWith(journey.id).mockReturnValue(journey)
        when(mockNodeRegistry.get).calledWith(step.id).mockReturnValue(step)

        // Act
        wiring.wire()

        // Assert - child → parent direction
        expect(mockGraph.addEdge).toHaveBeenCalledWith(step.id, journey.id, DependencyEdgeType.STRUCTURAL, {
          type: 'child-parent',
        })
        expect(mockGraph.addEdge).toHaveBeenCalledWith(block.id, step.id, DependencyEdgeType.STRUCTURAL, {
          type: 'child-parent',
        })
        expect(mockGraph.addEdge).toHaveBeenCalledTimes(2)
      })

      it('should wire deeply nested journeys with multiple children at each level', () => {
        // Arrange
        const rootJourney = ASTTestFactory.journey().build()
        const childJourney1 = ASTTestFactory.journey().build()
        const childJourney2 = ASTTestFactory.journey().build()
        const grandchildJourney = ASTTestFactory.journey().build()
        const step1 = ASTTestFactory.step().build()
        const step2 = ASTTestFactory.step().build()
        const block = ASTTestFactory.block('TextInput', BlockType.FIELD).build()

        const nodesMap = new Map()
        nodesMap.set(rootJourney.id, rootJourney)
        nodesMap.set(childJourney1.id, childJourney1)
        nodesMap.set(childJourney2.id, childJourney2)
        nodesMap.set(grandchildJourney.id, grandchildJourney)
        nodesMap.set(step1.id, step1)
        nodesMap.set(step2.id, step2)
        nodesMap.set(block.id, block)

        when(mockNodeRegistry.getAll).calledWith().mockReturnValue(nodesMap)

        // Root journey has no parent
        when(mockWiringContext.getParentNodeId).calledWith(rootJourney.id).mockReturnValue(undefined)

        // Child journeys have root as parent
        when(mockWiringContext.getParentNodeId).calledWith(childJourney1.id).mockReturnValue(rootJourney.id)
        when(mockWiringContext.getParentNodeId).calledWith(childJourney2.id).mockReturnValue(rootJourney.id)

        // Grandchild journey has childJourney1 as parent
        when(mockWiringContext.getParentNodeId).calledWith(grandchildJourney.id).mockReturnValue(childJourney1.id)

        // Steps have grandchild journey as parent
        when(mockWiringContext.getParentNodeId).calledWith(step1.id).mockReturnValue(grandchildJourney.id)
        when(mockWiringContext.getParentNodeId).calledWith(step2.id).mockReturnValue(grandchildJourney.id)

        // Block has step1 as parent
        when(mockWiringContext.getParentNodeId).calledWith(block.id).mockReturnValue(step1.id)

        // Mock get() for all structural nodes
        when(mockNodeRegistry.get).calledWith(rootJourney.id).mockReturnValue(rootJourney)
        when(mockNodeRegistry.get).calledWith(childJourney1.id).mockReturnValue(childJourney1)
        when(mockNodeRegistry.get).calledWith(childJourney2.id).mockReturnValue(childJourney2)
        when(mockNodeRegistry.get).calledWith(grandchildJourney.id).mockReturnValue(grandchildJourney)
        when(mockNodeRegistry.get).calledWith(step1.id).mockReturnValue(step1)

        // Act
        wiring.wire()

        // Assert - Verify all child-parent edges created (child → parent)
        expect(mockGraph.addEdge).toHaveBeenCalledWith(
          childJourney1.id,
          rootJourney.id,
          DependencyEdgeType.STRUCTURAL,
          { type: 'child-parent' },
        )
        expect(mockGraph.addEdge).toHaveBeenCalledWith(
          childJourney2.id,
          rootJourney.id,
          DependencyEdgeType.STRUCTURAL,
          { type: 'child-parent' },
        )
        expect(mockGraph.addEdge).toHaveBeenCalledWith(
          grandchildJourney.id,
          childJourney1.id,
          DependencyEdgeType.STRUCTURAL,
          { type: 'child-parent' },
        )
        expect(mockGraph.addEdge).toHaveBeenCalledWith(step1.id, grandchildJourney.id, DependencyEdgeType.STRUCTURAL, {
          type: 'child-parent',
        })
        expect(mockGraph.addEdge).toHaveBeenCalledWith(step2.id, grandchildJourney.id, DependencyEdgeType.STRUCTURAL, {
          type: 'child-parent',
        })
        expect(mockGraph.addEdge).toHaveBeenCalledWith(block.id, step1.id, DependencyEdgeType.STRUCTURAL, {
          type: 'child-parent',
        })
        expect(mockGraph.addEdge).toHaveBeenCalledTimes(6)
      })
    })

    describe('edge cases', () => {
      it('should not wire if parent node is not found in registry', () => {
        // Arrange
        const step = ASTTestFactory.step().build()
        const missingParentId = 'missing-parent-id' as NodeId

        const nodesMap = new Map()
        nodesMap.set(step.id, step)

        when(mockNodeRegistry.getAll).calledWith().mockReturnValue(nodesMap)

        when(mockWiringContext.getParentNodeId).calledWith(step.id).mockReturnValue(missingParentId)

        when(mockNodeRegistry.get).calledWith(missingParentId).mockReturnValue(undefined)

        // Act
        wiring.wire()

        // Assert
        expect(mockGraph.addEdge).not.toHaveBeenCalled()
      })

      it('should only wire structural parent-child relationships, not expression nodes', () => {
        // Arrange
        const expression = ASTTestFactory.expression(ExpressionType.REFERENCE).build()
        const childExpression = ASTTestFactory.expression(ExpressionType.REFERENCE).build()

        const nodesMap = new Map()
        nodesMap.set(expression.id, expression)
        nodesMap.set(childExpression.id, childExpression)

        when(mockNodeRegistry.getAll).calledWith().mockReturnValue(nodesMap)

        when(mockWiringContext.getParentNodeId).calledWith(expression.id).mockReturnValue(undefined)
        when(mockWiringContext.getParentNodeId).calledWith(childExpression.id).mockReturnValue(expression.id)

        when(mockNodeRegistry.get).calledWith(expression.id).mockReturnValue(expression)

        // Act
        wiring.wire()

        // Assert
        expect(mockGraph.addEdge).not.toHaveBeenCalled()
      })
    })
  })
})
