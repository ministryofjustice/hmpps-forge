import { BlockType } from '../../../../authoring/types/enums'
import type { ASTNode } from '../../../contracts/ast/engine.type'
import ASTNodeIndex from '../../ast/ast-state/ASTNodeIndex'
import { ASTTestFactory } from '../../ast/testing-helpers/ASTTestFactory'
import FieldInventoryAnalyzer from './FieldInventoryAnalyzer'

function setParent(child: ASTNode, parent: ASTNode): void {
  Object.defineProperty(child, 'parent', { value: parent, enumerable: false })
}

describe('FieldInventoryAnalyzer', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('findValidatingFieldBlocksForStep()', () => {
    it('should select only descendant fields with configured validation', () => {
      // Arrange
      const nodeRegistry = new ASTNodeIndex()
      const stepNode = ASTTestFactory.step().build()
      const validatingFieldBlock = ASTTestFactory.block('TextInput', BlockType.FIELD)
        .withCode('validated')
        .withProperty('validWhen', [ASTTestFactory.reference(['answers', 'validated'])])
        .build()
      const plainFieldBlock = ASTTestFactory.block('TextInput', BlockType.FIELD)
        .withCode('plain')
        .build()
      const outsideFieldBlock = ASTTestFactory.block('TextInput', BlockType.FIELD)
        .withCode('outside')
        .withProperty('validWhen', [ASTTestFactory.reference(['answers', 'outside'])])
        .build()

      setParent(validatingFieldBlock, stepNode)
      setParent(plainFieldBlock, stepNode)
      nodeRegistry.register(stepNode.id, stepNode)
      nodeRegistry.register(validatingFieldBlock.id, validatingFieldBlock)
      nodeRegistry.register(plainFieldBlock.id, plainFieldBlock)
      nodeRegistry.register(outsideFieldBlock.id, outsideFieldBlock)

      const analyzer = new FieldInventoryAnalyzer(nodeRegistry)

      // Act
      const result = analyzer.findValidatingFieldBlocksForStep(stepNode.id)

      // Assert
      expect(result).toEqual([validatingFieldBlock])
      expect(analyzer.hasValidationBlocks(stepNode.id)).toBe(true)
    })
  })

})
