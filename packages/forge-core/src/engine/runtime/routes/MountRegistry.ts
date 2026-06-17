import { normalizeBasePath } from '../../../framework/path/routePath'
import type PackageInstance from '../../PackageInstance'
import type { NodeId } from '../../contracts/ast/ast.type'
import type { PackageDependencies } from '../../contracts/ast/engine.type'
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

export interface MountedPackage {
  readonly journeyCode: string
  readonly packageInstance: PackageInstance
  readonly dependencies: PackageDependencies
  readonly stepContexts: readonly StepRouteContext[]
  readonly journeyContexts: readonly JourneyRouteContext[]
  readonly catalogsByBasePath: ReadonlyMap<string, JourneyRouteTemplateCatalog>
}

export interface ForgeRuntime {
  readonly routeTreeRoots: StoredRouteTree
  readonly mounts: readonly MountedPackage[]
}

export default class MountRegistry {
  private readonly basePath: string

  private readonly routeTreeIndex: RouteTreeIndex = createRouteTreeIndex()

  private readonly routes: ForgeRoute[] = []

  private readonly mounts: MountedPackage[] = []

  constructor(basePath?: string) {
    this.basePath = normalizeBasePath(basePath)
  }

  mount(packageInstance: PackageInstance): number {
    const packageDependencies = packageInstance.getDependencies()
    const stepRouteIndex = packageInstance.getStepRouteIndex()
    const journeyRouteIndex = packageInstance.getJourneyRouteIndex()
    const journeyCode = packageInstance.getJourneyCode()
    const routeTreeBuilder = new RouteTreeBuilder(this.routeTreeIndex)
    const { journeyContexts, stepContexts, catalogsByBasePath } = routeTreeBuilder.build({
      basePath: this.basePath,
      stepRouteIndex,
      journeyRouteIndex,
    })

    this.mounts.push({
      journeyCode,
      packageInstance,
      dependencies: packageDependencies,
      stepContexts,
      journeyContexts,
      catalogsByBasePath,
    })

    const stepCount = this.pushStepRoutes(stepContexts, stepRouteIndex, journeyCode)
    const journeyCount = this.pushJourneyRoutes(journeyContexts, journeyRouteIndex, journeyCode)

    return stepCount + journeyCount
  }

  getTopology(): ForgeTopology {
    return { routes: this.routes }
  }

  getRuntime(): ForgeRuntime {
    return {
      routeTreeRoots: this.routeTreeIndex.roots,
      mounts: this.mounts,
    }
  }

  private pushStepRoutes(
    stepContexts: StepRouteContext[],
    stepRouteIndex: StepRouteIndex,
    journeyCode: string,
  ): number {
    let count = 0

    stepContexts.forEach(ctx => {
      this.routes.push({
        nodeId: MountRegistry.scopedRouteKey(journeyCode, ctx.stepId),
        kind: 'step',
        templatePath: ctx.routeTemplatePath,
        basePath: ctx.journeyBasePath,
        methods: ['GET', 'POST'],
        title: stepRouteIndex.get(ctx.stepId)?.title,
      })

      count += 2
    })

    return count
  }

  private pushJourneyRoutes(
    journeyContexts: JourneyRouteContext[],
    journeyRouteIndex: JourneyRouteIndex,
    journeyCode: string,
  ): number {
    let count = 0

    journeyContexts.forEach(({ journeyId, templatePath }) => {
      this.routes.push({
        nodeId: MountRegistry.scopedRouteKey(journeyCode, journeyId),
        kind: 'journey',
        templatePath,
        basePath: templatePath,
        methods: ['GET'],
        title: journeyRouteIndex.get(journeyId)?.title,
      })

      count += 1
    })

    return count
  }

  static scopedRouteKey(journeyCode: string, nodeId: NodeId): string {
    return `${journeyCode}::${nodeId}`
  }
}
