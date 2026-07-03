import { BlockType } from '../../../../authoring/types/enums'
import ASTNodeIndex from '../../ast/ast-state/ASTNodeIndex'
import ASTNodeTree from '../../ast/ast-state/ASTNodeTree'
import { ASTTestFactory } from '../../ast/testing-helpers/ASTTestFactory'
import FieldInventoryAnalyzer from '../shared/FieldInventoryAnalyzer'
import AnswerPreparationInputAnalyzer from './AnswerPreparationInputAnalyzer'

describe('AnswerPreparationInputAnalyzer', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('buildInputs()', () => {
    it('should return field blocks and map iterate nodes for the step', () => {
      // Arrange
      const nodeRegistry = new ASTNodeIndex()
      const astNodeTree = new ASTNodeTree()
      const journeyNode = ASTTestFactory.journey().build()
      const stepNode = ASTTestFactory.step().withPath('/step').build()
      const fieldBlock = ASTTestFactory.block('TextInput', BlockType.FIELD)
        .withCode('fieldA')
        .build()

      nodeRegistry.register(journeyNode.id, journeyNode)
      nodeRegistry.register(stepNode.id, stepNode)
      nodeRegistry.register(fieldBlock.id, fieldBlock)
      astNodeTree.addNode(journeyNode.id)
      astNodeTree.addNode(stepNode.id, journeyNode.id)
      astNodeTree.addNode(fieldBlock.id, stepNode.id)

      const fieldInventoryAnalyzer = new FieldInventoryAnalyzer(nodeRegistry, astNodeTree)
      const analyzer = new AnswerPreparationInputAnalyzer(fieldInventoryAnalyzer)

      // Act
      const result = analyzer.buildInputs(stepNode)

      // Assert
      expect(result.fieldBlocks).toEqual([fieldBlock])
      expect(result.mapIterateNodes).toEqual([])
    })
  })
})
