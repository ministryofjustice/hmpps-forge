import type { PackageDependencies } from '../../contracts/ast/engine.type'
import { normalizeBasePath } from '../../../framework/path/routePath'
import type PackageInstance from '../../PackageInstance'
import type { NodeId } from '../../contracts/ast/ast.type'
import {
  createRouteTreeIndex,
  JourneyRouteContext,
  JourneyRouteTemplateCatalog,
  RouteTreeIndex,
  StepRouteContext,
  StoredRouteTree,
} from '../../contracts/routing/routeTree.type'
import type { JourneyRouteIndex, StepRouteIndex } from '../../contracts/routing/routeDescriptors.type'
import RouteTreeBuilder from './RouteTreeBuilder'
import type { ForgeRoute, ForgeTopology } from '../../../framework/types/topology.type'

/**
 * One mounted package's compiled artefacts, stored at registration time so a
 * `ForgeOrchestrator` can assemble per-route executors from them later.
 */
export interface MountedPackage {
  readonly journeyCode: string
  readonly packageInstance: PackageInstance
  readonly dependencies: PackageDependencies
  readonly stepContexts: readonly StepRouteContext[]
  readonly journeyContexts: readonly JourneyRouteContext[]
  readonly catalogsByBasePath: ReadonlyMap<string, JourneyRouteTemplateCatalog>
}

/**
 * Everything an orchestrator needs to build executors: the shared route tree
 * roots plus every mounted package's artefacts.
 */
export interface ForgeRuntime {
  readonly routeTreeRoots: StoredRouteTree
  readonly mounts: readonly MountedPackage[]
}

/**
 * The engine-side registration store. Mounting a package builds its route tree
 * (so duplicate-route failures surface inside `registerPackage`), records its
 * {@link ForgeRoute} entries for {@link getTopology}, and keeps the compiled
 * artefacts that {@link getRuntime} exposes for executor assembly.
 */
export default class MountRegistry {
  private readonly basePath: string

  private readonly routeTreeIndex: RouteTreeIndex = createRouteTreeIndex()

  private readonly mounts: MountedPackage[] = []

  private readonly routes: ForgeRoute[] = []

  constructor(basePath?: string) {
    this.basePath = normalizeBasePath(basePath)
  }

  /**
   * Registers every step and journey-root node of one compiled package in the
   * route tree and topology, and stores its artefacts for orchestrators.
   * Returns the number of routes added (one per step, one per journey root).
   */
  mount(packageInstance: PackageInstance): number {
    const stepRouteIndex = packageInstance.getStepRouteIndex()
    const journeyRouteIndex = packageInstance.getJourneyRouteIndex()
    const routeTreeBuilder = new RouteTreeBuilder(this.routeTreeIndex)
    const { journeyContexts, stepContexts, catalogsByBasePath } = routeTreeBuilder.build({
      basePath: this.basePath,
      stepRouteIndex,
      journeyRouteIndex,
    })
    const journeyCode = packageInstance.getJourneyCode()

    const stepRouteCount = this.pushStepRoutes(stepContexts, stepRouteIndex, journeyCode)
    const journeyRouteCount = this.pushJourneyRoutes(
      journeyContexts,
      journeyRouteIndex,
      catalogsByBasePath,
      packageInstance,
      journeyCode,
    )

    this.mounts.push({
      journeyCode,
      packageInstance,
      dependencies: packageInstance.getDependencies(),
      stepContexts,
      journeyContexts,
      catalogsByBasePath,
    })

    return stepRouteCount + journeyRouteCount
  }

  /** The routes-as-data view of every mounted node, for adapters to register. */
  getTopology(): ForgeTopology {
    return { routes: this.routes }
  }

  /** The mounted artefacts an orchestrator builds per-route executors from. */
  getRuntime(): ForgeRuntime {
    return { routeTreeRoots: this.routeTreeIndex.roots, mounts: this.mounts }
  }

  /** Pushes one step {@link ForgeRoute} (GET + POST) per step context. */
  private pushStepRoutes(
    stepContexts: StepRouteContext[],
    stepRouteIndex: StepRouteIndex,
    journeyCode: string,
  ): number {
    stepContexts.forEach(ctx => {
      this.routes.push({
        nodeId: MountRegistry.scopedRouteKey(journeyCode, ctx.stepNodeId),
        kind: 'step',
        templatePath: ctx.routeTemplatePath,
        basePath: ctx.journeyBasePath,
        methods: ['GET', 'POST'],
        title: stepRouteIndex.get(ctx.stepNodeId)?.title,
      })
    })

    return stepContexts.length
  }

  /**
   * Pushes one journey {@link ForgeRoute} (GET) per journey root, skipping any
   * journey whose compiled artefact or template catalog is missing — the same
   * skip executor assembly applies, so topology and executors stay aligned.
   */
  private pushJourneyRoutes(
    journeyContexts: JourneyRouteContext[],
    journeyRouteIndex: JourneyRouteIndex,
    catalogsByBasePath: Map<string, JourneyRouteTemplateCatalog>,
    packageInstance: PackageInstance,
    journeyCode: string,
  ): number {
    let count = 0

    journeyContexts.forEach(({ journeyNodeId, templatePath }) => {
      const compiledJourney = packageInstance.getCompiledJourney(journeyNodeId)
      const routeTemplateCatalog = catalogsByBasePath.get(templatePath)

      if (!compiledJourney || !routeTemplateCatalog) {
        return
      }

      this.routes.push({
        nodeId: MountRegistry.scopedRouteKey(journeyCode, journeyNodeId),
        kind: 'journey',
        templatePath,
        basePath: templatePath,
        methods: ['GET'],
        title: journeyRouteIndex.get(journeyNodeId)?.title,
      })

      count += 1
    })

    return count
  }

  /** Namespaces a node id under its journey so route keys stay unique across journeys. */
  private static scopedRouteKey(journeyCode: string, nodeId: NodeId): string {
    return `${journeyCode}::${nodeId}`
  }
}
