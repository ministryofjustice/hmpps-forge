import type { ASTNode } from '../../../contracts/ast/engine.type'
import { ASTNodeType } from '../../../contracts/ast/enums'
import type { JourneyASTNode } from '../../../contracts/ast/structures.type'
import { ASTTestFactory } from '../../ast/testing-helpers/ASTTestFactory'
import Ancestry from './Ancestry'

function setParent(child: ASTNode, parent: ASTNode): void {
  Object.defineProperty(child, 'parent', { value: parent, enumerable: false })
}

function isJourneyNode(node: ASTNode): node is JourneyASTNode {
  return node.type === ASTNodeType.JOURNEY
}

describe('Ancestry', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('valuesRootFirst()', () => {
    it('should return extracted values root-first including the node itself when ancestors carry values', () => {
      // Arrange
      const rootJourney = ASTTestFactory.journey().withProperty('data', { root: true }).build()
      const middleJourney = ASTTestFactory.journey().build()
      const stepNode = ASTTestFactory.step().withPath('/step').withProperty('data', { step: true }).build()

      setParent(middleJourney, rootJourney)
      setParent(stepNode, middleJourney)

      // Act
      const values = new Ancestry().valuesRootFirst<Record<string, unknown>>(
        stepNode,
        ancestor => ancestor.properties?.data,
      )

      // Assert
      expect(values).toEqual([{ root: true }, { step: true }])
    })
  })

  describe('nearestAncestorSetting()', () => {
    it('should return the node own setting when it is configured', () => {
      // Arrange
      const rootJourney = ASTTestFactory.journey().withProperty('flag', false).build()
      const innerJourney = ASTTestFactory.journey().withProperty('flag', true).build()

      setParent(innerJourney, rootJourney)

      // Act
      const setting = new Ancestry().nearestAncestorSetting<boolean>(
        innerJourney,
        ancestor => ancestor.properties?.flag,
      )

      // Assert
      expect(setting).toBe(true)
    })

    it('should inherit from the nearest configured ancestor when the node sets nothing', () => {
      // Arrange
      const rootJourney = ASTTestFactory.journey().withProperty('flag', true).build()
      const middleJourney = ASTTestFactory.journey().build()
      const innerJourney = ASTTestFactory.journey().build()

      setParent(middleJourney, rootJourney)
      setParent(innerJourney, middleJourney)

      // Act
      const setting = new Ancestry().nearestAncestorSetting<boolean>(
        innerJourney,
        ancestor => ancestor.properties?.flag,
      )

      // Assert
      expect(setting).toBe(true)
    })

    it('should return undefined when nothing along the chain sets a value', () => {
      // Arrange
      const rootJourney = ASTTestFactory.journey().build()
      const innerJourney = ASTTestFactory.journey().build()

      setParent(innerJourney, rootJourney)

      // Act
      const setting = new Ancestry().nearestAncestorSetting<boolean>(
        innerJourney,
        ancestor => ancestor.properties?.flag,
      )

      // Assert
      expect(setting).toBeUndefined()
    })
  })

  describe('ancestorsOfType()', () => {
    it('should return matching ancestors root-first excluding the node itself', () => {
      // Arrange
      const rootJourney = ASTTestFactory.journey().build()
      const innerJourney = ASTTestFactory.journey().build()
      const stepNode = ASTTestFactory.step().withPath('/step').build()

      setParent(innerJourney, rootJourney)
      setParent(stepNode, innerJourney)

      // Act
      const ancestors = new Ancestry().ancestorsOfType(stepNode, isJourneyNode)

      // Assert
      expect(ancestors).toEqual([rootJourney, innerJourney])
    })
  })
})
