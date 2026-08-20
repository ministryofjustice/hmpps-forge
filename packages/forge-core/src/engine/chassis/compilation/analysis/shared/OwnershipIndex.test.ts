import { BlockType, ExpressionType, IteratorType } from '../../../../../authoring/types/enums'
import type { ASTNode } from '../../../contracts/ast/engine.type'
import type { IterateASTNode } from '../../../contracts/ast/expressions.type'
import ASTNodeIndex from '../../ast/ast-state/ASTNodeIndex'
import { ASTTestFactory } from '../../ast/testing-helpers/ASTTestFactory'
import OwnershipIndex from './OwnershipIndex'

function setParent(child: ASTNode, parent: ASTNode): void {
  Object.defineProperty(child, 'parent', { value: parent, enumerable: false })
}

function iterateNode(iteratorType: IteratorType): IterateASTNode {
  return ASTTestFactory.expression<IterateASTNode>(ExpressionType.ITERATE)
    .withProperty('input', ASTTestFactory.reference(['answers', 'items']))
    .withProperty('iterator', { type: iteratorType })
    .build()
}

describe('OwnershipIndex', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('journeys()', () => {
    it('should bucket steps under their direct parent journey in document order', () => {
      // Arrange
      const nodeIndex = new ASTNodeIndex()
      const rootJourney = ASTTestFactory.journey().build()
      const nestedJourney = ASTTestFactory.journey().build()
      const firstStep = ASTTestFactory.step().withPath('/first').build()
      const secondStep = ASTTestFactory.step().withPath('/second').build()
      const nestedStep = ASTTestFactory.step().withPath('/nested').build()

      setParent(nestedJourney, rootJourney)
      setParent(firstStep, rootJourney)
      setParent(secondStep, rootJourney)
      setParent(nestedStep, nestedJourney)
      nodeIndex.register(rootJourney.id, rootJourney)
      nodeIndex.register(firstStep.id, firstStep)
      nodeIndex.register(secondStep.id, secondStep)
      nodeIndex.register(nestedJourney.id, nestedJourney)
      nodeIndex.register(nestedStep.id, nestedStep)

      // Act
      const journeys = new OwnershipIndex(nodeIndex).journeys()

      // Assert
      expect(journeys.map(journey => journey.journeyNode)).toEqual([rootJourney, nestedJourney])
      expect(journeys[0].stepNodes).toEqual([firstStep, secondStep])
      expect(journeys[1].stepNodes).toEqual([nestedStep])
    })

    it('should keep a container journey with an empty step list when it owns no direct steps', () => {
      // Arrange
      const nodeIndex = new ASTNodeIndex()
      const rootJourney = ASTTestFactory.journey().build()
      const containerJourney = ASTTestFactory.journey().build()
      const stepNode = ASTTestFactory.step().withPath('/first').build()

      setParent(containerJourney, rootJourney)
      setParent(stepNode, rootJourney)
      nodeIndex.register(rootJourney.id, rootJourney)
      nodeIndex.register(containerJourney.id, containerJourney)
      nodeIndex.register(stepNode.id, stepNode)

      // Act
      const journeys = new OwnershipIndex(nodeIndex).journeys()

      // Assert
      expect(journeys.find(journey => journey.journeyNode === containerJourney)?.stepNodes).toEqual([])
    })
  })

  describe('fieldBlocksOf()', () => {
    it('should bucket field and iterate nodes under their owning step when they are step descendants', () => {
      // Arrange
      const nodeIndex = new ASTNodeIndex()
      const journeyNode = ASTTestFactory.journey().build()
      const stepNode = ASTTestFactory.step().withPath('/first').build()
      const fieldBlock = ASTTestFactory.block('TextInput', BlockType.FIELD).withCode('owned').build()
      const nestedFieldBlock = ASTTestFactory.block('TextInput', BlockType.FIELD).withCode('nested').build()
      const outsideFieldBlock = ASTTestFactory.block('TextInput', BlockType.FIELD).withCode('outside').build()
      const mapIterate = iterateNode(IteratorType.MAP)
      const filterIterate = iterateNode(IteratorType.FILTER)

      setParent(stepNode, journeyNode)
      setParent(fieldBlock, stepNode)
      setParent(mapIterate, stepNode)
      setParent(nestedFieldBlock, mapIterate)
      setParent(filterIterate, stepNode)
      setParent(outsideFieldBlock, journeyNode)
      nodeIndex.register(journeyNode.id, journeyNode)
      nodeIndex.register(stepNode.id, stepNode)
      nodeIndex.register(fieldBlock.id, fieldBlock)
      nodeIndex.register(mapIterate.id, mapIterate)
      nodeIndex.register(nestedFieldBlock.id, nestedFieldBlock)
      nodeIndex.register(filterIterate.id, filterIterate)
      nodeIndex.register(outsideFieldBlock.id, outsideFieldBlock)

      // Act
      const ownershipIndex = new OwnershipIndex(nodeIndex)

      // Assert
      expect(ownershipIndex.fieldBlocksOf(stepNode.id)).toEqual([fieldBlock, nestedFieldBlock])
      expect(ownershipIndex.mapIterateNodesOf(stepNode.id)).toEqual([mapIterate])
      expect(ownershipIndex.allIterateNodesOf(stepNode.id)).toEqual([mapIterate, filterIterate])
    })

    it('should return empty buckets when the step is unknown', () => {
      // Arrange
      const nodeIndex = new ASTNodeIndex()
      const stepNode = ASTTestFactory.step().withPath('/first').build()

      // Act
      const ownershipIndex = new OwnershipIndex(nodeIndex)

      // Assert
      expect(ownershipIndex.fieldBlocksOf(stepNode.id)).toEqual([])
      expect(ownershipIndex.mapIterateNodesOf(stepNode.id)).toEqual([])
      expect(ownershipIndex.allIterateNodesOf(stepNode.id)).toEqual([])
    })
  })
})
