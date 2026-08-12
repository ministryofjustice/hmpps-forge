import { BlockType, ExpressionType, IteratorType } from '../../../../authoring/types/enums'
import { ASTNodeType } from '../../../contracts/ast/enums'
import type { ASTNode } from '../../../contracts/ast/engine.type'
import type { IterateASTNode } from '../../../contracts/ast/expressions.type'
import ASTNodeIndex from '../../../compilation/ast/ast-state/ASTNodeIndex'
import { ASTTestFactory } from '../../../compilation/ast/testing-helpers/ASTTestFactory'
import FieldInventoryAnalyzer from '../../../compilation/dependency-analysis/shared/FieldInventoryAnalyzer'
import AnswerCleardownInputAnalyzer from './AnswerCleardownInputAnalyzer'

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

describe('AnswerCleardownInputAnalyzer', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('buildInputs()', () => {
    it('should build field inventory sources from reachability entries', () => {
      // Arrange
      const nodeRegistry = new ASTNodeIndex()
      const stepNode = ASTTestFactory.step().build()
      const fieldBlock = ASTTestFactory.block('TextInput', BlockType.FIELD)
        .withCode('fieldA')
        .build()
      const iterateNode = createMapIterateNode()

      setParent(fieldBlock, stepNode)
      setParent(iterateNode, stepNode)
      nodeRegistry.register(stepNode.id, stepNode)
      nodeRegistry.register(fieldBlock.id, fieldBlock)
      nodeRegistry.register(iterateNode.id, iterateNode)

      const analyzer = new AnswerCleardownInputAnalyzer(new FieldInventoryAnalyzer(nodeRegistry))

      // Act
      const result = analyzer.buildInputs({
        stateTable: {
          entries: [],
          unreachableRedirect: 'entry',
          reachabilityDisabled: false,
        },
        entries: [
          {
            stepId: stepNode.id,
            isEntryPoint: false,
            forwardOutcomeGroups: [],
            cleardownFieldCodes: ['fieldA'],
            reachabilityTieBreakers: [],
          },
        ],
        resumeAlways: false,
      })

      // Assert
      expect(result).toEqual({
        fieldInventorySources: [
          {
            stepId: stepNode.id,
            fieldBlocks: [fieldBlock],
            iterateNodes: [iterateNode],
            cleardownFieldCodes: ['fieldA'],
          },
        ],
      })
    })
  })
})
