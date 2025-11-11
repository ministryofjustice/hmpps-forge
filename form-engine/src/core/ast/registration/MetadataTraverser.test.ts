import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import MetadataRegistry from './MetadataRegistry'
import { MetadataTraverser } from './MetadataTraverser'

describe('MetadataTraverser', () => {
  let mockMetadataRegistry: jest.Mocked<MetadataRegistry>
  let traverser: MetadataTraverser

  beforeEach(() => {
    ASTTestFactory.resetIds()

    mockMetadataRegistry = {
      set: jest.fn(),
      get: jest.fn(),
    } as unknown as jest.Mocked<MetadataRegistry>

    traverser = new MetadataTraverser(mockMetadataRegistry)
  })

  describe('traverse', () => {
    it('should mark journey as ancestor and step as descendant', () => {
      // Arrange
      const stepNode = ASTTestFactory.step().build()
      const journeyNode = ASTTestFactory
        .journey()
        .withProperty('steps', [stepNode])
        .build()

      // Act
      traverser.traverse(journeyNode, stepNode)

      // Assert
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(journeyNode.id, 'isAncestorOfStep', true)
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(stepNode.id, 'isDescendantOfStep', true)
    })

    it('should mark all blocks as descendants', () => {
      // Arrange
      const block1 = ASTTestFactory
        .block('TextInput', 'field')
        .withCode('firstName')
        .build()
      const block2 = ASTTestFactory
        .block('TextInput', 'field')
        .withCode('lastName')
        .build()
      const block3 = ASTTestFactory
        .block('Heading', 'basic')
        .build()
      const stepNode = ASTTestFactory
        .step()
        .withProperty('blocks', [block1, block2, block3])
        .build()
      const journeyNode = ASTTestFactory
        .journey()
        .withProperty('steps', [stepNode])
        .build()

      // Act
      traverser.traverse(journeyNode, stepNode)

      // Assert
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(stepNode.id, 'isDescendantOfStep', true)
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(block1.id, 'isDescendantOfStep', true)
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(block2.id, 'isDescendantOfStep', true)
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(block3.id, 'isDescendantOfStep', true)
    })

    it('should mark journey as ancestor', () => {
      // Arrange
      const block = ASTTestFactory
        .block('TextInput', 'field')
        .build()
      const stepNode = ASTTestFactory
        .step()
        .withProperty('blocks', [block])
        .build()
      const journeyNode = ASTTestFactory
        .journey()
        .withProperty('steps', [stepNode])
        .build()

      // Act
      traverser.traverse(journeyNode, stepNode)

      // Assert
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(journeyNode.id, 'isAncestorOfStep', true)
    })

    it('should only mark target step and its descendants', () => {
      // Arrange
      const targetStepBlock1 = ASTTestFactory
        .block('TextInput', 'field')
        .withCode('targetField1')
        .build()
      const targetStepBlock2 = ASTTestFactory
        .block('TextInput', 'field')
        .withCode('targetField2')
        .build()
      const targetStep = ASTTestFactory
        .step()
        .withProperty('blocks', [targetStepBlock1, targetStepBlock2])
        .build()

      const otherStepBlock = ASTTestFactory
        .block('TextInput', 'field')
        .withCode('otherField')
        .build()
      const otherStep = ASTTestFactory
        .step()
        .withProperty('blocks', [otherStepBlock])
        .build()

      const journeyNode = ASTTestFactory
        .journey()
        .withProperty('steps', [otherStep, targetStep])
        .build()

      // Act
      traverser.traverse(journeyNode, targetStep)

      // Assert - target step and its blocks should be marked as descendants
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(targetStep.id, 'isDescendantOfStep', true)
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(targetStepBlock1.id, 'isDescendantOfStep', true)
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(targetStepBlock2.id, 'isDescendantOfStep', true)

      // Assert - other step and its blocks should NOT be marked
      expect(mockMetadataRegistry.set).not.toHaveBeenCalledWith(otherStep.id, 'isDescendantOfStep', true)
      expect(mockMetadataRegistry.set).not.toHaveBeenCalledWith(otherStepBlock.id, 'isDescendantOfStep', true)
    })

    it('should mark deeply nested blocks as descendants', () => {
      // Arrange
      const nestedBlock = ASTTestFactory
        .block('TextInput', 'field')
        .withCode('nestedField')
        .build()
      const parentBlock = ASTTestFactory
        .block('Container', 'basic')
        .withProperty('blocks', [nestedBlock])
        .build()
      const stepNode = ASTTestFactory
        .step()
        .withProperty('blocks', [parentBlock])
        .build()
      const journeyNode = ASTTestFactory
        .journey()
        .withProperty('steps', [stepNode])
        .build()

      // Act
      traverser.traverse(journeyNode, stepNode)

      // Assert
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(stepNode.id, 'isDescendantOfStep', true)
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(parentBlock.id, 'isDescendantOfStep', true)
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(nestedBlock.id, 'isDescendantOfStep', true)
    })

    it('should mark all ancestors in the path', () => {
      // Arrange
      const stepNode = ASTTestFactory
        .step()
        .build()
      const innerJourney = ASTTestFactory
        .journey()
        .withProperty('steps', [stepNode])
        .build()
      const outerJourney = ASTTestFactory
        .journey()
        .withProperty('journeys', [innerJourney])
        .build()

      // Act
      traverser.traverse(outerJourney, stepNode)

      // Assert
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(outerJourney.id, 'isAncestorOfStep', true)
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(innerJourney.id, 'isAncestorOfStep', true)
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(stepNode.id, 'isDescendantOfStep', true)
    })

    it('should mark all ancestor journeys across multiple layers', () => {
      // Arrange
      const stepNode = ASTTestFactory
        .step()
        .build()
      const childJourney = ASTTestFactory
        .journey()
        .withProperty('steps', [stepNode])
        .build()
      const parentJourney = ASTTestFactory
        .journey()
        .withProperty('journeys', [childJourney])
        .build()
      const grandparentJourney = ASTTestFactory
        .journey()
        .withProperty('journeys', [parentJourney])
        .build()
      const greatGrandparentJourney = ASTTestFactory
        .journey()
        .withProperty('journeys', [grandparentJourney])
        .build()

      // Act
      traverser.traverse(greatGrandparentJourney, stepNode)

      // Assert - all ancestor journeys should be marked
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(greatGrandparentJourney.id, 'isAncestorOfStep', true)
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(grandparentJourney.id, 'isAncestorOfStep', true)
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(parentJourney.id, 'isAncestorOfStep', true)
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(childJourney.id, 'isAncestorOfStep', true)
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(stepNode.id, 'isDescendantOfStep', true)
    })

    it('should not mark sibling journeys as ancestors', () => {
      // Arrange
      const targetStepNode = ASTTestFactory
        .step()
        .build()
      const targetJourney = ASTTestFactory
        .journey()
        .withProperty('steps', [targetStepNode])
        .build()

      const siblingStepNode = ASTTestFactory
        .step()
        .build()
      const siblingJourney = ASTTestFactory
        .journey()
        .withProperty('steps', [siblingStepNode])
        .build()

      const anotherSiblingJourney = ASTTestFactory
        .journey()
        .build()

      const parentJourney = ASTTestFactory
        .journey()
        .withProperty('journeys', [siblingJourney, targetJourney, anotherSiblingJourney])
        .build()

      // Act
      traverser.traverse(parentJourney, targetStepNode)

      // Assert - only parent and target journey should be marked as ancestors
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(parentJourney.id, 'isAncestorOfStep', true)
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(targetJourney.id, 'isAncestorOfStep', true)

      // Assert - sibling journeys should NOT be marked as ancestors
      expect(mockMetadataRegistry.set).not.toHaveBeenCalledWith(siblingJourney.id, 'isAncestorOfStep', true)
      expect(mockMetadataRegistry.set).not.toHaveBeenCalledWith(anotherSiblingJourney.id, 'isAncestorOfStep', true)

      // Assert - target step should be marked as descendant
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(targetStepNode.id, 'isDescendantOfStep', true)

      // Assert - sibling step and journey should NOT be marked as descendants
      expect(mockMetadataRegistry.set).not.toHaveBeenCalledWith(siblingStepNode.id, 'isDescendantOfStep', true)
    })

    it('should not mark expressions as descendants', () => {
      // Arrange
      const expression = ASTTestFactory
        .reference(['answers', 'firstName'])
      const block = ASTTestFactory
        .block('TextInput', 'field')
        .withProperty('value', expression)
        .build()
      const stepNode = ASTTestFactory
        .step()
        .withProperty('blocks', [block])
        .build()
      const journeyNode = ASTTestFactory
        .journey()
        .withProperty('steps', [stepNode])
        .build()

      // Act
      traverser.traverse(journeyNode, stepNode)

      // Assert
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(stepNode.id, 'isDescendantOfStep', true)
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(block.id, 'isDescendantOfStep', true)
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(expression.id, 'isDescendantOfStep', true)
    })
  })

  describe('attachedToParentNode and attachedToParentProperty', () => {
    it('should set parent node and property for step in journey', () => {
      // Arrange
      const stepNode = ASTTestFactory.step().build()
      const journeyNode = ASTTestFactory
        .journey()
        .withProperty('steps', [stepNode])
        .build()

      // Act
      traverser.traverse(journeyNode, stepNode)

      // Assert
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(stepNode.id, 'attachedToParentNode', journeyNode.id)
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(stepNode.id, 'attachedToParentProperty', 'steps')
    })

    it('should set parent node and property for blocks in step', () => {
      // Arrange
      const block1 = ASTTestFactory
        .block('TextInput', 'field')
        .withCode('firstName')
        .build()
      const block2 = ASTTestFactory
        .block('TextInput', 'field')
        .withCode('lastName')
        .build()
      const stepNode = ASTTestFactory
        .step()
        .withProperty('blocks', [block1, block2])
        .build()
      const journeyNode = ASTTestFactory
        .journey()
        .withProperty('steps', [stepNode])
        .build()

      // Act
      traverser.traverse(journeyNode, stepNode)

      // Assert
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(block1.id, 'attachedToParentNode', stepNode.id)
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(block1.id, 'attachedToParentProperty', 'blocks')
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(block2.id, 'attachedToParentNode', stepNode.id)
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(block2.id, 'attachedToParentProperty', 'blocks')
    })

    it('should set parent node and property for nested blocks', () => {
      // Arrange
      const nestedBlock = ASTTestFactory
        .block('TextInput', 'field')
        .withCode('nestedField')
        .build()
      const parentBlock = ASTTestFactory
        .block('Container', 'basic')
        .withProperty('blocks', [nestedBlock])
        .build()
      const stepNode = ASTTestFactory
        .step()
        .withProperty('blocks', [parentBlock])
        .build()
      const journeyNode = ASTTestFactory
        .journey()
        .withProperty('steps', [stepNode])
        .build()

      // Act
      traverser.traverse(journeyNode, stepNode)

      // Assert
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(parentBlock.id, 'attachedToParentNode', stepNode.id)
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(parentBlock.id, 'attachedToParentProperty', 'blocks')
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(nestedBlock.id, 'attachedToParentNode', parentBlock.id)
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(nestedBlock.id, 'attachedToParentProperty', 'blocks')
    })

    it('should set parent node and property for expression values', () => {
      // Arrange
      const expression = ASTTestFactory
        .reference(['answers', 'firstName'])
      const block = ASTTestFactory
        .block('TextInput', 'field')
        .withProperty('value', expression)
        .build()
      const stepNode = ASTTestFactory
        .step()
        .withProperty('blocks', [block])
        .build()
      const journeyNode = ASTTestFactory
        .journey()
        .withProperty('steps', [stepNode])
        .build()

      // Act
      traverser.traverse(journeyNode, stepNode)

      // Assert
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(expression.id, 'attachedToParentNode', block.id)
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(expression.id, 'attachedToParentProperty', 'value')
    })

    it('should NOT set parent metadata for root journey', () => {
      // Arrange
      const stepNode = ASTTestFactory.step().build()
      const journeyNode = ASTTestFactory
        .journey()
        .withProperty('steps', [stepNode])
        .build()

      // Act
      traverser.traverse(journeyNode, stepNode)

      // Assert - journey is root, so should not have parent metadata
      expect(mockMetadataRegistry.set).not.toHaveBeenCalledWith(
        journeyNode.id,
        'attachedToParentNode',
        expect.anything(),
      )
      expect(mockMetadataRegistry.set).not.toHaveBeenCalledWith(
        journeyNode.id,
        'attachedToParentProperty',
        expect.anything(),
      )
    })

    it('should set parent node and property for nested journeys', () => {
      // Arrange
      const stepNode = ASTTestFactory.step().build()
      const innerJourney = ASTTestFactory
        .journey()
        .withProperty('steps', [stepNode])
        .build()
      const outerJourney = ASTTestFactory
        .journey()
        .withProperty('journeys', [innerJourney])
        .build()

      // Act
      traverser.traverse(outerJourney, stepNode)

      // Assert
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(innerJourney.id, 'attachedToParentNode', outerJourney.id)
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(innerJourney.id, 'attachedToParentProperty', 'journeys')
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(stepNode.id, 'attachedToParentNode', innerJourney.id)
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(stepNode.id, 'attachedToParentProperty', 'steps')
    })

    it('should set parent metadata for all nodes in complex tree', () => {
      // Arrange
      const expression = ASTTestFactory.reference(['answers', 'test'])
      const block1 = ASTTestFactory
        .block('TextInput', 'field')
        .withProperty('value', expression)
        .build()
      const block2 = ASTTestFactory
        .block('TextInput', 'field')
        .build()
      const stepNode = ASTTestFactory
        .step()
        .withProperty('blocks', [block1, block2])
        .build()
      const journeyNode = ASTTestFactory
        .journey()
        .withProperty('steps', [stepNode])
        .build()

      // Act
      traverser.traverse(journeyNode, stepNode)

      // Assert - verify parent chain
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(stepNode.id, 'attachedToParentNode', journeyNode.id)
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(block1.id, 'attachedToParentNode', stepNode.id)
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(block2.id, 'attachedToParentNode', stepNode.id)
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(expression.id, 'attachedToParentNode', block1.id)

      // Assert - verify property keys
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(stepNode.id, 'attachedToParentProperty', 'steps')
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(block1.id, 'attachedToParentProperty', 'blocks')
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(block2.id, 'attachedToParentProperty', 'blocks')
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(expression.id, 'attachedToParentProperty', 'value')
    })

    it('should set parent metadata for ALL nodes including sibling steps', () => {
      // Arrange
      const targetStepBlock = ASTTestFactory
        .block('TextInput', 'field')
        .withCode('targetField')
        .build()
      const targetStep = ASTTestFactory
        .step()
        .withProperty('blocks', [targetStepBlock])
        .build()

      const siblingStepBlock = ASTTestFactory
        .block('TextInput', 'field')
        .withCode('siblingField')
        .build()
      const siblingStep = ASTTestFactory
        .step()
        .withProperty('blocks', [siblingStepBlock])
        .build()

      const journeyNode = ASTTestFactory
        .journey()
        .withProperty('steps', [siblingStep, targetStep])
        .build()

      // Act
      traverser.traverse(journeyNode, targetStep)

      // Assert - ALL steps should have parent metadata (not just target step)
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(siblingStep.id, 'attachedToParentNode', journeyNode.id)
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(siblingStep.id, 'attachedToParentProperty', 'steps')
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(targetStep.id, 'attachedToParentNode', journeyNode.id)
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(targetStep.id, 'attachedToParentProperty', 'steps')

      // Assert - ALL blocks should have parent metadata (not just target step blocks)
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(siblingStepBlock.id, 'attachedToParentNode', siblingStep.id)
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(siblingStepBlock.id, 'attachedToParentProperty', 'blocks')
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(targetStepBlock.id, 'attachedToParentNode', targetStep.id)
      expect(mockMetadataRegistry.set).toHaveBeenCalledWith(targetStepBlock.id, 'attachedToParentProperty', 'blocks')
    })
  })
})
