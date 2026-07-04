import { HookType } from '../../../../authoring/types/enums'
import type { ASTNode } from '../../../contracts/ast/engine.type'
import { ASTTestFactory } from '../../ast/testing-helpers/ASTTestFactory'
import HookInputAnalyzer from './HookInputAnalyzer'

function setParent(child: ASTNode, parent: ASTNode): void {
  Object.defineProperty(child, 'parent', { value: parent, enumerable: false })
}

describe('HookInputAnalyzer', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('buildInputs()', () => {
    it('should return access hooks from ancestors and submit hooks from the step', () => {
      // Arrange
      const journeyAccessHook = ASTTestFactory.hook(HookType.ACCESS).build()
      const stepAccessHook = ASTTestFactory.hook(HookType.ACCESS).build()
      const submitHook = ASTTestFactory.hook(HookType.SUBMIT).build()
      const journeyNode = ASTTestFactory.journey().withProperty('onAccess', [journeyAccessHook]).build()
      const stepNode = ASTTestFactory.step()
        .withPath('/step')
        .withProperty('onAccess', [stepAccessHook])
        .withProperty('onSubmission', [submitHook])
        .build()

      setParent(stepNode, journeyNode)

      const analyzer = new HookInputAnalyzer()

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
      const parentAccessHook = ASTTestFactory.hook(HookType.ACCESS).build()
      const childAccessHook = ASTTestFactory.hook(HookType.ACCESS).build()
      const stepAccessHook = ASTTestFactory.hook(HookType.ACCESS).build()
      const parentJourneyNode = ASTTestFactory.journey().withProperty('onAccess', [parentAccessHook]).build()
      const childJourneyNode = ASTTestFactory.journey().withProperty('onAccess', [childAccessHook]).build()
      const stepNode = ASTTestFactory.step().withProperty('onAccess', [stepAccessHook]).build()

      setParent(childJourneyNode, parentJourneyNode)
      setParent(stepNode, childJourneyNode)

      const analyzer = new HookInputAnalyzer()

      // Act
      const result = analyzer.resolveAccessHooks(stepNode)

      // Assert
      expect(result).toEqual([parentAccessHook, childAccessHook, stepAccessHook])
    })
  })
})
