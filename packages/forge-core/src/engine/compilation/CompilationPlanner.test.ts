import { CompilationContext } from './CompilationContext'
import { AstNodeId } from '../types/engine.type'
import { AccessHookASTNode, SubmitHookASTNode } from '../types/expressions.type'
import { JourneyASTNode, StepASTNode } from '../types/structures.type'
import { HookType } from '../../authoring/types/enums'
import { ASTTestFactory } from '../../testing/ASTTestFactory'
import CompilationPlanner from './CompilationPlanner'

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

describe('CompilationPlanner', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('buildPlan()', () => {
    it('should build step runtime plan with merged static data from ancestors', () => {
      // Arrange
      const context = new CompilationContext()
      const journeyAccess = createAccessHook('compile_ast:1')
      const stepAccess = createAccessHook('compile_ast:2')
      const submit = createSubmitHook('compile_ast:4')
      const journey = createJourney('compile_ast:5', [journeyAccess])
      const step = createStep('compile_ast:6', {
        onAccess: [stepAccess],
        onSubmission: [submit],
      })

      journey.properties.data = { shared: 'journey', journeyOnly: true }
      step.properties.data = { shared: 'step', stepOnly: true }
      context.nodeRegistry.register(journey.id, journey)
      context.nodeRegistry.register(step.id, step)

      context.astNodeTree.addNode(journey.id)
      context.astNodeTree.addNode(step.id, journey.id)

      const planner = new CompilationPlanner(context.nodeRegistry, context.astNodeTree)

      // Act
      const plan = planner.buildPlan(new Map([[step.id, step]]), new Map([[journey.id, journey]]))

      // Assert
      const stepInputs = plan.stepInputs.get(step.id)

      expect(stepInputs?.runtimePlan).toEqual({
        stepId: step.id,
        path: 'step',
        staticData: {
          shared: 'step',
          journeyOnly: true,
          stepOnly: true,
        },
      })
    })

    it('should default unreachable redirect to entry when omitted', () => {
      // Arrange
      const context = new CompilationContext()
      const journey = createJourney('compile_ast:1', [])
      const step = createStep('compile_ast:2')

      context.nodeRegistry.register(journey.id, journey)
      context.nodeRegistry.register(step.id, step)
      context.astNodeTree.addNode(journey.id)
      context.astNodeTree.addNode(step.id, journey.id)

      const planner = new CompilationPlanner(context.nodeRegistry, context.astNodeTree)

      // Act
      const plan = planner.buildPlan(new Map([[step.id, step]]), new Map([[journey.id, journey]]))

      // Assert
      expect(plan.navigationPlansByStepId.get(step.id)?.unreachableRedirect).toBe('entry')
    })

    it('should store configured unreachable redirect on the navigation plan', () => {
      // Arrange
      const context = new CompilationContext()
      const journey = createJourney('compile_ast:1', [])
      const step = createStep('compile_ast:2')

      journey.properties.reachability = { unreachableRedirect: 'frontier' }
      context.nodeRegistry.register(journey.id, journey)
      context.nodeRegistry.register(step.id, step)
      context.astNodeTree.addNode(journey.id)
      context.astNodeTree.addNode(step.id, journey.id)

      const planner = new CompilationPlanner(context.nodeRegistry, context.astNodeTree)

      // Act
      const plan = planner.buildPlan(new Map([[step.id, step]]), new Map([[journey.id, journey]]))

      // Assert
      expect(plan.navigationPlansByStepId.get(step.id)?.unreachableRedirect).toBe('frontier')
    })

    it('should not inherit unreachable redirect from ancestor journeys', () => {
      // Arrange
      const context = new CompilationContext()
      const parentJourney = createJourney('compile_ast:1', [])
      const childJourney = createJourney('compile_ast:2', [])
      const step = createStep('compile_ast:3')

      parentJourney.properties.reachability = { unreachableRedirect: 'frontier' }
      context.nodeRegistry.register(parentJourney.id, parentJourney)
      context.nodeRegistry.register(childJourney.id, childJourney)
      context.nodeRegistry.register(step.id, step)
      context.astNodeTree.addNode(parentJourney.id)
      context.astNodeTree.addNode(childJourney.id, parentJourney.id)
      context.astNodeTree.addNode(step.id, childJourney.id)

      const planner = new CompilationPlanner(context.nodeRegistry, context.astNodeTree)

      // Act
      const plan = planner.buildPlan(
        new Map([[step.id, step]]),
        new Map([
          [parentJourney.id, parentJourney],
          [childJourney.id, childJourney],
        ]),
      )

      // Assert
      expect(plan.navigationPlansByStepId.get(step.id)?.unreachableRedirect).toBe('entry')
    })
  })
})
