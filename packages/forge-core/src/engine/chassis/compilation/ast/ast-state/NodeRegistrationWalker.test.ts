import { BlockType } from '../../../../../authoring/types/enums'
import { ASTTestFactory } from '../testing-helpers/ASTTestFactory'
import ASTNodeIndex from './ASTNodeIndex'
import { NodeIDGenerator } from './NodeIDGenerator'
import NodeRegistrationWalker from './NodeRegistrationWalker'

describe('NodeRegistrationWalker', () => {
  describe('register()', () => {
    beforeEach(() => {
      ASTTestFactory.resetIds()
    })

    it('should wire each node to its direct parent down the journey tree', () => {
      // Arrange
      const block = ASTTestFactory.block('TextInput', BlockType.FIELD).withCode('field').build()
      const step = ASTTestFactory.step().withProperty('blocks', [block]).build()
      const journey = ASTTestFactory.journey().withProperty('steps', [step]).build()
      const walker = new NodeRegistrationWalker(new NodeIDGenerator(), new ASTNodeIndex())

      // Act
      walker.register(journey)

      // Assert
      expect(journey.parent).toBeUndefined()
      expect(step.parent).toBe(journey)
      expect(block.parent).toBe(step)
    })

    it('should keep parent non-enumerable so JSON.stringify omits it', () => {
      // Arrange
      const step = ASTTestFactory.step().withProperty('blocks', []).build()
      const journey = ASTTestFactory.journey().withProperty('steps', [step]).build()
      const walker = new NodeRegistrationWalker(new NodeIDGenerator(), new ASTNodeIndex())

      // Act
      walker.register(journey)

      // Assert
      expect(step.parent).toBe(journey)
      expect(JSON.stringify(step)).not.toContain('parent')
    })
  })
})
