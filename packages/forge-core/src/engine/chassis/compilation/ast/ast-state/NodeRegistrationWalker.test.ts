import { BlockType, ExpressionType, IteratorType } from '../../../../../authoring/types/enums'
import { ASTNodeType } from '../../../contracts/ast/enums'
import type { IterateASTNode } from '../../../contracts/ast/expressions.type'
import { ASTTestFactory } from '../testing-helpers/ASTTestFactory'
import { compileTemplate } from '../nodes/template'
import ASTNodeIndex from './ASTNodeIndex'
import TemplateNodeIndex from './TemplateNodeIndex'
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

    it('should index template contents against their owning node instead of registering them', () => {
      // Arrange
      const template = compileTemplate(
        ASTTestFactory.block('text', BlockType.FIELD).withCode('field').build(),
        new NodeIDGenerator(),
      )
      const iterate = ASTTestFactory.expression<IterateASTNode>(ExpressionType.ITERATE)
        .withProperty('input', ASTTestFactory.reference(['answers', 'items']))
        .withProperty('iterator', { type: IteratorType.MAP, yieldTemplate: template })
        .build()
      const nodeIndex = new ASTNodeIndex()
      const templateNodeIndex = new TemplateNodeIndex()
      const walker = new NodeRegistrationWalker(new NodeIDGenerator(), nodeIndex, templateNodeIndex)

      // Act
      walker.register(iterate)

      // Assert
      const entries = templateNodeIndex.findByType(ASTNodeType.BLOCK)

      expect(nodeIndex.findByType(ASTNodeType.BLOCK)).toHaveLength(0)
      expect(entries).toHaveLength(1)
      expect(entries[0].owningNode).toBe(iterate)
    })
  })
})
