import { when } from 'jest-when'
import { WiringContext } from '@form-engine/core/compilation/dependency-graph/WiringContext'
import NodeRegistry from '@form-engine/core/compilation/registries/NodeRegistry'
import MetadataRegistry from '@form-engine/core/compilation/registries/MetadataRegistry'
import DependencyGraph from '@form-engine/core/compilation/dependency-graph/DependencyGraph'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { BlockType, ExpressionType, TransitionType } from '@form-engine/form/types/enums'
import { LoadTransitionASTNode } from '@form-engine/core/types/expressions.type'
import { JourneyASTNode } from '@form-engine/core/types/structures.type'

function createMockNodeRegistry(): jest.Mocked<NodeRegistry> {
  return {
    findByType: jest.fn().mockReturnValue([]),
    get: jest.fn().mockReturnValue(undefined),
    getAll: jest.fn().mockReturnValue(new Map()),
  } as unknown as jest.Mocked<NodeRegistry>
}

function createMockMetadataRegistry(): jest.Mocked<MetadataRegistry> {
  return {
    get: jest.fn().mockReturnValue(undefined),
    findNodesWhere: jest.fn().mockReturnValue([]),
  } as unknown as jest.Mocked<MetadataRegistry>
}

describe('WiringContext', () => {
  let mockNodeRegistry: jest.Mocked<NodeRegistry>
  let mockMetadataRegistry: jest.Mocked<MetadataRegistry>
  let mockGraph: jest.Mocked<DependencyGraph>
  let context: WiringContext

  beforeEach(() => {
    ASTTestFactory.resetIds()
    mockNodeRegistry = createMockNodeRegistry()
    mockMetadataRegistry = createMockMetadataRegistry()
    mockGraph = {} as unknown as jest.Mocked<DependencyGraph>
    context = new WiringContext(mockNodeRegistry, mockMetadataRegistry, mockGraph)
  })

  describe('getStepNode()', () => {
    it('should return step marked as isCurrentStep', () => {
      // Arrange
      const step = ASTTestFactory.step().build()

      when(mockMetadataRegistry.findNodesWhere)
        .calledWith('isCurrentStep', true)
        .mockReturnValue([step.id])

      when(mockNodeRegistry.get)
        .calledWith(step.id)
        .mockReturnValue(step)

      // Act
      const result = context.getCurrentStepNode()

      // Assert
      expect(result).toBe(step)
    })

    it('should throw error when no step is marked as isCurrentStep', () => {
      // Arrange
      when(mockMetadataRegistry.findNodesWhere)
        .calledWith('isCurrentStep', true)
        .mockReturnValue([])

      // Act & Assert
      expect(() => context.getCurrentStepNode()).toThrow('No current step found in metadata registry')
    })
  })

  describe('findReferenceNodes', () => {
    it('should find reference nodes matching the specified source', () => {
      const postRef1 = ASTTestFactory.reference(['post', 'firstName'])
      const postRef2 = ASTTestFactory.reference(['post', 'lastName'])
      const queryRef = ASTTestFactory.reference(['query', 'id'])

      when(mockNodeRegistry.findByType)
        .calledWith(ExpressionType.REFERENCE)
        .mockReturnValue([postRef1, postRef2, queryRef])

      const result = context.findReferenceNodes('post')

      expect(result).toHaveLength(2)
      expect(result).toContain(postRef1)
      expect(result).toContain(postRef2)
    })

    it('should return empty array when no references match source', () => {
      const queryRef = ASTTestFactory.reference(['query', 'id'])

      when(mockNodeRegistry.findByType)
        .calledWith(ExpressionType.REFERENCE)
        .mockReturnValue([queryRef])

      const result = context.findReferenceNodes('post')

      expect(result).toEqual([])
    })

    it('should filter out references with invalid path length', () => {
      const validRef = ASTTestFactory.reference(['post', 'firstName'])
      const invalidRef = ASTTestFactory.reference(['post'])

      when(mockNodeRegistry.findByType)
        .calledWith(ExpressionType.REFERENCE)
        .mockReturnValue([validRef, invalidRef])

      const result = context.findReferenceNodes('post')

      expect(result).toHaveLength(1)
      expect(result).toContain(validRef)
    })
  })

  describe('getParentNode', () => {
    it('should return parent node when parent exists', () => {
      const child = ASTTestFactory.step().build()
      const parent = ASTTestFactory.journey().build()

      when(mockMetadataRegistry.get)
        .calledWith(child.id, 'attachedToParentNode')
        .mockReturnValue(parent.id)

      when(mockNodeRegistry.get)
        .calledWith(parent.id)
        .mockReturnValue(parent)

      const result = context.getParentNode<JourneyASTNode>(child.id)

      expect(result).toBe(parent)
    })
  })

  describe('getNodeDepth', () => {
    it('should return 0 for root node', () => {
      const rootId = 'compile_ast:1'

      when(mockMetadataRegistry.get)
        .calledWith(rootId, 'attachedToParentNode')
        .mockReturnValue(undefined)

      const result = context.getNodeDepth(rootId)

      expect(result).toBe(0)
    })

    it('should return correct depth for deeply nested node', () => {
      const level0 = 'compile_ast:1'
      const level1 = 'compile_ast:2'
      const level2 = 'compile_ast:3'
      const level3 = 'compile_ast:4'

      when(mockMetadataRegistry.get)
        .calledWith(level3, 'attachedToParentNode')
        .mockReturnValue(level2)

      when(mockMetadataRegistry.get)
        .calledWith(level2, 'attachedToParentNode')
        .mockReturnValue(level1)

      when(mockMetadataRegistry.get)
        .calledWith(level1, 'attachedToParentNode')
        .mockReturnValue(level0)

      when(mockMetadataRegistry.get)
        .calledWith(level0, 'attachedToParentNode')
        .mockReturnValue(undefined)

      const result = context.getNodeDepth(level3)

      expect(result).toBe(3)
    })
  })

  describe('isAncestorOfStep', () => {
    it('should return true when node is ancestor of step', () => {
      const nodeId = 'compile_ast:1'

      when(mockMetadataRegistry.get)
        .calledWith(nodeId, 'isAncestorOfStep', false)
        .mockReturnValue(true)

      const result = context.isAncestorOfStep(nodeId)

      expect(result).toBe(true)
    })

    it('should return false when node is not ancestor of step', () => {
      const nodeId = 'compile_ast:1'

      when(mockMetadataRegistry.get)
        .calledWith(nodeId, 'isAncestorOfStep', false)
        .mockReturnValue(false)

      const result = context.isAncestorOfStep(nodeId)

      expect(result).toBe(false)
    })
  })

  describe('isDescendantOfStep', () => {
    it('should return true when node is descendant of step', () => {
      const nodeId = 'compile_ast:1'

      when(mockMetadataRegistry.get)
        .calledWith(nodeId, 'isDescendantOfStep', false)
        .mockReturnValue(true)

      const result = context.isDescendantOfStep(nodeId)

      expect(result).toBe(true)
    })

    it('should return false when node is not descendant of step', () => {
      const nodeId = 'compile_ast:1'

      when(mockMetadataRegistry.get)
        .calledWith(nodeId, 'isDescendantOfStep', false)
        .mockReturnValue(false)

      const result = context.isDescendantOfStep(nodeId)

      expect(result).toBe(false)
    })
  })

  describe('findLastOnLoadTransitionFrom', () => {
    it('should return last onLoad transition from step', () => {
      const onLoad1 = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode
      const onLoad2 = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode

      const step = ASTTestFactory.step()
        .withProperty('onLoad', [onLoad1, onLoad2])
        .build()

      when(mockNodeRegistry.get)
        .calledWith(step.id)
        .mockReturnValue(step)

      when(mockMetadataRegistry.get)
        .calledWith(step.id, 'attachedToParentNode')
        .mockReturnValue(undefined)

      const result = context.findLastOnLoadTransitionFrom(step.id)

      expect(result).toBe(onLoad2)
    })

    it('should return last onLoad transition from journey', () => {
      const onLoad1 = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode
      const onLoad2 = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode

      const journey = ASTTestFactory.journey()
        .withProperty('onLoad', [onLoad1, onLoad2])
        .build()

      when(mockNodeRegistry.get)
        .calledWith(journey.id)
        .mockReturnValue(journey)

      when(mockMetadataRegistry.get)
        .calledWith(journey.id, 'attachedToParentNode')
        .mockReturnValue(undefined)

      const result = context.findLastOnLoadTransitionFrom(journey.id)

      expect(result).toBe(onLoad2)
    })

    it('should traverse to parent when step has no onLoad', () => {
      const parentOnLoad = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode

      const parent = ASTTestFactory.journey()
        .withProperty('onLoad', [parentOnLoad])
        .build()

      const step = ASTTestFactory.step().build()

      when(mockNodeRegistry.get)
        .calledWith(step.id)
        .mockReturnValue(step)

      when(mockNodeRegistry.get)
        .calledWith(parent.id)
        .mockReturnValue(parent)

      when(mockMetadataRegistry.get)
        .calledWith(step.id, 'attachedToParentNode')
        .mockReturnValue(parent.id)

      when(mockMetadataRegistry.get)
        .calledWith(parent.id, 'attachedToParentNode')
        .mockReturnValue(undefined)

      const result = context.findLastOnLoadTransitionFrom(step.id)

      expect(result).toBe(parentOnLoad)
    })

    it('should traverse to parent when step has empty onLoad array', () => {
      const parentOnLoad = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode

      const parent = ASTTestFactory.journey()
        .withProperty('onLoad', [parentOnLoad])
        .build()

      const step = ASTTestFactory.step()
        .withProperty('onLoad', [])
        .build()

      when(mockNodeRegistry.get)
        .calledWith(step.id)
        .mockReturnValue(step)

      when(mockNodeRegistry.get)
        .calledWith(parent.id)
        .mockReturnValue(parent)

      when(mockMetadataRegistry.get)
        .calledWith(step.id, 'attachedToParentNode')
        .mockReturnValue(parent.id)

      when(mockMetadataRegistry.get)
        .calledWith(parent.id, 'attachedToParentNode')
        .mockReturnValue(undefined)

      const result = context.findLastOnLoadTransitionFrom(step.id)

      expect(result).toBe(parentOnLoad)
    })

    it('should traverse multiple levels to find onLoad', () => {
      const grandparentOnLoad = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode

      const grandparent = ASTTestFactory.journey()
        .withProperty('onLoad', [grandparentOnLoad])
        .build()

      const parent = ASTTestFactory.journey().build()
      const step = ASTTestFactory.step().build()

      when(mockNodeRegistry.get)
        .calledWith(step.id)
        .mockReturnValue(step)

      when(mockNodeRegistry.get)
        .calledWith(parent.id)
        .mockReturnValue(parent)

      when(mockNodeRegistry.get)
        .calledWith(grandparent.id)
        .mockReturnValue(grandparent)

      when(mockMetadataRegistry.get)
        .calledWith(step.id, 'attachedToParentNode')
        .mockReturnValue(parent.id)

      when(mockMetadataRegistry.get)
        .calledWith(parent.id, 'attachedToParentNode')
        .mockReturnValue(grandparent.id)

      when(mockMetadataRegistry.get)
        .calledWith(grandparent.id, 'attachedToParentNode')
        .mockReturnValue(undefined)

      const result = context.findLastOnLoadTransitionFrom(step.id)

      expect(result).toBe(grandparentOnLoad)
    })

    it('should prefer step onLoad over parent onLoad', () => {
      const stepOnLoad = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode
      const parentOnLoad = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode

      const parent = ASTTestFactory.journey()
        .withProperty('onLoad', [parentOnLoad])
        .build()

      const step = ASTTestFactory.step()
        .withProperty('onLoad', [stepOnLoad])
        .build()

      when(mockNodeRegistry.get)
        .calledWith(step.id)
        .mockReturnValue(step)

      when(mockMetadataRegistry.get)
        .calledWith(step.id, 'attachedToParentNode')
        .mockReturnValue(parent.id)

      const result = context.findLastOnLoadTransitionFrom(step.id)

      expect(result).toBe(stepOnLoad)
    })

    it('should return undefined when no onLoad transitions exist in chain', () => {
      const parent = ASTTestFactory.journey().build()
      const step = ASTTestFactory.step().build()

      when(mockNodeRegistry.get)
        .calledWith(step.id)
        .mockReturnValue(step)

      when(mockNodeRegistry.get)
        .calledWith(parent.id)
        .mockReturnValue(parent)

      when(mockMetadataRegistry.get)
        .calledWith(step.id, 'attachedToParentNode')
        .mockReturnValue(parent.id)

      when(mockMetadataRegistry.get)
        .calledWith(parent.id, 'attachedToParentNode')
        .mockReturnValue(undefined)

      const result = context.findLastOnLoadTransitionFrom(step.id)

      expect(result).toBeUndefined()
    })

    it('should skip non-structural nodes during traversal', () => {
      const parentOnLoad = ASTTestFactory.transition(TransitionType.LOAD).build() as LoadTransitionASTNode

      const parent = ASTTestFactory.journey()
        .withProperty('onLoad', [parentOnLoad])
        .build()

      const blockNode = ASTTestFactory.block('TextInput', BlockType.BASIC).build()

      when(mockNodeRegistry.get)
        .calledWith(blockNode.id)
        .mockReturnValue(blockNode)

      when(mockNodeRegistry.get)
        .calledWith(parent.id)
        .mockReturnValue(parent)

      when(mockMetadataRegistry.get)
        .calledWith(blockNode.id, 'attachedToParentNode')
        .mockReturnValue(parent.id)

      when(mockMetadataRegistry.get)
        .calledWith(parent.id, 'attachedToParentNode')
        .mockReturnValue(undefined)

      const result = context.findLastOnLoadTransitionFrom(blockNode.id)

      expect(result).toBe(parentOnLoad)
    })
  })
})
