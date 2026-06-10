import ASTNodeIndex from '../ast/ast-state/ASTNodeIndex'
import ASTNodeTree from '../ast/ast-state/ASTNodeTree'
import { AstNodeId } from '../contracts/ast/engine.type'
import {
  AccessHookASTNode,
  RedirectOutcomeASTNode,
  ReferenceASTNode,
  SubmitHookASTNode,
} from '../contracts/ast/expressions.type'
import { JourneyASTNode, StepASTNode } from '../contracts/ast/structures.type'
import { TestPredicateASTNode } from '../contracts/ast/predicates.type'
import { BlockType, HookType, PredicateType } from '../../authoring/types/enums'
import { ASTTestFactory } from '../ast/testing-helpers/ASTTestFactory'
import type { CompilationPlan, ReachabilityCompilationPlan } from '../contracts/plans/compilationPlan.type'
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

function createSubmitHookWithRedirect(
  id: AstNodeId,
  options: { when?: TestPredicateASTNode; goto: string } = { goto: '/journey/next' },
): { hook: SubmitHookASTNode; redirect: RedirectOutcomeASTNode } {
  const redirect = ASTTestFactory.redirectOutcome({ goto: options.goto })
  const builder = ASTTestFactory.hook(HookType.SUBMIT)
    .withId(id)
    .withProperty('validate', false)
    .withProperty('onAlways', { next: [redirect] })

  if (options.when !== undefined) {
    builder.withProperty('when', options.when)
  }

  return { hook: builder.build() as SubmitHookASTNode, redirect }
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

function getReachabilityPlan(plan: CompilationPlan, journeyId: AstNodeId): ReachabilityCompilationPlan {
  const reachabilityPlan = plan.reachabilityPlans.get(journeyId)

  if (!reachabilityPlan) {
    throw new Error(`Expected reachability plan for journey "${journeyId}"`)
  }

  return reachabilityPlan
}

describe('CompilationPlanner', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('buildPlan()', () => {
    it('should build step runtime plan with merged static data from ancestors', () => {
      // Arrange
      const nodeRegistry = new ASTNodeIndex()
      const astNodeTree = new ASTNodeTree()
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
      nodeRegistry.register(journey.id, journey)
      nodeRegistry.register(step.id, step)

      astNodeTree.addNode(journey.id)
      astNodeTree.addNode(step.id, journey.id)

      const planner = new CompilationPlanner(nodeRegistry, astNodeTree)

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
      const nodeRegistry = new ASTNodeIndex()
      const astNodeTree = new ASTNodeTree()
      const journey = createJourney('compile_ast:1', [])
      const step = createStep('compile_ast:2')

      nodeRegistry.register(journey.id, journey)
      nodeRegistry.register(step.id, step)
      astNodeTree.addNode(journey.id)
      astNodeTree.addNode(step.id, journey.id)

      const planner = new CompilationPlanner(nodeRegistry, astNodeTree)

      // Act
      const plan = planner.buildPlan(new Map([[step.id, step]]), new Map([[journey.id, journey]]))

      // Assert
      expect(plan.navigationPlanIdByStepId.get(step.id)).toBe(journey.id)
      expect(getReachabilityPlan(plan, journey.id).unreachableRedirect).toBe('entry')
    })

    it('should store configured unreachable redirect on the navigation plan', () => {
      // Arrange
      const nodeRegistry = new ASTNodeIndex()
      const astNodeTree = new ASTNodeTree()
      const journey = createJourney('compile_ast:1', [])
      const step = createStep('compile_ast:2')

      journey.properties.reachability = { unreachableRedirect: 'frontier' }
      nodeRegistry.register(journey.id, journey)
      nodeRegistry.register(step.id, step)
      astNodeTree.addNode(journey.id)
      astNodeTree.addNode(step.id, journey.id)

      const planner = new CompilationPlanner(nodeRegistry, astNodeTree)

      // Act
      const plan = planner.buildPlan(new Map([[step.id, step]]), new Map([[journey.id, journey]]))

      // Assert
      expect(plan.navigationPlanIdByStepId.get(step.id)).toBe(journey.id)
      expect(getReachabilityPlan(plan, journey.id).unreachableRedirect).toBe('frontier')
    })

    it('should preserve hook grouping in forward outcomes', () => {
      // Arrange
      const nodeRegistry = new ASTNodeIndex()
      const astNodeTree = new ASTNodeTree()
      const journey = createJourney('compile_ast:100', [])
      const { hook: hook1, redirect: redirect1 } = createSubmitHookWithRedirect('compile_ast:110', { goto: '/check' })
      const { hook: hook2, redirect: redirect2 } = createSubmitHookWithRedirect('compile_ast:111', { goto: '/add' })
      const step = createStep('compile_ast:101', { onSubmission: [hook1, hook2] })

      nodeRegistry.register(journey.id, journey)
      nodeRegistry.register(step.id, step)
      nodeRegistry.register(redirect1.id, redirect1)
      nodeRegistry.register(redirect2.id, redirect2)
      astNodeTree.addNode(journey.id)
      astNodeTree.addNode(step.id, journey.id)

      const planner = new CompilationPlanner(nodeRegistry, astNodeTree)

      // Act
      const plan = planner.buildPlan(new Map([[step.id, step]]), new Map([[journey.id, journey]]))

      // Assert
      const reachabilityEntry = getReachabilityPlan(plan, journey.id).entries[0]

      expect(reachabilityEntry.forwardOutcomeGroups).toEqual([
        { outcomeIds: [redirect1.id], hookWhenNodeId: undefined },
        { outcomeIds: [redirect2.id], hookWhenNodeId: undefined },
      ])
    })

    it('should carry entry validation inputs and field inventory sources', () => {
      // Arrange
      const nodeRegistry = new ASTNodeIndex()
      const astNodeTree = new ASTNodeTree()
      const journey = createJourney('compile_ast:1', [])
      const step = createStep('compile_ast:2')
      const field = ASTTestFactory.block('text', BlockType.FIELD)
        .withId('compile_ast:3')
        .withProperty('code', 'name')
        .build()

      step.properties.cleardownFieldCodes = ['stale-name']
      step.properties.validateOnEntry = [{ id: 'compile_ast:4', groups: ['initial'], when: true }]
      nodeRegistry.register(journey.id, journey)
      nodeRegistry.register(step.id, step)
      nodeRegistry.register(field.id, field)
      astNodeTree.addNode(journey.id)
      astNodeTree.addNode(step.id, journey.id)
      astNodeTree.addNode(field.id, step.id)

      const planner = new CompilationPlanner(nodeRegistry, astNodeTree)

      // Act
      const plan = planner.buildPlan(new Map([[step.id, step]]), new Map([[journey.id, journey]]))

      // Assert
      const reachabilityEntry = getReachabilityPlan(plan, journey.id).entries[0]

      expect(plan.stepInputs.get(step.id)?.entryValidations).toEqual(step.properties.validateOnEntry)
      expect(reachabilityEntry.fieldInventorySource).toMatchObject({
        stepId: step.id,
        fieldBlocks: [field],
        iterateNodes: [],
        cleardownFieldCodes: ['stale-name'],
      })
    })

    it('should collect statically-declared gotos across hooks onto the entries', () => {
      // Arrange
      const nodeRegistry = new ASTNodeIndex()
      const astNodeTree = new ASTNodeTree()
      const journey = createJourney('compile_ast:400', [])
      const { hook: hook1, redirect: redirect1 } = createSubmitHookWithRedirect('compile_ast:410', { goto: '/check' })
      const { hook: hook2, redirect: redirect2 } = createSubmitHookWithRedirect('compile_ast:411', { goto: '/add' })
      const step = createStep('compile_ast:401', { onSubmission: [hook1, hook2] })

      nodeRegistry.register(journey.id, journey)
      nodeRegistry.register(step.id, step)
      nodeRegistry.register(redirect1.id, redirect1)
      nodeRegistry.register(redirect2.id, redirect2)
      astNodeTree.addNode(journey.id)
      astNodeTree.addNode(step.id, journey.id)

      const planner = new CompilationPlanner(nodeRegistry, astNodeTree)

      // Act
      const plan = planner.buildPlan(new Map([[step.id, step]]), new Map([[journey.id, journey]]))

      // Assert
      expect(getReachabilityPlan(plan, journey.id).entries[0].declaredOutcomes).toEqual(['/check', '/add'])
    })

    it('should preserve a compilable hook when on its forward outcome group', () => {
      // Arrange
      const nodeRegistry = new ASTNodeIndex()
      const astNodeTree = new ASTNodeTree()
      const journey = createJourney('compile_ast:200', [])
      const hookWhen = ASTTestFactory.predicate(PredicateType.TEST, {
        subject: ASTTestFactory.reference(['answers', 'route']),
        condition: ASTTestFactory.functionExpression('CONDITION' as never, 'equals', ['a']),
      }) as TestPredicateASTNode
      const { hook, redirect } = createSubmitHookWithRedirect('compile_ast:210', {
        when: hookWhen,
        goto: '/route-a',
      })
      const step = createStep('compile_ast:201', { onSubmission: [hook] })

      nodeRegistry.register(journey.id, journey)
      nodeRegistry.register(step.id, step)
      nodeRegistry.register(redirect.id, redirect)
      nodeRegistry.register(hookWhen.id, hookWhen)
      astNodeTree.addNode(journey.id)
      astNodeTree.addNode(step.id, journey.id)

      const planner = new CompilationPlanner(nodeRegistry, astNodeTree)

      // Act
      const plan = planner.buildPlan(new Map([[step.id, step]]), new Map([[journey.id, journey]]))

      // Assert
      const reachabilityEntry = getReachabilityPlan(plan, journey.id).entries[0]

      expect(reachabilityEntry.forwardOutcomeGroups).toEqual([
        { outcomeIds: [redirect.id], hookWhenNodeId: hookWhen.id },
      ])
    })

    it('should drop hookWhenNodeId for predicates that reference request-time namespaces', () => {
      // Arrange — Post('action').match(...) references the request-time `post` namespace.
      // Reachability would resolve it against the wrong context, so the planner must screen
      // it out and let the compiler over-approximate by contributing outcomes unguarded.
      const nodeRegistry = new ASTNodeIndex()
      const astNodeTree = new ASTNodeTree()
      const journey = createJourney('compile_ast:300', [])
      const postReference = ASTTestFactory.reference(['post', 'action']) as ReferenceASTNode
      const hookWhen = ASTTestFactory.predicate(PredicateType.TEST, {
        subject: postReference,
        condition: ASTTestFactory.functionExpression('CONDITION' as never, 'equals', ['continue']),
      }) as TestPredicateASTNode
      const { hook, redirect } = createSubmitHookWithRedirect('compile_ast:310', {
        when: hookWhen,
        goto: '/check',
      })
      const step = createStep('compile_ast:301', { onSubmission: [hook] })

      nodeRegistry.register(journey.id, journey)
      nodeRegistry.register(step.id, step)
      nodeRegistry.register(redirect.id, redirect)
      nodeRegistry.register(hookWhen.id, hookWhen)
      astNodeTree.addNode(journey.id)
      astNodeTree.addNode(step.id, journey.id)

      const planner = new CompilationPlanner(nodeRegistry, astNodeTree)

      // Act
      const plan = planner.buildPlan(new Map([[step.id, step]]), new Map([[journey.id, journey]]))

      // Assert
      const reachabilityEntry = getReachabilityPlan(plan, journey.id).entries[0]

      expect(reachabilityEntry.forwardOutcomeGroups).toEqual([{ outcomeIds: [redirect.id], hookWhenNodeId: undefined }])
    })

    it('should not inherit unreachable redirect from ancestor journeys', () => {
      // Arrange
      const nodeRegistry = new ASTNodeIndex()
      const astNodeTree = new ASTNodeTree()
      const parentJourney = createJourney('compile_ast:1', [])
      const childJourney = createJourney('compile_ast:2', [])
      const step = createStep('compile_ast:3')

      parentJourney.properties.reachability = { unreachableRedirect: 'frontier' }
      nodeRegistry.register(parentJourney.id, parentJourney)
      nodeRegistry.register(childJourney.id, childJourney)
      nodeRegistry.register(step.id, step)
      astNodeTree.addNode(parentJourney.id)
      astNodeTree.addNode(childJourney.id, parentJourney.id)
      astNodeTree.addNode(step.id, childJourney.id)

      const planner = new CompilationPlanner(nodeRegistry, astNodeTree)

      // Act
      const plan = planner.buildPlan(
        new Map([[step.id, step]]),
        new Map([
          [parentJourney.id, parentJourney],
          [childJourney.id, childJourney],
        ]),
      )

      // Assert
      expect(plan.navigationPlanIdByStepId.get(step.id)).toBe(childJourney.id)
      expect(getReachabilityPlan(plan, childJourney.id).unreachableRedirect).toBe('entry')
    })
  })
})
