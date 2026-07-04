import { BlockType, FunctionType, PredicateType } from '../../../../authoring/types/enums'
import ASTNodeIndex from '../../ast/ast-state/ASTNodeIndex'
import ASTNodeTree from '../../ast/ast-state/ASTNodeTree'
import { ASTTestFactory } from '../../ast/testing-helpers/ASTTestFactory'
import type { JourneyASTNode, StepASTNode } from '../../../contracts/ast/structures.type'
import type { TestPredicateASTNode } from '../../../contracts/ast/predicates.type'
import FieldInventoryAnalyzer from '../shared/FieldInventoryAnalyzer'
import RuntimePlanAnalyzer from '../shared/RuntimePlanAnalyzer'
import ReachabilityPlanAnalyzer from './ReachabilityPlanAnalyzer'

function createPredicate(path: string[]): TestPredicateASTNode {
  return ASTTestFactory.predicate(PredicateType.TEST, {
    subject: ASTTestFactory.reference(path),
    condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, 'equals', ['yes']),
  }) as TestPredicateASTNode
}

function createAnalyzer(nodeRegistry: ASTNodeIndex, astNodeTree: ASTNodeTree): ReachabilityPlanAnalyzer {
  const fieldInventoryAnalyzer = new FieldInventoryAnalyzer(nodeRegistry, astNodeTree)
  const runtimePlanAnalyzer = new RuntimePlanAnalyzer(nodeRegistry, astNodeTree)

  return new ReachabilityPlanAnalyzer(fieldInventoryAnalyzer, runtimePlanAnalyzer)
}

function registerJourneyStep(
  nodeRegistry: ASTNodeIndex,
  astNodeTree: ASTNodeTree,
  journeyNode: JourneyASTNode,
  stepNode: StepASTNode,
): void {
  nodeRegistry.register(journeyNode.id, journeyNode)
  nodeRegistry.register(stepNode.id, stepNode)
  astNodeTree.addNode(journeyNode.id)
  astNodeTree.addNode(stepNode.id, journeyNode.id)
}

describe('ReachabilityPlanAnalyzer', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('buildReachabilityPlan()', () => {
    it('should default unreachable redirect to entry when omitted', () => {
      // Arrange
      const nodeRegistry = new ASTNodeIndex()
      const astNodeTree = new ASTNodeTree()
      const journeyNode = ASTTestFactory.journey().build()
      const stepNode = ASTTestFactory.step().withCode('step').build()

      registerJourneyStep(nodeRegistry, astNodeTree, journeyNode, stepNode)

      const analyzer = createAnalyzer(nodeRegistry, astNodeTree)

      // Act
      const result = analyzer.buildReachabilityPlan([stepNode], journeyNode, new Map([[journeyNode.id, journeyNode]]))

      // Assert
      expect(result.stateTable.unreachableRedirect).toBe('entry')
    })

    it('should store configured unreachable redirect without inheriting ancestor values', () => {
      // Arrange
      const nodeRegistry = new ASTNodeIndex()
      const astNodeTree = new ASTNodeTree()
      const parentJourneyNode = ASTTestFactory.journey()
        .withProperty('reachability', { unreachableRedirect: 'frontier' })
        .build()
      const childJourneyNode = ASTTestFactory.journey().build()
      const stepNode = ASTTestFactory.step().withCode('step').build()

      nodeRegistry.register(parentJourneyNode.id, parentJourneyNode)
      nodeRegistry.register(childJourneyNode.id, childJourneyNode)
      nodeRegistry.register(stepNode.id, stepNode)
      astNodeTree.addNode(parentJourneyNode.id)
      astNodeTree.addNode(childJourneyNode.id, parentJourneyNode.id)
      astNodeTree.addNode(stepNode.id, childJourneyNode.id)

      const analyzer = createAnalyzer(nodeRegistry, astNodeTree)

      // Act
      const result = analyzer.buildReachabilityPlan(
        [stepNode],
        childJourneyNode,
        new Map([
          [parentJourneyNode.id, parentJourneyNode],
          [childJourneyNode.id, childJourneyNode],
        ]),
      )

      // Assert
      expect(result.stateTable.unreachableRedirect).toBe('entry')
    })

    it('should inherit disabled reachability from the parent journey when the journey has no own setting', () => {
      // Arrange
      const nodeRegistry = new ASTNodeIndex()
      const astNodeTree = new ASTNodeTree()
      const parentJourneyNode = ASTTestFactory.journey()
        .withProperty('reachability', { disableReachabilityChecks: true })
        .build()
      const childJourneyNode = ASTTestFactory.journey().build()
      const stepNode = ASTTestFactory.step().withCode('step').build()

      registerJourneyStep(nodeRegistry, astNodeTree, childJourneyNode, stepNode)
      nodeRegistry.register(parentJourneyNode.id, parentJourneyNode)
      astNodeTree.addNode(childJourneyNode.id, parentJourneyNode.id)

      const analyzer = createAnalyzer(nodeRegistry, astNodeTree)

      // Act
      const result = analyzer.buildReachabilityPlan(
        [stepNode],
        childJourneyNode,
        new Map([
          [parentJourneyNode.id, parentJourneyNode],
          [childJourneyNode.id, childJourneyNode],
        ]),
      )

      // Assert
      expect(result.stateTable.reachabilityDisabled).toBe(true)
    })

    it('should inherit disabled reachability from a distant ancestor when nearer journeys have no own setting', () => {
      // Arrange
      const nodeRegistry = new ASTNodeIndex()
      const astNodeTree = new ASTNodeTree()
      const grandparentJourneyNode = ASTTestFactory.journey()
        .withProperty('reachability', { disableReachabilityChecks: true })
        .build()
      const parentJourneyNode = ASTTestFactory.journey().build()
      const childJourneyNode = ASTTestFactory.journey().build()
      const stepNode = ASTTestFactory.step().withCode('step').build()

      registerJourneyStep(nodeRegistry, astNodeTree, childJourneyNode, stepNode)
      nodeRegistry.register(parentJourneyNode.id, parentJourneyNode)
      nodeRegistry.register(grandparentJourneyNode.id, grandparentJourneyNode)
      astNodeTree.addNode(childJourneyNode.id, parentJourneyNode.id)
      astNodeTree.addNode(parentJourneyNode.id, grandparentJourneyNode.id)

      const analyzer = createAnalyzer(nodeRegistry, astNodeTree)

      // Act
      const result = analyzer.buildReachabilityPlan(
        [stepNode],
        childJourneyNode,
        new Map([
          [grandparentJourneyNode.id, grandparentJourneyNode],
          [parentJourneyNode.id, parentJourneyNode],
          [childJourneyNode.id, childJourneyNode],
        ]),
      )

      // Assert
      expect(result.stateTable.reachabilityDisabled).toBe(true)
    })

    it("should use the journey's own reachability setting when an ancestor sets a different value", () => {
      // Arrange
      const nodeRegistry = new ASTNodeIndex()
      const astNodeTree = new ASTNodeTree()
      const parentJourneyNode = ASTTestFactory.journey()
        .withProperty('reachability', { disableReachabilityChecks: false })
        .build()
      const childJourneyNode = ASTTestFactory.journey()
        .withProperty('reachability', { disableReachabilityChecks: true })
        .build()
      const stepNode = ASTTestFactory.step().withCode('step').build()

      registerJourneyStep(nodeRegistry, astNodeTree, childJourneyNode, stepNode)
      nodeRegistry.register(parentJourneyNode.id, parentJourneyNode)
      astNodeTree.addNode(childJourneyNode.id, parentJourneyNode.id)

      const analyzer = createAnalyzer(nodeRegistry, astNodeTree)

      // Act
      const result = analyzer.buildReachabilityPlan(
        [stepNode],
        childJourneyNode,
        new Map([
          [parentJourneyNode.id, parentJourneyNode],
          [childJourneyNode.id, childJourneyNode],
        ]),
      )

      // Assert
      expect(result.stateTable.reachabilityDisabled).toBe(true)
    })

    it("should keep the journey's own disabled reachability off when an ancestor enables it", () => {
      // Arrange
      const nodeRegistry = new ASTNodeIndex()
      const astNodeTree = new ASTNodeTree()
      const parentJourneyNode = ASTTestFactory.journey()
        .withProperty('reachability', { disableReachabilityChecks: true })
        .build()
      const childJourneyNode = ASTTestFactory.journey()
        .withProperty('reachability', { disableReachabilityChecks: false })
        .build()
      const stepNode = ASTTestFactory.step().withCode('step').build()

      registerJourneyStep(nodeRegistry, astNodeTree, childJourneyNode, stepNode)
      nodeRegistry.register(parentJourneyNode.id, parentJourneyNode)
      astNodeTree.addNode(childJourneyNode.id, parentJourneyNode.id)

      const analyzer = createAnalyzer(nodeRegistry, astNodeTree)

      // Act
      const result = analyzer.buildReachabilityPlan(
        [stepNode],
        childJourneyNode,
        new Map([
          [parentJourneyNode.id, parentJourneyNode],
          [childJourneyNode.id, childJourneyNode],
        ]),
      )

      // Assert
      expect(result.stateTable.reachabilityDisabled).toBe(false)
    })

    it('should build resume and reachability entry metadata in step order', () => {
      // Arrange
      const nodeRegistry = new ASTNodeIndex()
      const astNodeTree = new ASTNodeTree()
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

      nodeRegistry.register(journeyNode.id, journeyNode)
      nodeRegistry.register(firstStepNode.id, firstStepNode)
      nodeRegistry.register(secondStepNode.id, secondStepNode)
      nodeRegistry.register(validatingFieldBlock.id, validatingFieldBlock)
      astNodeTree.addNode(journeyNode.id)
      astNodeTree.addNode(firstStepNode.id, journeyNode.id)
      astNodeTree.addNode(secondStepNode.id, journeyNode.id)
      astNodeTree.addNode(validatingFieldBlock.id, firstStepNode.id)

      const analyzer = createAnalyzer(nodeRegistry, astNodeTree)

      // Act
      const result = analyzer.buildReachabilityPlan(
        [firstStepNode, secondStepNode],
        journeyNode,
        new Map([[journeyNode.id, journeyNode]]),
      )

      // Assert
      expect(result.resumeWhenNodeId).toBe(resumeWhen.id)
      expect(result.stateTable.resumeConfigured).toBe(true)
      expect(result.entries.map(entry => entry.stepId)).toEqual([firstStepNode.id, secondStepNode.id])
      expect(result.entries[0]).toMatchObject({
        stepId: firstStepNode.id,
        code: 'first',
        isEntryPoint: false,
        entryWhenNodeId: entryWhen.id,
        cleardownFieldCodes: ['fieldA'],
        reachabilityTieBreakers: [{ priority: 10, whenNodeId: tieBreakerWhen.id }],
      })
    })
  })
})
