import { BlockType } from '../../../../authoring/types/enums'
import ASTNodeIndex from '../../ast/ast-state/ASTNodeIndex'
import ASTNodeTree from '../../ast/ast-state/ASTNodeTree'
import { ASTTestFactory } from '../../ast/testing-helpers/ASTTestFactory'
import FieldInventoryAnalyzer from '../shared/FieldInventoryAnalyzer'
import ValidationInputAnalyzer from './ValidationInputAnalyzer'

describe('ValidationInputAnalyzer', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('buildInputs()', () => {
    it('should return the step node and validating field blocks', () => {
      // Arrange
      const nodeRegistry = new ASTNodeIndex()
      const astNodeTree = new ASTNodeTree()
      const journeyNode = ASTTestFactory.journey().build()
      const stepNode = ASTTestFactory.step().withPath('/step').build()
      const validatingBlock = ASTTestFactory.block('TextInput', BlockType.FIELD)
        .withCode('email')
        .withProperty('validWhen', [{ message: 'Required' }])
        .build()
      const plainBlock = ASTTestFactory.block('TextInput', BlockType.FIELD)
        .withCode('name')
        .build()

      nodeRegistry.register(journeyNode.id, journeyNode)
      nodeRegistry.register(stepNode.id, stepNode)
      nodeRegistry.register(validatingBlock.id, validatingBlock)
      nodeRegistry.register(plainBlock.id, plainBlock)
      astNodeTree.addNode(journeyNode.id)
      astNodeTree.addNode(stepNode.id, journeyNode.id)
      astNodeTree.addNode(validatingBlock.id, stepNode.id)
      astNodeTree.addNode(plainBlock.id, stepNode.id)

      const fieldInventoryAnalyzer = new FieldInventoryAnalyzer(nodeRegistry, astNodeTree)
      const analyzer = new ValidationInputAnalyzer(fieldInventoryAnalyzer)

      // Act
      const result = analyzer.buildInputs(stepNode)

      // Assert
      expect(result.stepNode).toBe(stepNode)
      expect(result.hasValidation).toBe(true)
      expect(result.validatingFieldBlocks).toEqual([validatingBlock])
      expect(result.mapIterateNodes).toEqual([])
    })

    it('should report no validation when the step has no validating blocks or domain validWhen', () => {
      // Arrange
      const nodeRegistry = new ASTNodeIndex()
      const astNodeTree = new ASTNodeTree()
      const journeyNode = ASTTestFactory.journey().build()
      const stepNode = ASTTestFactory.step().withPath('/step').build()
      const plainBlock = ASTTestFactory.block('TextInput', BlockType.FIELD).withCode('name').build()

      nodeRegistry.register(journeyNode.id, journeyNode)
      nodeRegistry.register(stepNode.id, stepNode)
      nodeRegistry.register(plainBlock.id, plainBlock)
      astNodeTree.addNode(journeyNode.id)
      astNodeTree.addNode(stepNode.id, journeyNode.id)
      astNodeTree.addNode(plainBlock.id, stepNode.id)

      const fieldInventoryAnalyzer = new FieldInventoryAnalyzer(nodeRegistry, astNodeTree)
      const analyzer = new ValidationInputAnalyzer(fieldInventoryAnalyzer)

      // Act
      const result = analyzer.buildInputs(stepNode)

      // Assert
      expect(result.hasValidation).toBe(false)
    })
  })
})
