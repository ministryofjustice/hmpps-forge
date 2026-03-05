import { when } from 'jest-when'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { StepASTNode } from '@form-engine/core/types/structures.type'
import { WiringContext } from '@form-engine/core/compilation/dependency-graph/WiringContext'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/compilation/dependency-graph/DependencyGraph'
import { PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import SessionWiring from './SessionWiring'

describe('SessionWiring', () => {
  let mockWiringContext: jest.Mocked<WiringContext>
  let mockGraph: jest.Mocked<DependencyGraph>
  let wiring: SessionWiring

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
    wiring = new SessionWiring(mockWiringContext)
  })

  it('should wire session pseudo nodes to matching session references', () => {
    // Arrange
    const sessionNode = ASTTestFactory.sessionPseudoNode('user')
    const sessionRef = ASTTestFactory.reference(['session', 'user', 'name'])

    when(mockWiringContext.nodeRegistry.findByType)
      .calledWith(PseudoNodeType.SESSION)
      .mockReturnValue([sessionNode])

    when(mockWiringContext.findReferenceNodes)
      .calledWith('session')
      .mockReturnValue([sessionRef])

    // Act
    wiring.wire()

    // Assert
    expect(mockGraph.addEdge).toHaveBeenCalledWith(sessionNode.id, sessionRef.id, DependencyEdgeType.DATA_FLOW, {
      referenceType: 'session',
      baseSessionKey: 'user',
    })
  })

  it('should wire multiple references to the same session pseudo node', () => {
    // Arrange
    const sessionNode = ASTTestFactory.sessionPseudoNode('user')
    const sessionRef1 = ASTTestFactory.reference(['session', 'user', 'name'])
    const sessionRef2 = ASTTestFactory.reference(['session', 'user', 'role'])

    when(mockWiringContext.nodeRegistry.findByType)
      .calledWith(PseudoNodeType.SESSION)
      .mockReturnValue([sessionNode])

    when(mockWiringContext.findReferenceNodes)
      .calledWith('session')
      .mockReturnValue([sessionRef1, sessionRef2])

    // Act
    wiring.wire()

    // Assert
    expect(mockGraph.addEdge).toHaveBeenCalledTimes(2)
  })

  it('should not wire non-matching session references', () => {
    // Arrange
    const sessionNode = ASTTestFactory.sessionPseudoNode('user')
    const sessionRef = ASTTestFactory.reference(['session', 'account', 'name'])

    when(mockWiringContext.nodeRegistry.findByType)
      .calledWith(PseudoNodeType.SESSION)
      .mockReturnValue([sessionNode])

    when(mockWiringContext.findReferenceNodes)
      .calledWith('session')
      .mockReturnValue([sessionRef])

    // Act
    wiring.wire()

    // Assert
    expect(mockGraph.addEdge).not.toHaveBeenCalled()
  })
})
