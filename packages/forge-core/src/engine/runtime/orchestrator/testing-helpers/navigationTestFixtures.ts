import { joinPaths } from '../../../../framework/path/routePath'
import { NO_OP_RESPONSE_BINDINGS } from '../../../../framework/types/responseBindings.type'
import type { StepRequest } from '../../../../framework/types/request.type'
import type { NodeId } from '../../../contracts/ast/ast.type'
import type { JourneyRouteTemplateCatalog } from '../../../contracts/routing/routeTree.type'
import type { ValidationPlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { CompiledNavigationStep, NavigationRuntimePlan } from '../../../contracts/plans/runtimePlans.type'
import RuntimeEvaluationContext from '../../context/RuntimeEvaluationContext'
import type { PipelineState } from '../types'

const routePathsByStep = new WeakMap<CompiledNavigationStep, string>()

interface CompiledNavigationStepOptions {
  readonly nodeId: NodeId
  readonly path?: string
  readonly code?: string
  readonly isEntryPoint?: boolean
  readonly hasValidation?: boolean
  readonly cleardownFieldCodes?: readonly string[]
  readonly declaredOutcomes?: readonly string[]
  readonly evaluateEntryWhen?: CompiledNavigationStep['evaluateEntryWhen']
  readonly evaluateOutcomes?: CompiledNavigationStep['evaluateOutcomes']
  readonly evaluateTieBreaker?: CompiledNavigationStep['evaluateTieBreaker']
  readonly evaluateFieldCodes?: CompiledNavigationStep['evaluateFieldCodes']
}

interface PipelineStateOptions {
  readonly params?: Record<string, string>
  readonly method?: string
  readonly baseUrl?: string
  readonly pathname?: string
}

export function createCompiledNavigationStep(options: CompiledNavigationStepOptions): CompiledNavigationStep {
  const step: CompiledNavigationStep = {
    nodeId: options.nodeId,
    isEntryPoint: options.isEntryPoint ?? false,
    hasValidation: options.hasValidation ?? false,
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
    stepValidationPlans: new Map(),
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
  const routeTemplatePathByStepId = new Map<NodeId, string>()
  const stepIdByRouteTemplatePath = new Map<string, NodeId>()

  input.forEach(item => {
    const [stepId, routeTemplatePath] = isRouteTemplatePathTuple(item)
      ? item
      : [item.nodeId, resolveStepRouteTemplatePath(item)]

    routeTemplatePathByStepId.set(stepId, routeTemplatePath)
    stepIdByRouteTemplatePath.set(routeTemplatePath, stepId)
  })

  return {
    routeTemplatePathByStepId,
    stepIdByRouteTemplatePath,
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

export function createPipelineState(options: PipelineStateOptions = {}): PipelineState {
  const params = options.params ?? {}
  const baseUrl = options.baseUrl ?? '/forms/journey'
  const pathname = options.pathname ?? joinPaths(baseUrl, 'step')
  const method = options.method ?? 'GET'
  const request = {
    method,
    url: `http://localhost${pathname}`,
    baseUrl,
    location: {
      origin: 'http://localhost',
      href: `http://localhost${pathname}`,
      pathname,
      basePath: baseUrl,
    },
    getHeader: () => undefined,
    getAllHeaders: () => ({}),
    getCookie: () => undefined,
    getAllCookies: () => ({}),
    getParam: (name: string) => params[name],
    getParams: () => params,
    getQuery: () => undefined,
    getAllQuery: () => ({}),
    getPost: () => undefined,
    getAllPost: () => ({}),
    getSession: () => undefined,
    getState: () => undefined,
    getAllState: () => ({}),
  } as unknown as StepRequest
  const context = new RuntimeEvaluationContext(request)

  return { context, request, responseBindings: NO_OP_RESPONSE_BINDINGS }
}

function isRouteTemplatePathTuple(
  item: CompiledNavigationStep | readonly [NodeId, string],
): item is readonly [NodeId, string] {
  return Array.isArray(item)
}

function resolveStepRouteTemplatePath(step: CompiledNavigationStep): string {
  return joinPaths('/journey', routePathsByStep.get(step) ?? step.nodeId)
}
