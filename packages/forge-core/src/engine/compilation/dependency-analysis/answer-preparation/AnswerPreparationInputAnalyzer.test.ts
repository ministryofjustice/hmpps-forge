import { BlockType } from '../../../../authoring/types/enums'
import type { ASTNode } from '../../../contracts/ast/engine.type'
import ASTNodeIndex from '../../ast/ast-state/ASTNodeIndex'
import { ASTTestFactory } from '../../ast/testing-helpers/ASTTestFactory'
import FieldInventoryAnalyzer from '../shared/FieldInventoryAnalyzer'
import AnswerPreparationInputAnalyzer from './AnswerPreparationInputAnalyzer'

function setParent(child: ASTNode, parent: ASTNode): void {
  Object.defineProperty(child, 'parent', { value: parent, enumerable: false })
}

describe('AnswerPreparationInputAnalyzer', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('buildInputs()', () => {
    it('should return field blocks and map iterate nodes for the step', () => {
      // Arrange
      const nodeRegistry = new ASTNodeIndex()
      const journeyNode = ASTTestFactory.journey().build()
      const stepNode = ASTTestFactory.step().withPath('/step').build()
      const fieldBlock = ASTTestFactory.block('TextInput', BlockType.FIELD)
        .withCode('fieldA')
        .build()

      setParent(stepNode, journeyNode)
      setParent(fieldBlock, stepNode)
      nodeRegistry.register(journeyNode.id, journeyNode)
      nodeRegistry.register(stepNode.id, stepNode)
      nodeRegistry.register(fieldBlock.id, fieldBlock)

      const fieldInventoryAnalyzer = new FieldInventoryAnalyzer(nodeRegistry)
      const analyzer = new AnswerPreparationInputAnalyzer(fieldInventoryAnalyzer)

      // Act
      const result = analyzer.buildInputs(stepNode)

      // Assert
      expect(result.fieldBlocks).toEqual([fieldBlock])
      expect(result.mapIterateNodes).toEqual([])
    })
  })
})
