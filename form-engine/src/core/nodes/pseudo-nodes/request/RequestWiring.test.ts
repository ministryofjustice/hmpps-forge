import { when } from 'jest-when'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { StepASTNode } from '@form-engine/core/types/structures.type'
import { WiringContext } from '@form-engine/core/compilation/dependency-graph/WiringContext'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/compilation/dependency-graph/DependencyGraph'
import { PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import RequestWiring from './RequestWiring'

describe('RequestWiring', () => {
  let mockWiringContext: jest.Mocked<WiringContext>
  let mockGraph: jest.Mocked<DependencyGraph>
  let wiring: RequestWiring

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
    wiring = new RequestWiring(mockWiringContext)
  })

  it('should wire request pseudo nodes to matching request references', () => {
    // Arrange
    const requestNode = ASTTestFactory.requestPseudoNode('headers.x-request-id')
    const requestRef = ASTTestFactory.reference(['request', 'headers', 'x-request-id'])

    when(mockWiringContext.nodeRegistry.findByType)
      .calledWith(PseudoNodeType.REQUEST)
      .mockReturnValue([requestNode])

    when(mockWiringContext.findReferenceNodes)
      .calledWith('request')
      .mockReturnValue([requestRef])

    // Act
    wiring.wire()

    // Assert
    expect(mockGraph.addEdge).toHaveBeenCalledWith(requestNode.id, requestRef.id, DependencyEdgeType.DATA_FLOW, {
      referenceType: 'request',
      requestPath: 'headers.x-request-id',
    })
  })

  it('should wire multiple references to the same request pseudo node', () => {
    // Arrange
    const requestNode = ASTTestFactory.requestPseudoNode('state.user')
    const requestRef1 = ASTTestFactory.reference(['request', 'state', 'user', 'name'])
    const requestRef2 = ASTTestFactory.reference(['request', 'state', 'user', 'role'])

    when(mockWiringContext.nodeRegistry.findByType)
      .calledWith(PseudoNodeType.REQUEST)
      .mockReturnValue([requestNode])

    when(mockWiringContext.findReferenceNodes)
      .calledWith('request')
      .mockReturnValue([requestRef1, requestRef2])

    // Act
    wiring.wire()

    // Assert
    expect(mockGraph.addEdge).toHaveBeenCalledTimes(2)
  })

  it('should not wire non-matching request references', () => {
    // Arrange
    const requestNode = ASTTestFactory.requestPseudoNode('cookies.session')
    const requestRef = ASTTestFactory.reference(['request', 'headers', 'session'])

    when(mockWiringContext.nodeRegistry.findByType)
      .calledWith(PseudoNodeType.REQUEST)
      .mockReturnValue([requestNode])

    when(mockWiringContext.findReferenceNodes)
      .calledWith('request')
      .mockReturnValue([requestRef])

    // Act
    wiring.wire()

    // Assert
    expect(mockGraph.addEdge).not.toHaveBeenCalled()
  })
})
