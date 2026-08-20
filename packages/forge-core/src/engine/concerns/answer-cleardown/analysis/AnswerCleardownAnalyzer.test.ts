import { BlockType, ExpressionType, IteratorType } from '../../../../authoring/types/enums'
import { ASTNodeType } from '../../../chassis/contracts/ast/enums'
import type { ASTNode } from '../../../chassis/contracts/ast/engine.type'
import type { IterateASTNode } from '../../../chassis/contracts/ast/expressions.type'
import ASTNodeIndex from '../../../chassis/compilation/ast/ast-state/ASTNodeIndex'
import { ASTTestFactory } from '../../../chassis/compilation/ast/testing-helpers/ASTTestFactory'
import { createJourneyAnalysisContext } from '../../../chassis/compilation/analysis/testing-helpers/analysisContexts'
import AnswerCleardownAnalyzer from './AnswerCleardownAnalyzer'

function setParent(child: ASTNode, parent: ASTNode): void {
  Object.defineProperty(child, 'parent', { value: parent, enumerable: false })
}

function createMapIterateNode(): IterateASTNode {
  return {
    type: ASTNodeType.EXPRESSION,
    expressionType: ExpressionType.ITERATE,
    id: ASTTestFactory.getId(),
    properties: {
      input: ASTTestFactory.reference(['data', 'items']),
      iterator: {
        type: IteratorType.MAP,
      },
    },
  } as IterateASTNode
}

describe('AnswerCleardownAnalyzer', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('analyzeJourney()', () => {
    it('should model one inventory entry per owned step in document order', () => {
      // Arrange
      const nodeIndex = new ASTNodeIndex()
      const journeyNode = ASTTestFactory.journey().build()
      const stepNode = ASTTestFactory.step()
        .withPath('/step')
        .withProperty('cleardownFieldCodes', ['fieldA'])
        .build()
      const fieldBlock = ASTTestFactory.block('TextInput', BlockType.FIELD).withCode('fieldA').build()
      const iterateNode = createMapIterateNode()

      setParent(stepNode, journeyNode)
      setParent(fieldBlock, stepNode)
      setParent(iterateNode, stepNode)
      nodeIndex.register(journeyNode.id, journeyNode)
      nodeIndex.register(stepNode.id, stepNode)
      nodeIndex.register(fieldBlock.id, fieldBlock)
      nodeIndex.register(iterateNode.id, iterateNode)

      const context = createJourneyAnalysisContext({ journeyNode, nodeIndex })
      const analyzer = new AnswerCleardownAnalyzer()

      // Act
      const model = analyzer.analyzeJourney(context)

      // Assert
      expect(model.steps).toHaveLength(1)
      expect(model.steps[0].stepId).toBe(stepNode.id)
      expect(model.steps[0].cleardownFieldCodes).toEqual(['fieldA'])
      expect(model.steps[0].fields.map(field => field.source)).toEqual([fieldBlock])
    })

    it('should default cleardown field codes to empty when the step declares none', () => {
      // Arrange
      const nodeIndex = new ASTNodeIndex()
      const journeyNode = ASTTestFactory.journey().build()
      const stepNode = ASTTestFactory.step().withPath('/step').build()

      setParent(stepNode, journeyNode)
      nodeIndex.register(journeyNode.id, journeyNode)
      nodeIndex.register(stepNode.id, stepNode)

      const context = createJourneyAnalysisContext({ journeyNode, nodeIndex })
      const analyzer = new AnswerCleardownAnalyzer()

      // Act
      const model = analyzer.analyzeJourney(context)

      // Assert
      expect(model.steps).toEqual([
        {
          stepId: stepNode.id,
          fields: [],
          cleardownFieldCodes: [],
        },
      ])
    })
  })
})
