import getAncestorChain from './getAncestorChain'
import ASTNodeTree from './ASTNodeTree'
import { NodeId } from '../../contracts/ast/engine.type'

describe('getAncestorChain()', () => {
  let astNodeTree: ASTNodeTree

  beforeEach(() => {
    astNodeTree = new ASTNodeTree()
  })

  it('should return array with just the starting node when it has no parent', () => {
    // Arrange
    const nodeId: NodeId = 'compile_ast:1'
    astNodeTree.addNode(nodeId)

    // Act
    const result = getAncestorChain(nodeId, astNodeTree)

    // Assert
    expect(result).toEqual([nodeId])
  })

  it('should return ancestors in outermost-first order', () => {
    // Arrange
    // Structure: Journey -> Step -> Block
    const journeyNodeId: NodeId = 'compile_ast:1'
    const stepNodeId: NodeId = 'compile_ast:2'
    const blockId: NodeId = 'compile_ast:3'

    astNodeTree.addNode(journeyNodeId)
    astNodeTree.addNode(stepNodeId, journeyNodeId)
    astNodeTree.addNode(blockId, stepNodeId)

    // Act
    const result = getAncestorChain(blockId, astNodeTree)

    // Assert
    expect(result).toEqual([journeyNodeId, stepNodeId, blockId])
  })

  it('should handle a two-level chain', () => {
    // Arrange
    const parentId: NodeId = 'compile_ast:10'
    const childId: NodeId = 'compile_ast:11'

    astNodeTree.addNode(parentId)
    astNodeTree.addNode(childId, parentId)

    // Act
    const result = getAncestorChain(childId, astNodeTree)

    // Assert
    expect(result).toEqual([parentId, childId])
  })

  it('should handle a deep chain with multiple levels', () => {
    // Arrange
    // Structure: A -> B -> C -> D -> E
    const nodeA: NodeId = 'compile_ast:20'
    const nodeB: NodeId = 'compile_ast:21'
    const nodeC: NodeId = 'compile_ast:22'
    const nodeD: NodeId = 'compile_ast:23'
    const nodeE: NodeId = 'compile_ast:24'

    astNodeTree.addNode(nodeA)
    astNodeTree.addNode(nodeB, nodeA)
    astNodeTree.addNode(nodeC, nodeB)
    astNodeTree.addNode(nodeD, nodeC)
    astNodeTree.addNode(nodeE, nodeD)

    // Act
    const result = getAncestorChain(nodeE, astNodeTree)

    // Assert
    expect(result).toEqual([nodeA, nodeB, nodeC, nodeD, nodeE])
  })

  it('should return starting node when called from root', () => {
    // Arrange
    // Journey is the root, has no parent
    const journeyNodeId: NodeId = 'compile_ast:30'
    const stepNodeId: NodeId = 'compile_ast:31'

    astNodeTree.addNode(journeyNodeId)
    astNodeTree.addNode(stepNodeId, journeyNodeId)

    // Act
    const result = getAncestorChain(journeyNodeId, astNodeTree)

    // Assert
    expect(result).toEqual([journeyNodeId])
  })

  it('should handle nested journeys', () => {
    // Arrange
    const outerJourneyNodeId: NodeId = 'compile_ast:40'
    const innerJourneyNodeId: NodeId = 'compile_ast:41'
    const stepNodeId: NodeId = 'compile_ast:42'

    astNodeTree.addNode(outerJourneyNodeId)
    astNodeTree.addNode(innerJourneyNodeId, outerJourneyNodeId)
    astNodeTree.addNode(stepNodeId, innerJourneyNodeId)

    // Act
    const result = getAncestorChain(stepNodeId, astNodeTree)

    // Assert
    expect(result).toEqual([outerJourneyNodeId, innerJourneyNodeId, stepNodeId])
  })
})
