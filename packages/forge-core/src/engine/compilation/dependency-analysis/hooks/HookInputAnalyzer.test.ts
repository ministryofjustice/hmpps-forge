import { HookType } from '../../../../authoring/types/enums'
import ASTNodeIndex from '../../ast/ast-state/ASTNodeIndex'
import ASTNodeTree from '../../ast/ast-state/ASTNodeTree'
import { ASTTestFactory } from '../../ast/testing-helpers/ASTTestFactory'
import HookInputAnalyzer from './HookInputAnalyzer'

describe('HookInputAnalyzer', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('buildInputs()', () => {
    it('should return access hooks from ancestors and submit hooks from the step', () => {
      // Arrange
      const nodeRegistry = new ASTNodeIndex()
      const astNodeTree = new ASTNodeTree()
      const journeyAccessHook = ASTTestFactory.hook(HookType.ACCESS).build()
      const stepAccessHook = ASTTestFactory.hook(HookType.ACCESS).build()
      const submitHook = ASTTestFactory.hook(HookType.SUBMIT).build()
      const journeyNode = ASTTestFactory.journey().withProperty('onAccess', [journeyAccessHook]).build()
      const stepNode = ASTTestFactory.step()
        .withPath('/step')
        .withProperty('onAccess', [stepAccessHook])
        .withProperty('onSubmission', [submitHook])
        .build()

      nodeRegistry.register(journeyNode.id, journeyNode)
      nodeRegistry.register(stepNode.id, stepNode)
      astNodeTree.addNode(journeyNode.id)
      astNodeTree.addNode(stepNode.id, journeyNode.id)

      const analyzer = new HookInputAnalyzer(nodeRegistry, astNodeTree)

      // Act
      const result = analyzer.buildInputs(stepNode)

      // Assert
      expect(result.accessHooks).toEqual([journeyAccessHook, stepAccessHook])
      expect(result.submitHooks).toEqual([submitHook])
    })
  })

  describe('resolveAccessHooks()', () => {
    it('should flatten access hooks from outer journey to current step', () => {
      // Arrange
      const nodeRegistry = new ASTNodeIndex()
      const astNodeTree = new ASTNodeTree()
      const parentAccessHook = ASTTestFactory.hook(HookType.ACCESS).build()
      const childAccessHook = ASTTestFactory.hook(HookType.ACCESS).build()
      const stepAccessHook = ASTTestFactory.hook(HookType.ACCESS).build()
      const parentJourneyNode = ASTTestFactory.journey()
        .withProperty('onAccess', [parentAccessHook])
        .build()
      const childJourneyNode = ASTTestFactory.journey()
        .withProperty('onAccess', [childAccessHook])
        .build()
      const stepNode = ASTTestFactory.step()
        .withProperty('onAccess', [stepAccessHook])
        .build()

      nodeRegistry.register(parentJourneyNode.id, parentJourneyNode)
      nodeRegistry.register(childJourneyNode.id, childJourneyNode)
      nodeRegistry.register(stepNode.id, stepNode)
      astNodeTree.addNode(parentJourneyNode.id)
      astNodeTree.addNode(childJourneyNode.id, parentJourneyNode.id)
      astNodeTree.addNode(stepNode.id, childJourneyNode.id)

      const analyzer = new HookInputAnalyzer(nodeRegistry, astNodeTree)

      // Act
      const result = analyzer.resolveAccessHooks(stepNode.id)

      // Assert
      expect(result).toEqual([parentAccessHook, childAccessHook, stepAccessHook])
    })
  })
})
