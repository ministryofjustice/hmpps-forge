import { BlockType, FunctionType, PredicateType } from '../../../../authoring/types/enums'
import type { ASTNode } from '../../../chassis/contracts/ast/engine.type'
import ASTNodeIndex from '../../../chassis/compilation/ast/ast-state/ASTNodeIndex'
import { ASTTestFactory } from '../../../chassis/compilation/ast/testing-helpers/ASTTestFactory'
import type { TestPredicateASTNode } from '../../../chassis/contracts/ast/predicates.type'
import { createJourneyAnalysisContext } from '../../../chassis/compilation/analysis/testing-helpers/analysisContexts'
import ReachabilityAnalyzer from './ReachabilityAnalyzer'

function setParent(child: ASTNode, parent: ASTNode): void {
  Object.defineProperty(child, 'parent', { value: parent, enumerable: false })
}

function registerAll(nodeIndex: ASTNodeIndex, nodes: readonly ASTNode[]): void {
  nodes.forEach(node => nodeIndex.register(node.id, node))
}

function createPredicate(path: string[]): TestPredicateASTNode {
  return ASTTestFactory.predicate(PredicateType.TEST, {
    subject: ASTTestFactory.reference(path),
    condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, 'equals', ['yes']),
  }) as TestPredicateASTNode
}

describe('ReachabilityAnalyzer', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('analyzeJourney()', () => {
    it('should default unreachable redirect to entry when omitted', () => {
      // Arrange
      const nodeIndex = new ASTNodeIndex()
      const journeyNode = ASTTestFactory.journey().build()
      const stepNode = ASTTestFactory.step().withCode('step').build()

      setParent(stepNode, journeyNode)
      registerAll(nodeIndex, [journeyNode, stepNode])

      const analyzer = new ReachabilityAnalyzer()

      // Act
      const result = analyzer.analyzeJourney(
        createJourneyAnalysisContext({ journeyNode, stepNodes: [stepNode], nodeIndex }),
      )

      // Assert
      expect(result.stateTable.unreachableRedirect).toBe('entry')
    })

    it('should store configured unreachable redirect without inheriting ancestor values', () => {
      // Arrange
      const nodeIndex = new ASTNodeIndex()
      const parentJourneyNode = ASTTestFactory.journey()
        .withProperty('reachability', { unreachableRedirect: 'frontier' })
        .build()
      const childJourneyNode = ASTTestFactory.journey().build()
      const stepNode = ASTTestFactory.step().withCode('step').build()

      setParent(childJourneyNode, parentJourneyNode)
      setParent(stepNode, childJourneyNode)
      registerAll(nodeIndex, [parentJourneyNode, childJourneyNode, stepNode])

      const analyzer = new ReachabilityAnalyzer()

      // Act
      const result = analyzer.analyzeJourney(
        createJourneyAnalysisContext({ journeyNode: childJourneyNode, stepNodes: [stepNode], nodeIndex }),
      )

      // Assert
      expect(result.stateTable.unreachableRedirect).toBe('entry')
    })

    it('should inherit disabled reachability from the parent journey when the journey has no own setting', () => {
      // Arrange
      const nodeIndex = new ASTNodeIndex()
      const parentJourneyNode = ASTTestFactory.journey()
        .withProperty('reachability', { disableReachabilityChecks: true })
        .build()
      const childJourneyNode = ASTTestFactory.journey().build()
      const stepNode = ASTTestFactory.step().withCode('step').build()

      setParent(childJourneyNode, parentJourneyNode)
      setParent(stepNode, childJourneyNode)
      registerAll(nodeIndex, [parentJourneyNode, childJourneyNode, stepNode])

      const analyzer = new ReachabilityAnalyzer()

      // Act
      const result = analyzer.analyzeJourney(
        createJourneyAnalysisContext({ journeyNode: childJourneyNode, stepNodes: [stepNode], nodeIndex }),
      )

      // Assert
      expect(result.stateTable.reachabilityDisabled).toBe(true)
    })

    it('should inherit disabled reachability from a distant ancestor when nearer journeys have no own setting', () => {
      // Arrange
      const nodeIndex = new ASTNodeIndex()
      const grandparentJourneyNode = ASTTestFactory.journey()
        .withProperty('reachability', { disableReachabilityChecks: true })
        .build()
      const parentJourneyNode = ASTTestFactory.journey().build()
      const childJourneyNode = ASTTestFactory.journey().build()
      const stepNode = ASTTestFactory.step().withCode('step').build()

      setParent(parentJourneyNode, grandparentJourneyNode)
      setParent(childJourneyNode, parentJourneyNode)
      setParent(stepNode, childJourneyNode)
      registerAll(nodeIndex, [grandparentJourneyNode, parentJourneyNode, childJourneyNode, stepNode])

      const analyzer = new ReachabilityAnalyzer()

      // Act
      const result = analyzer.analyzeJourney(
        createJourneyAnalysisContext({ journeyNode: childJourneyNode, stepNodes: [stepNode], nodeIndex }),
      )

      // Assert
      expect(result.stateTable.reachabilityDisabled).toBe(true)
    })

    it("should use the journey's own reachability setting when an ancestor sets a different value", () => {
      // Arrange
      const nodeIndex = new ASTNodeIndex()
      const parentJourneyNode = ASTTestFactory.journey()
        .withProperty('reachability', { disableReachabilityChecks: false })
        .build()
      const childJourneyNode = ASTTestFactory.journey()
        .withProperty('reachability', { disableReachabilityChecks: true })
        .build()
      const stepNode = ASTTestFactory.step().withCode('step').build()

      setParent(childJourneyNode, parentJourneyNode)
      setParent(stepNode, childJourneyNode)
      registerAll(nodeIndex, [parentJourneyNode, childJourneyNode, stepNode])

      const analyzer = new ReachabilityAnalyzer()

      // Act
      const result = analyzer.analyzeJourney(
        createJourneyAnalysisContext({ journeyNode: childJourneyNode, stepNodes: [stepNode], nodeIndex }),
      )

      // Assert
      expect(result.stateTable.reachabilityDisabled).toBe(true)
    })

    it("should keep the journey's own disabled reachability off when an ancestor enables it", () => {
      // Arrange
      const nodeIndex = new ASTNodeIndex()
      const parentJourneyNode = ASTTestFactory.journey()
        .withProperty('reachability', { disableReachabilityChecks: true })
        .build()
      const childJourneyNode = ASTTestFactory.journey()
        .withProperty('reachability', { disableReachabilityChecks: false })
        .build()
      const stepNode = ASTTestFactory.step().withCode('step').build()

      setParent(childJourneyNode, parentJourneyNode)
      setParent(stepNode, childJourneyNode)
      registerAll(nodeIndex, [parentJourneyNode, childJourneyNode, stepNode])

      const analyzer = new ReachabilityAnalyzer()

      // Act
      const result = analyzer.analyzeJourney(
        createJourneyAnalysisContext({ journeyNode: childJourneyNode, stepNodes: [stepNode], nodeIndex }),
      )

      // Assert
      expect(result.stateTable.reachabilityDisabled).toBe(false)
    })

    it('should build resume and reachability entry metadata in step order', () => {
      // Arrange
      const nodeIndex = new ASTNodeIndex()
      const resumeWhen = createPredicate(['answers', 'resume'])
      const entryWhen = createPredicate(['answers', 'entry'])
      const tieBreakerWhen = createPredicate(['answers', 'priority'])
      const journeyNode = ASTTestFactory.journey()
        .withProperty('reachability', { resumeWhen })
        .build()
      const firstStepNode = ASTTestFactory.step()
        .withCode('first')
        .withProperty('cleardownFieldCodes', ['fieldA'])
        .withProperty('reachability', {
          entryWhen,
          tieBreakers: [
            {
              properties: {
                priority: 10,
                when: tieBreakerWhen,
              },
            },
          ],
        })
        .build()
      const secondStepNode = ASTTestFactory.step().withCode('second').build()
      const validatingFieldBlock = ASTTestFactory.block('TextInput', BlockType.FIELD)
        .withCode('fieldA')
        .withProperty('validWhen', [createPredicate(['answers', 'fieldA'])])
        .build()

      setParent(firstStepNode, journeyNode)
      setParent(secondStepNode, journeyNode)
      setParent(validatingFieldBlock, firstStepNode)
      registerAll(nodeIndex, [journeyNode, firstStepNode, secondStepNode, validatingFieldBlock])

      const analyzer = new ReachabilityAnalyzer()

      // Act
      const result = analyzer.analyzeJourney(
        createJourneyAnalysisContext({
          journeyNode,
          stepNodes: [firstStepNode, secondStepNode],
          nodeIndex,
        }),
      )

      // Assert
      expect(result.resumeWhen).toBe(resumeWhen)
      expect(result.entries.map(entry => entry.stepId)).toEqual([firstStepNode.id, secondStepNode.id])
      expect(result.entries[0]).toMatchObject({
        stepId: firstStepNode.id,
        code: 'first',
        isEntryPoint: false,
        entryWhen,
        cleardownFieldCodes: ['fieldA'],
        reachabilityTieBreakers: [{ priority: 10, when: tieBreakerWhen }],
      })
    })
  })
})
