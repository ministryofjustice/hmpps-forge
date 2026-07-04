import { BlockType, ExpressionType, IteratorType } from '../../../../authoring/types/enums'
import { ASTNodeType } from '../../../contracts/ast/enums'
import type { ASTNode } from '../../../contracts/ast/engine.type'
import type { IterateASTNode } from '../../../contracts/ast/expressions.type'
import ASTNodeIndex from '../../ast/ast-state/ASTNodeIndex'
import { ASTTestFactory } from '../../ast/testing-helpers/ASTTestFactory'
import FieldInventoryAnalyzer from './FieldInventoryAnalyzer'

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

  describe('buildFieldInventorySources()', () => {
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

      const analyzer = new FieldInventoryAnalyzer(nodeRegistry)

      // Act
      const result = analyzer.buildFieldInventorySources({
        stateTable: {
          entries: [],
          resumeConfigured: false,
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
      expect(result).toEqual([
        {
          stepId: stepNode.id,
          fieldBlocks: [fieldBlock],
          iterateNodes: [iterateNode],
          cleardownFieldCodes: ['fieldA'],
        },
      ])
    })
  })
})
