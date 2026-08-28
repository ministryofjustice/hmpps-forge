import { ComponentCallType, ExpressionType, IteratorType } from '../../../../../shared/taxonomy'
import type { IterateASTNode } from '../../../contracts/ast/expressions.type'
import type { TemplateValue } from '../../../contracts/ast/template.type'
import { ASTNodeFamily } from '../../../contracts/ast/enums'
import { ASTTestFactory } from '../testing-helpers/ASTTestFactory'
import { compileTemplate } from '../nodes/template'
import { NodeIDGenerator } from './NodeIDGenerator'
import TemplateNodeIndex from './TemplateNodeIndex'

const iterateNodeWithYield = (yieldTemplate: TemplateValue): IterateASTNode =>
  ASTTestFactory.expression<IterateASTNode>(ExpressionType.ITERATE)
    .withProperty('input', ASTTestFactory.reference(['answers', 'items']))
    .withProperty('iterator', { type: IteratorType.MAP, yieldTemplate })
    .build()

describe('TemplateNodeIndex', () => {
  describe('registerTree()', () => {
    beforeEach(() => {
      ASTTestFactory.resetIds()
    })

    it('should index a template node by its semantic kind when the tree is registered', () => {
      // Arrange
      const template = compileTemplate(
        ASTTestFactory.block('text', ComponentCallType.FIELD).withCode('field').build(),
        new NodeIDGenerator(),
      )
      const iterate = iterateNodeWithYield(template)
      const index = new TemplateNodeIndex()

      // Act
      index.registerTree(template, iterate)

      // Assert
      const entries = index.findByKind(ComponentCallType.FIELD)

      expect(entries).toHaveLength(1)
      expect(entries[0].node.kind).toBe(ComponentCallType.FIELD)
    })

    it('should index a template node by its family sub-type when the node carries one', () => {
      // Arrange
      const template = compileTemplate(ASTTestFactory.reference(['answers', 'name']), new NodeIDGenerator())
      const iterate = iterateNodeWithYield(template)
      const index = new TemplateNodeIndex()

      // Act
      index.registerTree(template, iterate)

      // Assert
      expect(index.findByKind(ExpressionType.REFERENCE)).toHaveLength(1)
      expect(index.findByFamily(ASTNodeFamily.EXPRESSION)).toHaveLength(1)
    })

    it('should carry the owning node on every entry when descendants are indexed', () => {
      // Arrange
      const block = ASTTestFactory.block('text', ComponentCallType.FIELD)
        .withCode('field')
        .withProperty('defaultValue', ASTTestFactory.reference(['answers', 'name']))
        .build()
      const template = compileTemplate(block, new NodeIDGenerator())
      const iterate = iterateNodeWithYield(template)
      const index = new TemplateNodeIndex()

      // Act
      index.registerTree(template, iterate)

      // Assert
      const blockEntries = index.findByKind(ComponentCallType.FIELD)
      const referenceEntries = index.findByKind(ExpressionType.REFERENCE)

      expect(blockEntries[0].owningNode).toBe(iterate)
      expect(referenceEntries).toHaveLength(1)
      expect(referenceEntries[0].owningNode).toBe(iterate)
    })

    it('should not index the same template node more than once', () => {
      // Arrange
      const template = compileTemplate(ASTTestFactory.reference(['answers', 'name']), new NodeIDGenerator())
      const iterate = iterateNodeWithYield(template)
      const index = new TemplateNodeIndex()

      // Act
      index.registerTree([template, template], iterate)

      // Assert
      expect(index.findByKind(ExpressionType.REFERENCE)).toHaveLength(1)
      expect(index.findByFamily(ASTNodeFamily.EXPRESSION)).toHaveLength(1)
    })

    it('should index template nodes wrapped in arrays and plain objects when the tree is registered', () => {
      // Arrange
      const template = compileTemplate(
        { entries: [ASTTestFactory.reference(['answers', 'name'])] },
        new NodeIDGenerator(),
      )
      const iterate = iterateNodeWithYield(template)
      const index = new TemplateNodeIndex()

      // Act
      index.registerTree(template, iterate)

      // Assert
      expect(index.findByKind(ExpressionType.REFERENCE)).toHaveLength(1)
    })
  })

  describe('findByKind()', () => {
    it('should return an empty array when no template node of the type was registered', () => {
      // Arrange
      const index = new TemplateNodeIndex()

      // Act
      const entries = index.findByFamily(ASTNodeFamily.HOOK)

      // Assert
      expect(entries).toEqual([])
    })

    it('should return a copy of the bucket when the same type is queried twice', () => {
      // Arrange
      const template = compileTemplate(ASTTestFactory.reference(['answers', 'name']), new NodeIDGenerator())
      const iterate = iterateNodeWithYield(template)
      const index = new TemplateNodeIndex()
      index.registerTree(template, iterate)

      // Act
      const first = index.findByKind(ExpressionType.REFERENCE)
      first.pop()

      // Assert
      expect(index.findByKind(ExpressionType.REFERENCE)).toHaveLength(1)
    })
  })
})
