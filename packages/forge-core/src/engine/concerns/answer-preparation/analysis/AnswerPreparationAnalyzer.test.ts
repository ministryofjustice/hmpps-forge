import { BlockType } from '../../../../authoring/types/enums'
import type { ASTNode } from '../../../chassis/contracts/ast/engine.type'
import ASTNodeIndex from '../../../chassis/compilation/ast/ast-state/ASTNodeIndex'
import { ASTTestFactory } from '../../../chassis/compilation/ast/testing-helpers/ASTTestFactory'
import {
  createJourneyAnalysisContext,
  createStepAnalysisContext,
} from '../../../chassis/compilation/analysis/testing-helpers/analysisContexts'
import AnswerPreparationAnalyzer from './AnswerPreparationAnalyzer'

function setParent(child: ASTNode, parent: ASTNode): void {
  Object.defineProperty(child, 'parent', { value: parent, enumerable: false })
}

describe('AnswerPreparationAnalyzer', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('analyzeStep()', () => {
    it('should model every field occurrence the step owns when the step declares field blocks', () => {
      // Arrange
      const nodeIndex = new ASTNodeIndex()
      const journeyNode = ASTTestFactory.journey().build()
      const stepNode = ASTTestFactory.step().withPath('/step').build()
      const fieldBlock = ASTTestFactory.block('TextInput', BlockType.FIELD).withCode('fieldA').build()

      setParent(stepNode, journeyNode)
      setParent(fieldBlock, stepNode)
      nodeIndex.register(journeyNode.id, journeyNode)
      nodeIndex.register(stepNode.id, stepNode)
      nodeIndex.register(fieldBlock.id, fieldBlock)

      const context = createStepAnalysisContext({ stepNode, nodeIndex })
      const analyzer = new AnswerPreparationAnalyzer()

      // Act
      const model = analyzer.analyzeStep(context)

      // Assert
      expect(model.fields).toHaveLength(1)
      expect(model.fields[0].source).toBe(fieldBlock)
      expect(model.fields[0].iteratorPath).toEqual([])
      expect(model.fields[0].component.variant).toBe('TextInput')
    })
  })

  describe('analyzeJourney()', () => {
    it('should aggregate the owned steps field models in step order when the journey owns steps', () => {
      // Arrange
      const nodeIndex = new ASTNodeIndex()
      const journeyNode = ASTTestFactory.journey().build()
      const firstStep = ASTTestFactory.step().withPath('/first').build()
      const secondStep = ASTTestFactory.step().withPath('/second').build()
      const firstField = ASTTestFactory.block('TextInput', BlockType.FIELD).withCode('first').build()
      const secondField = ASTTestFactory.block('TextInput', BlockType.FIELD).withCode('second').build()

      setParent(firstStep, journeyNode)
      setParent(secondStep, journeyNode)
      setParent(firstField, firstStep)
      setParent(secondField, secondStep)
      nodeIndex.register(journeyNode.id, journeyNode)
      nodeIndex.register(firstStep.id, firstStep)
      nodeIndex.register(secondStep.id, secondStep)
      nodeIndex.register(firstField.id, firstField)
      nodeIndex.register(secondField.id, secondField)

      const context = createJourneyAnalysisContext({ journeyNode, nodeIndex })
      const analyzer = new AnswerPreparationAnalyzer()

      // Act
      const model = analyzer.analyzeJourney(context)

      // Assert
      expect(model.fields.map(field => field.source)).toEqual([firstField, secondField])
    })
  })
})
