import { CompilationDependencies } from './CompilationDependencies'
import { AstNodeId } from '../types/engine.type'
import { AccessHookASTNode, SubmitHookASTNode } from '../types/expressions.type'
import { JourneyASTNode, StepASTNode } from '../types/structures.type'
import { HookType } from '../../authoring/types/enums'
import { ASTTestFactory } from '../../testing/ASTTestFactory'
import RuntimePlanBuilder from './RuntimePlanBuilder'

function createAccessHook(id: AstNodeId): AccessHookASTNode {
  return ASTTestFactory.hook(HookType.ACCESS)
    .withId(id)
    .build() as AccessHookASTNode
}

function createSubmitHook(id: AstNodeId): SubmitHookASTNode {
  return ASTTestFactory.hook(HookType.SUBMIT)
    .withId(id)
    .withProperty('validate', false)
    .build() as SubmitHookASTNode
}

function createJourney(id: AstNodeId, onAccess: AccessHookASTNode[]): JourneyASTNode {
  return ASTTestFactory.journey()
    .withId(id)
    .withProperty('path', '/journey')
    .withCode('journey')
    .withTitle('Journey')
    .withProperty('onAccess', onAccess)
    .build()
}

function createStep(
  id: AstNodeId,
  options: {
    onAccess?: AccessHookASTNode[]
    onSubmission?: SubmitHookASTNode[]
  } = {},
): StepASTNode {
  const step = ASTTestFactory.step()
    .withId(id)
    .withPath('/step')
    .withTitle('Step')

  if (options.onAccess) {
    step.withProperty('onAccess', options.onAccess)
  }

  if (options.onSubmission) {
    step.withProperty('onSubmission', options.onSubmission)
  }

  return step.build()
}

describe('RuntimePlanBuilder', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('buildStepRuntimePlan()', () => {
    it('should compile the step runtime topology from metadata and node registry', () => {
      // Arrange
      const dependencies = new CompilationDependencies()
      const journeyAccess = createAccessHook('compile_ast:1')
      const stepAccess = createAccessHook('compile_ast:2')
      const submit = createSubmitHook('compile_ast:4')
      const journey = createJourney('compile_ast:5', [journeyAccess])
      const step = createStep('compile_ast:6', {
        onAccess: [stepAccess],
        onSubmission: [submit],
      })

      dependencies.nodeRegistry.register(journey.id, journey)
      dependencies.nodeRegistry.register(step.id, step)

      dependencies.astNodeTree.addNode(journey.id)
      dependencies.astNodeTree.addNode(step.id, journey.id)

      const builder = new RuntimePlanBuilder(dependencies.nodeRegistry, dependencies.astNodeTree)

      // Act
      const result = builder.buildStepRuntimePlan(step)

      // Assert
      expect(result).toEqual({
        stepId: step.id,
        path: 'step',
        accessAncestorIds: [journey.id, step.id],
      })
    })
  })
})
