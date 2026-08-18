import { normalizeBasePath } from '../../../shared/utils/routePath'
import type PackageInstance from '../../PackageInstance'
import type { NodeId } from '../contracts/ast/ast.type'
import type {
  CompiledAccessLifecycleFunction,
  CompiledSubmitHooksFunction,
} from '../../concerns/hooks/contracts/hookLifecycle.type'
import type {
  CompiledAnswerPreparationFunction,
  CompiledEntryValidationFunction,
  CompiledReachabilityFactsFunction,
  CompiledReachabilityStateFunction,
  CompiledResolveFunction,
  CompiledRouteMetadataFunction,
  CompiledStaticDataFunction,
  CompiledValidationFunction,
} from '../contracts/compiled/compiledFunctions.type'
import type { CompiledFieldInventoryFunction } from '../../concerns/answer-cleardown/contracts/compiledFieldInventory.type'
import type FunctionRegistry from './FunctionRegistry'
import type { ComponentRegistry } from '../../../framework/types/adapter.type'
import {
  createRouteTreeIndex,
  JourneyRouteContext,
  JourneyRouteTemplateCatalog,
  RouteTreeIndex,
  StepRouteContext,
  StoredRouteTree,
} from '../../concerns/route/contracts/routeTree.type'
import type { JourneyRouteIndex, StepRouteIndex } from '../../concerns/route/contracts/routeDescriptors.type'
import RouteTreeBuilder from '../../concerns/route/runtime/RouteTreeBuilder'
import type { ForgeRoute, ForgeTopology } from '../../../framework/types/topology.type'

interface MountedNodeBase {
  readonly mountKey: string
  readonly kind: 'step' | 'journey'
  readonly nodeId: NodeId
  readonly journeyCode: string
  readonly path: string
  readonly templatePath: string
  readonly basePath: string
  readonly functionRegistry: FunctionRegistry
  readonly componentRegistry: ComponentRegistry
  readonly compiledReachabilityFacts: CompiledReachabilityFactsFunction
  readonly compiledReachabilityState: CompiledReachabilityStateFunction
  readonly compiledFieldInventory: CompiledFieldInventoryFunction | undefined
  readonly routeTemplateCatalog: JourneyRouteTemplateCatalog
  readonly compiledStaticData: CompiledStaticDataFunction
  readonly compiledAccessLifecycle: CompiledAccessLifecycleFunction
  readonly compiledAnswerPreparation: CompiledAnswerPreparationFunction
  readonly compiledStepValidations: ReadonlyMap<NodeId, CompiledValidationFunction>
  readonly compiledRouteMetadata: CompiledRouteMetadataFunction
}

export interface MountedStepNode extends MountedNodeBase {
  readonly kind: 'step'
  readonly compiledEntryValidation: CompiledEntryValidationFunction
  readonly compiledSubmitHooks: CompiledSubmitHooksFunction
  readonly compiledValidation: CompiledValidationFunction
  readonly compiledResolve: CompiledResolveFunction
  readonly routeTree: StoredRouteTree
}

interface MountedJourneyNode extends MountedNodeBase {
  readonly kind: 'journey'
}

export type MountedNode = MountedStepNode | MountedJourneyNode

export default class MountRegistry {
  private readonly basePath: string

  private readonly routeTreeIndex: RouteTreeIndex = createRouteTreeIndex()

  private readonly nodesByMountKey = new Map<string, MountedNode>()

  constructor(basePath?: string) {
    this.basePath = normalizeBasePath(basePath)
  }

  register(packageInstance: PackageInstance): void {
    const { functionRegistry, componentRegistry } = packageInstance.getDependencies()
    const stepRouteIndex = packageInstance.getStepRouteIndex()
    const journeyRouteIndex = packageInstance.getJourneyRouteIndex()
    const journeyCode = packageInstance.getJourneyCode()
    const routeTreeBuilder = new RouteTreeBuilder(this.routeTreeIndex)
    const { journeyContexts, stepContexts, catalogsByBasePath } = routeTreeBuilder.build({
      basePath: this.basePath,
      stepRouteIndex,
      journeyRouteIndex,
    })

    this.buildStepNodes(packageInstance, stepContexts, stepRouteIndex, journeyCode, functionRegistry, componentRegistry)
    this.buildJourneyNodes(
      packageInstance,
      journeyContexts,
      journeyRouteIndex,
      catalogsByBasePath,
      journeyCode,
      functionRegistry,
      componentRegistry,
    )
  }

  getNode(mountKey: string): MountedNode | undefined {
    return this.nodesByMountKey.get(mountKey)
  }

  getTopology(): ForgeTopology {
    const routes: ForgeRoute[] = []

    this.nodesByMountKey.forEach(node => {
      routes.push({
        nodeId: node.mountKey,
        kind: node.kind,
        templatePath: node.templatePath,
        basePath: node.basePath,
        methods: node.kind === 'step' ? ['GET', 'POST'] : ['GET'],
      })
    })

    return { routes }
  }

  private buildStepNodes(
    packageInstance: PackageInstance,
    stepContexts: StepRouteContext[],
    stepRouteIndex: StepRouteIndex,
    journeyCode: string,
    functionRegistry: FunctionRegistry,
    componentRegistry: ComponentRegistry,
  ): void {
    stepContexts.forEach(ctx => {
      const compiledStep = packageInstance.getCompiledStep(ctx.stepId)
      const { mountInfo } = compiledStep
      const mountKey = MountRegistry.scopedRouteKey(journeyCode, ctx.stepId)

      this.nodesByMountKey.set(mountKey, {
        kind: 'step',
        mountKey,
        nodeId: mountInfo.stepId,
        journeyCode,
        path: mountInfo.path,
        templatePath: ctx.routeTemplatePath,
        basePath: ctx.journeyBasePath,
        functionRegistry,
        componentRegistry,
        compiledReachabilityFacts: compiledStep.compiledReachabilityFacts,
        compiledReachabilityState: compiledStep.compiledReachabilityState,
        compiledFieldInventory: compiledStep.compiledFieldInventory,
        routeTemplateCatalog: ctx.routeTemplateCatalog,
        compiledStaticData: compiledStep.compiledStaticData,
        compiledAccessLifecycle: compiledStep.compiledAccessLifecycle,
        compiledAnswerPreparation: compiledStep.compiledAnswerPreparation,
        compiledStepValidations: compiledStep.compiledStepValidations,
        compiledRouteMetadata: compiledStep.compiledRouteMetadata,
        compiledEntryValidation: compiledStep.compiledEntryValidation,
        compiledSubmitHooks: compiledStep.compiledSubmitHooks,
        compiledValidation: compiledStep.compiledValidation,
        compiledResolve: compiledStep.compiledResolve,
        routeTree: this.routeTreeIndex.roots,
      })
    })
  }

  private buildJourneyNodes(
    packageInstance: PackageInstance,
    journeyContexts: JourneyRouteContext[],
    journeyRouteIndex: JourneyRouteIndex,
    catalogsByBasePath: Map<string, JourneyRouteTemplateCatalog>,
    journeyCode: string,
    functionRegistry: FunctionRegistry,
    componentRegistry: ComponentRegistry,
  ): void {
    journeyContexts.forEach(({ journeyId, templatePath }) => {
      const compiledJourney = packageInstance.getCompiledJourney(journeyId)
      const routeTemplateCatalog = catalogsByBasePath.get(templatePath)

      if (!compiledJourney || !routeTemplateCatalog) {
        return
      }

      const { mountInfo } = compiledJourney
      const mountKey = MountRegistry.scopedRouteKey(journeyCode, journeyId)

      this.nodesByMountKey.set(mountKey, {
        kind: 'journey',
        mountKey,
        nodeId: mountInfo.journeyId,
        journeyCode,
        path: mountInfo.path,
        templatePath,
        basePath: templatePath,
        functionRegistry,
        componentRegistry,
        compiledReachabilityFacts: compiledJourney.compiledReachabilityFacts,
        compiledReachabilityState: compiledJourney.compiledReachabilityState,
        compiledFieldInventory: compiledJourney.compiledFieldInventory,
        routeTemplateCatalog,
        compiledStaticData: compiledJourney.compiledStaticData,
        compiledAccessLifecycle: compiledJourney.compiledAccessLifecycle,
        compiledAnswerPreparation: compiledJourney.compiledAnswerPreparation,
        compiledStepValidations: compiledJourney.compiledStepValidations,
        compiledRouteMetadata: compiledJourney.compiledRouteMetadata,
      })
    })
  }

  static scopedRouteKey(journeyCode: string, nodeId: NodeId): string {
    return `${journeyCode}::${nodeId}`
  }
}
