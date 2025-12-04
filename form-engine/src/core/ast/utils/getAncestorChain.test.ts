import getAncestorChain from '@form-engine/core/ast/utils/getAncestorChain'
import MetadataRegistry from '@form-engine/core/ast/registration/MetadataRegistry'
import { NodeId } from '@form-engine/core/types/engine.type'

describe('getAncestorChain()', () => {
  let metadataRegistry: MetadataRegistry

  beforeEach(() => {
    metadataRegistry = new MetadataRegistry()
  })

  it('should return array with just the starting node when it has no parent', () => {
    // Arrange
    const nodeId: NodeId = 'compile_ast:1'

    // Act
    const result = getAncestorChain(nodeId, metadataRegistry)

    // Assert
    expect(result).toEqual([nodeId])
  })

  it('should return ancestors in outermost-first order', () => {
    // Arrange
    // Structure: Journey -> Step -> Block
    const journeyId: NodeId = 'compile_ast:1'
    const stepId: NodeId = 'compile_ast:2'
    const blockId: NodeId = 'compile_ast:3'

    metadataRegistry.set(stepId, 'attachedToParentNode', journeyId)
    metadataRegistry.set(blockId, 'attachedToParentNode', stepId)

    // Act
    const result = getAncestorChain(blockId, metadataRegistry)

    // Assert
    expect(result).toEqual([journeyId, stepId, blockId])
  })

  it('should handle a two-level chain', () => {
    // Arrange
    const parentId: NodeId = 'compile_ast:10'
    const childId: NodeId = 'compile_ast:11'

    metadataRegistry.set(childId, 'attachedToParentNode', parentId)

    // Act
    const result = getAncestorChain(childId, metadataRegistry)

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

    metadataRegistry.set(nodeB, 'attachedToParentNode', nodeA)
    metadataRegistry.set(nodeC, 'attachedToParentNode', nodeB)
    metadataRegistry.set(nodeD, 'attachedToParentNode', nodeC)
    metadataRegistry.set(nodeE, 'attachedToParentNode', nodeD)

    // Act
    const result = getAncestorChain(nodeE, metadataRegistry)

    // Assert
    expect(result).toEqual([nodeA, nodeB, nodeC, nodeD, nodeE])
  })

  it('should return starting node when called from root', () => {
    // Arrange
    // Journey is the root, has no parent
    const journeyId: NodeId = 'compile_ast:30'
    const stepId: NodeId = 'compile_ast:31'

    metadataRegistry.set(stepId, 'attachedToParentNode', journeyId)

    // Act
    const result = getAncestorChain(journeyId, metadataRegistry)

    // Assert
    expect(result).toEqual([journeyId])
  })

  it('should handle nested journeys', () => {
    // Arrange
    const outerJourneyId: NodeId = 'compile_ast:40'
    const innerJourneyId: NodeId = 'compile_ast:41'
    const stepId: NodeId = 'compile_ast:42'

    metadataRegistry.set(innerJourneyId, 'attachedToParentNode', outerJourneyId)
    metadataRegistry.set(stepId, 'attachedToParentNode', innerJourneyId)

    // Act
    const result = getAncestorChain(stepId, metadataRegistry)

    // Assert
    expect(result).toEqual([outerJourneyId, innerJourneyId, stepId])
  })
})
