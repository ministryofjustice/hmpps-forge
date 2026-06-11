import { joinPaths } from '../../../../framework/path/routePath'
import type { NodeId } from '../../../contracts/ast/ast.type'
import type { JourneyRouteTemplateCatalog } from '../../../contracts/routing/routeTree.type'
import type { ValidationPlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { CompiledNavigationStep, NavigationRuntimePlan } from '../../../contracts/plans/runtimePlans.type'

const routePathsByStep = new WeakMap<CompiledNavigationStep, string>()

const EMPTY_VALIDATION_PLAN: ValidationPlan = { fieldValidations: [], iteratorValidationGroups: [] }

interface CompiledNavigationStepOptions {
  readonly nodeId: NodeId
  readonly path?: string
  readonly code?: string
  readonly isEntryPoint?: boolean
  readonly validationPlan?: ValidationPlan
  readonly cleardownFieldCodes?: readonly string[]
  readonly declaredOutcomes?: readonly string[]
  readonly evaluateEntryWhen?: CompiledNavigationStep['evaluateEntryWhen']
  readonly evaluateOutcomes?: CompiledNavigationStep['evaluateOutcomes']
  readonly evaluateTieBreaker?: CompiledNavigationStep['evaluateTieBreaker']
  readonly evaluateFieldCodes?: CompiledNavigationStep['evaluateFieldCodes']
}

export function createCompiledNavigationStep(options: CompiledNavigationStepOptions): CompiledNavigationStep {
  const step: CompiledNavigationStep = {
    nodeId: options.nodeId,
    isEntryPoint: options.isEntryPoint ?? false,
    validationPlan: options.validationPlan ?? EMPTY_VALIDATION_PLAN,
    cleardownFieldCodes: options.cleardownFieldCodes ?? [],
    declaredOutcomes: options.declaredOutcomes ?? [],
    ...(options.code !== undefined ? { code: options.code } : {}),
    ...(options.evaluateEntryWhen !== undefined ? { evaluateEntryWhen: options.evaluateEntryWhen } : {}),
    ...(options.evaluateOutcomes !== undefined ? { evaluateOutcomes: options.evaluateOutcomes } : {}),
    ...(options.evaluateTieBreaker !== undefined ? { evaluateTieBreaker: options.evaluateTieBreaker } : {}),
    ...(options.evaluateFieldCodes !== undefined ? { evaluateFieldCodes: options.evaluateFieldCodes } : {}),
  }

  if (options.path !== undefined) {
    routePathsByStep.set(step, options.path)
  }

  return step
}

export function createNavigationPlan(
  steps: readonly CompiledNavigationStep[],
  overrides: Partial<NavigationRuntimePlan> = {},
): NavigationRuntimePlan {
  return {
    navigationSteps: steps,
    resumeConfigured: false,
    resumeAlways: false,
    unreachableRedirect: 'entry',
    reachabilityDisabled: false,
    ...overrides,
  }
}

export function createNavigationFixture(
  stepOptions: readonly CompiledNavigationStepOptions[],
  planOverrides: Partial<NavigationRuntimePlan> = {},
): { readonly plan: NavigationRuntimePlan; readonly routeTemplateCatalog: JourneyRouteTemplateCatalog } {
  const steps = stepOptions.map(createCompiledNavigationStep)
  const plan = createNavigationPlan(steps, planOverrides)
  const routeTemplateCatalog = createRouteTemplateCatalog(steps)

  return { plan, routeTemplateCatalog }
}

export function createRouteTemplateCatalog(
  input: readonly CompiledNavigationStep[] | readonly (readonly [NodeId, string])[],
): JourneyRouteTemplateCatalog {
  const routeTemplatePathByStepNodeId = new Map<NodeId, string>()
  const stepNodeIdByRouteTemplatePath = new Map<string, NodeId>()

  input.forEach(item => {
    const [stepNodeId, routeTemplatePath] = isRouteTemplatePathTuple(item)
      ? item
      : [item.nodeId, resolveStepRouteTemplatePath(item)]

    routeTemplatePathByStepNodeId.set(stepNodeId, routeTemplatePath)
    stepNodeIdByRouteTemplatePath.set(routeTemplatePath, stepNodeId)
  })

  return {
    routeTemplatePathByStepNodeId,
    stepNodeIdByRouteTemplatePath,
  }
}

export function createNavigationValidationPlan(isValid: boolean): ValidationPlan {
  return {
    fieldValidations: [
      {
        nodeId: 'compile_ast:999' as const,
        validate: () =>
          isValid
            ? []
            : [{ blockId: 'compile_ast:999' as const, passed: false, message: 'invalid', submissionOnly: false }],
      },
    ],
    iteratorValidationGroups: [],
  }
}

function isRouteTemplatePathTuple(
  item: CompiledNavigationStep | readonly [NodeId, string],
): item is readonly [NodeId, string] {
  return Array.isArray(item)
}

function resolveStepRouteTemplatePath(step: CompiledNavigationStep): string {
  return joinPaths('/journey', routePathsByStep.get(step) ?? step.nodeId)
}
