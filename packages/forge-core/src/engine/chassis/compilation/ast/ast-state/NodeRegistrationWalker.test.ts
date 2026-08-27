import { ComponentCallType, ExpressionType, IteratorType } from '../../../../../authoring/types/enums'
import type { IterateASTNode } from '../../../contracts/ast/expressions.type'
import { ASTTestFactory } from '../testing-helpers/ASTTestFactory'
import { compileTemplate } from '../nodes/template'
import ASTNodeIndex from './ASTNodeIndex'
import TemplateNodeIndex from './TemplateNodeIndex'
import { NodeIDGenerator } from './NodeIDGenerator'
import NodeRegistrationWalker from './NodeRegistrationWalker'
import type { MaterialisedASTNode } from '../../../contracts/ast/ast.type'

describe('NodeRegistrationWalker', () => {
  describe('register()', () => {
    beforeEach(() => {
      ASTTestFactory.resetIds()
    })

    it('should wire each node to its direct parent down the journey tree', () => {
      // Arrange
      const block = ASTTestFactory.block('TextInput', ComponentCallType.FIELD).withCode('field').build()
      const step = ASTTestFactory.step().withProperty('blocks', [block]).build()
      const journey = ASTTestFactory.journey().withProperty('steps', [step]).build()
      const walker = new NodeRegistrationWalker(new ASTNodeIndex())

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
      const walker = new NodeRegistrationWalker(new ASTNodeIndex())

      // Act
      walker.register(journey)

      // Assert
      expect(step.parent).toBe(journey)
      expect(JSON.stringify(step)).not.toContain('parent')
    })

    it('should index template contents against their owning node instead of registering them', () => {
      // Arrange
      const template = compileTemplate(
        ASTTestFactory.block('text', ComponentCallType.FIELD).withCode('field').build(),
        new NodeIDGenerator(),
      )
      const iterate = ASTTestFactory.expression<IterateASTNode>(ExpressionType.ITERATE)
        .withProperty('input', ASTTestFactory.reference(['answers', 'items']))
        .withProperty('iterator', { type: IteratorType.MAP, yieldTemplate: template })
        .build()
      const nodeIndex = new ASTNodeIndex()
      const templateNodeIndex = new TemplateNodeIndex()
      const walker = new NodeRegistrationWalker(nodeIndex, templateNodeIndex)

      // Act
      walker.register(iterate)

      // Assert
      const entries = templateNodeIndex.findByKind(ComponentCallType.FIELD)

      expect(nodeIndex.findByKind(ComponentCallType.FIELD)).toHaveLength(0)
      expect(entries).toHaveLength(1)
      expect(entries[0].owningNode).toBe(iterate)
    })

    it('should reject a template root without a materialised owner', () => {
      // Arrange
      const template = compileTemplate(ASTTestFactory.reference(['answers', 'name']), new NodeIDGenerator())
      const walker = new NodeRegistrationWalker(new ASTNodeIndex(), new TemplateNodeIndex())

      // Act
      const registerTemplateRoot = () => walker.register(template as unknown as MaterialisedASTNode)

      // Assert
      expect(registerTemplateRoot).toThrow('Template node reached with no registered parent to own it')
    })
  })
})
