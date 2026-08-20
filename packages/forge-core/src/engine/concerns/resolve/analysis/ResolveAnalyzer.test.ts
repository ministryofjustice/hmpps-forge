import { BlockType, ExpressionType, IteratorType } from '../../../../authoring/types/enums'
import type { ASTNode } from '../../../chassis/contracts/ast/engine.type'
import { ASTNodeType } from '../../../chassis/contracts/ast/enums'
import type { IterateASTNode } from '../../../chassis/contracts/ast/expressions.type'
import { AuthoredValueKind } from '../../../chassis/contracts/models/authoredValue.type'
import ASTNodeIndex from '../../../chassis/compilation/ast/ast-state/ASTNodeIndex'
import { ASTTestFactory } from '../../../chassis/compilation/ast/testing-helpers/ASTTestFactory'
import { compileTemplate } from '../../../chassis/compilation/ast/nodes/template'
import { NodeIDGenerator } from '../../../chassis/compilation/ast/ast-state/NodeIDGenerator'
import { createStepAnalysisContext } from '../../../chassis/compilation/analysis/testing-helpers/analysisContexts'
import ResolveAnalyzer from './ResolveAnalyzer'

function setParent(child: ASTNode, parent: ASTNode): void {
  Object.defineProperty(child, 'parent', { value: parent, enumerable: false })
}

function createIterateNode(yieldTemplate: unknown): IterateASTNode {
  return {
    type: ASTNodeType.EXPRESSION,
    expressionType: ExpressionType.ITERATE,
    id: ASTTestFactory.getId(),
    diagnostics: ASTTestFactory.diagnostics(),
    properties: {
      input: ASTTestFactory.reference(['data', 'members']),
      iterator: {
        type: IteratorType.MAP,
        yieldTemplate: compileTemplate(yieldTemplate, new NodeIDGenerator()),
      },
    },
  }
}

function blockTemplate(): unknown {
  return {
    type: ASTNodeType.BLOCK,
    variant: 'content',
    blockType: BlockType.BASIC,
    content: 'Hello',
  }
}

describe('ResolveAnalyzer', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('analyzeStep()', () => {
    it('should classify render-facing step properties and exclude skip props', () => {
      // Arrange
      const nodeIndex = new ASTNodeIndex()
      const journeyNode = ASTTestFactory.journey().build()
      const stepNode = ASTTestFactory.step().withPath('/step').withTitle('Step').build()

      setParent(stepNode, journeyNode)
      nodeIndex.register(journeyNode.id, journeyNode)
      nodeIndex.register(stepNode.id, stepNode)

      // Act
      const model = new ResolveAnalyzer().analyzeStep(createStepAnalysisContext({ stepNode, nodeIndex }))

      // Assert
      expect(model.step.map(property => property.key)).not.toContain('blocks')
      expect(model.step.find(property => property.key === 'title')?.value).toEqual({
        kind: AuthoredValueKind.STATIC,
        value: 'Step',
      })
      expect(model.blocks).toEqual([])
      expect(model.standaloneIterateBlocks).toEqual([])
    })

    it('should precompose ancestor paths when every path segment is static', () => {
      // Arrange
      const nodeIndex = new ASTNodeIndex()
      const outerJourney = ASTTestFactory.journey().withProperty('path', '/outer').build()
      const innerJourney = ASTTestFactory.journey().withProperty('path', '/inner').build()
      const stepNode = ASTTestFactory.step().withPath('/step').build()

      setParent(innerJourney, outerJourney)
      setParent(stepNode, innerJourney)
      nodeIndex.register(outerJourney.id, outerJourney)
      nodeIndex.register(innerJourney.id, innerJourney)
      nodeIndex.register(stepNode.id, stepNode)

      // Act
      const model = new ResolveAnalyzer().analyzeStep(createStepAnalysisContext({ stepNode, nodeIndex }))

      // Assert
      expect(model.ancestors.map(ancestor => ancestor.composedPath)).toEqual(['/outer', '/outer/inner'])
    })

    it('should partition iterators into inline and standalone when both are present', () => {
      // Arrange
      const nodeIndex = new ASTNodeIndex()
      const journeyNode = ASTTestFactory.journey().build()
      const inlineIterate = createIterateNode({ label: 'inline value' })
      const standaloneIterate = createIterateNode(blockTemplate())
      const skipPropIterate = createIterateNode(blockTemplate())
      const block = ASTTestFactory.block('collection-block', BlockType.BASIC)
        .withProperty('collection', inlineIterate)
        .withProperty('formatters', [skipPropIterate])
        .build()
      const stepNode = ASTTestFactory.step().withPath('/step').withProperty('blocks', [block]).build()

      setParent(stepNode, journeyNode)
      nodeIndex.register(journeyNode.id, journeyNode)
      nodeIndex.register(stepNode.id, stepNode)
      ;[inlineIterate, standaloneIterate, skipPropIterate].forEach(iterateNode => {
        setParent(iterateNode, stepNode)
        nodeIndex.register(iterateNode.id, iterateNode)
      })

      // Act
      const model = new ResolveAnalyzer().analyzeStep(createStepAnalysisContext({ stepNode, nodeIndex }))

      // Assert
      const standaloneIds = model.standaloneIterateBlocks.map(iterate => iterate.node.id)

      expect(standaloneIds).toContain(standaloneIterate.id)
      expect(standaloneIds).not.toContain(inlineIterate.id)
      // A skip-propped iterator never compiles as a value, so it stays standalone.
      expect(standaloneIds).toContain(skipPropIterate.id)
    })

    it('should prune skip props from nested block values', () => {
      // Arrange
      const nodeIndex = new ASTNodeIndex()
      const journeyNode = ASTTestFactory.journey().build()
      const nestedBlock = {
        type: ASTNodeType.BLOCK,
        variant: 'text-input',
        blockType: BlockType.FIELD,
        properties: { code: 'nested', formatters: ['trim'], hint: 'Keep me' },
      }
      const stepNode = ASTTestFactory.step().withPath('/step').withProperty('summaryBlock', nestedBlock).build()

      setParent(stepNode, journeyNode)
      nodeIndex.register(journeyNode.id, journeyNode)
      nodeIndex.register(stepNode.id, stepNode)

      // Act
      const model = new ResolveAnalyzer().analyzeStep(createStepAnalysisContext({ stepNode, nodeIndex }))

      // Assert
      const summaryBlock = model.step.find(property => property.key === 'summaryBlock')?.value

      expect(summaryBlock?.kind).toBe(AuthoredValueKind.BLOCK)

      if (summaryBlock?.kind === AuthoredValueKind.BLOCK) {
        expect(summaryBlock.entries.map(entry => entry.key)).toEqual(['code', 'hint'])
      }
    })
  })
})
