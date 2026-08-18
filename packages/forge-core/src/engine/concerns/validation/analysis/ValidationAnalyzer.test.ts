import { BlockType } from '../../../../authoring/types/enums'
import type { ASTNode } from '../../../chassis/contracts/ast/engine.type'
import ASTNodeIndex from '../../../chassis/compilation/ast/ast-state/ASTNodeIndex'
import { ASTTestFactory } from '../../../chassis/compilation/ast/testing-helpers/ASTTestFactory'
import { createStepAnalysisContext } from '../../../chassis/compilation/analysis/testing-helpers/analysisContexts'
import { ValidationRulesKind } from '../../../chassis/contracts/models/fieldModel.type'
import ValidationAnalyzer from './ValidationAnalyzer'

function setParent(child: ASTNode, parent: ASTNode): void {
  Object.defineProperty(child, 'parent', { value: parent, enumerable: false })
}

describe('ValidationAnalyzer', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('analyzeStep()', () => {
    it('should model only validating fields when the step mixes validating and plain blocks', () => {
      // Arrange
      const nodeIndex = new ASTNodeIndex()
      const journeyNode = ASTTestFactory.journey().build()
      const stepNode = ASTTestFactory.step().withPath('/step').build()
      const validatingBlock = ASTTestFactory.block('TextInput', BlockType.FIELD)
        .withCode('email')
        .withProperty('validWhen', [{ message: 'Required' }])
        .build()
      const plainBlock = ASTTestFactory.block('TextInput', BlockType.FIELD).withCode('name').build()

      setParent(stepNode, journeyNode)
      setParent(validatingBlock, stepNode)
      setParent(plainBlock, stepNode)
      nodeIndex.register(journeyNode.id, journeyNode)
      nodeIndex.register(stepNode.id, stepNode)
      nodeIndex.register(validatingBlock.id, validatingBlock)
      nodeIndex.register(plainBlock.id, plainBlock)

      const context = createStepAnalysisContext({ stepNode, nodeIndex })
      const analyzer = new ValidationAnalyzer()

      // Act
      const model = analyzer.analyzeStep(context)

      // Assert
      expect(model.hasValidation).toBe(true)
      expect(model.fields.map(field => field.source)).toEqual([validatingBlock])
      expect(model.domainRules).toBeUndefined()
      expect(model.entryValidation).toEqual([])
    })

    it('should report no validation when the step has no validating blocks or domain validWhen', () => {
      // Arrange
      const nodeIndex = new ASTNodeIndex()
      const journeyNode = ASTTestFactory.journey().build()
      const stepNode = ASTTestFactory.step().withPath('/step').build()
      const plainBlock = ASTTestFactory.block('TextInput', BlockType.FIELD).withCode('name').build()

      setParent(stepNode, journeyNode)
      setParent(plainBlock, stepNode)
      nodeIndex.register(journeyNode.id, journeyNode)
      nodeIndex.register(stepNode.id, stepNode)
      nodeIndex.register(plainBlock.id, plainBlock)

      const context = createStepAnalysisContext({ stepNode, nodeIndex })
      const analyzer = new ValidationAnalyzer()

      // Act
      const model = analyzer.analyzeStep(context)

      // Assert
      expect(model.hasValidation).toBe(false)
      expect(model.fields).toEqual([])
    })

    it('should classify domain rules when the step carries a validWhen value', () => {
      // Arrange
      const nodeIndex = new ASTNodeIndex()
      const journeyNode = ASTTestFactory.journey().build()
      const stepNode = ASTTestFactory.step()
        .withPath('/step')
        .withProperty('validWhen', { message: 'Broken' })
        .build()

      setParent(stepNode, journeyNode)
      nodeIndex.register(journeyNode.id, journeyNode)
      nodeIndex.register(stepNode.id, stepNode)

      const context = createStepAnalysisContext({ stepNode, nodeIndex })
      const analyzer = new ValidationAnalyzer()

      // Act
      const model = analyzer.analyzeStep(context)

      // Assert
      expect(model.hasValidation).toBe(true)
      expect(model.domainRules?.kind).toBe(ValidationRulesKind.DYNAMIC)
    })
  })
})
