import { joinPaths } from '../../../../framework/path/routePath'
import { NO_OP_RESPONSE_BINDINGS } from '../../../../framework/types/responseBindings.type'
import type { StepRequest } from '../../../../framework/types/request.type'
import type { NodeId } from '../../../contracts/ast/ast.type'
import type { JourneyRouteTemplateCatalog } from '../../../contracts/routing/routeTree.type'
import type { ValidationPlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { NavigationRuntimeEntry, NavigationRuntimePlan } from '../../../contracts/plans/runtimePlans.type'
import RuntimeEvaluationContext from '../../context/RuntimeEvaluationContext'
import type { PipelineState } from '../types'

const routePathsByEntry = new WeakMap<NavigationRuntimeEntry, string>()

interface NavigationEntryOptions {
  readonly stepId: NodeId
  readonly path?: string
  readonly code?: string
  readonly isEntryPoint?: boolean
  readonly hasValidation?: boolean
  readonly cleardownFieldCodes?: readonly string[]
  readonly declaredOutcomes?: readonly string[]
  readonly evaluateEntry?: NavigationRuntimeEntry['evaluateEntry']
  readonly evaluateOutcomes?: NavigationRuntimeEntry['evaluateOutcomes']
  readonly evaluateTieBreaker?: NavigationRuntimeEntry['evaluateTieBreaker']
  readonly evaluateFieldCodes?: NavigationRuntimeEntry['evaluateFieldCodes']
}

interface PipelineStateOptions {
  readonly params?: Record<string, string>
  readonly method?: string
  readonly baseUrl?: string
  readonly pathname?: string
}

export function createNavigationEntry(options: NavigationEntryOptions): NavigationRuntimeEntry {
  const entry: NavigationRuntimeEntry = {
    stepId: options.stepId,
    isEntryPoint: options.isEntryPoint ?? false,
    hasValidation: options.hasValidation ?? false,
    cleardownFieldCodes: options.cleardownFieldCodes ?? [],
    declaredOutcomes: options.declaredOutcomes ?? [],
    ...(options.code !== undefined ? { code: options.code } : {}),
    ...(options.evaluateEntry !== undefined ? { evaluateEntry: options.evaluateEntry } : {}),
    ...(options.evaluateOutcomes !== undefined ? { evaluateOutcomes: options.evaluateOutcomes } : {}),
    ...(options.evaluateTieBreaker !== undefined ? { evaluateTieBreaker: options.evaluateTieBreaker } : {}),
    ...(options.evaluateFieldCodes !== undefined ? { evaluateFieldCodes: options.evaluateFieldCodes } : {}),
  }

  if (options.path !== undefined) {
    routePathsByEntry.set(entry, options.path)
  }

  return entry
}

export function createNavigationPlan(
  entries: readonly NavigationRuntimeEntry[],
  overrides: Partial<NavigationRuntimePlan> = {},
): NavigationRuntimePlan {
  return {
    entries,
    resumeConfigured: false,
    resumeAlways: false,
    unreachableRedirect: 'entry',
    reachabilityDisabled: false,
    stepValidationPlans: new Map(),
    ...overrides,
  }
}

export function createNavigationFixture(
  entryOptions: readonly NavigationEntryOptions[],
  planOverrides: Partial<NavigationRuntimePlan> = {},
): { readonly plan: NavigationRuntimePlan; readonly routeTemplateCatalog: JourneyRouteTemplateCatalog } {
  const entries = entryOptions.map(createNavigationEntry)
  const plan = createNavigationPlan(entries, planOverrides)
  const routeTemplateCatalog = createRouteTemplateCatalog(entries)

  return { plan, routeTemplateCatalog }
}

export function createRouteTemplateCatalog(
  input: readonly NavigationRuntimeEntry[] | readonly (readonly [NodeId, string])[],
): JourneyRouteTemplateCatalog {
  const routeTemplatePathByStepId = new Map<NodeId, string>()
  const stepIdByRouteTemplatePath = new Map<string, NodeId>()

  input.forEach(item => {
    const [stepId, routeTemplatePath] = isRouteTemplatePathTuple(item)
      ? item
      : [item.stepId, resolveEntryRouteTemplatePath(item)]

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
    fields: [
      {
        nodeId: 'compile_ast:999' as const,
        validate: () =>
          isValid
            ? []
            : [{ blockId: 'compile_ast:999' as const, passed: false, message: 'invalid', submissionOnly: false }],
      },
    ],
    iteratorGroups: [],
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
  item: NavigationRuntimeEntry | readonly [NodeId, string],
): item is readonly [NodeId, string] {
  return Array.isArray(item)
}

function resolveEntryRouteTemplatePath(entry: NavigationRuntimeEntry): string {
  return joinPaths('/journey', routePathsByEntry.get(entry) ?? entry.stepId)
}
