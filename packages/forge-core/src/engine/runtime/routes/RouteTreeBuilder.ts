import type { JourneyRouteIndex, StepRouteIndex, StepRouteDescriptor } from '../../types/routeDescriptors.type'
import type { NodeId } from '../../types/ast.type'
import { joinPaths } from '../../../framework/path/routePath'
import DuplicateRouteError from '../../errors/DuplicateRouteError'
import {
  JourneyRouteContext,
  JourneyRouteTemplateCatalog,
  RouteTreeBuildResult,
  RouteTreeIndex,
  StepRouteContext,
  StoredRouteTreeNode,
  StoredRouteTreeRoute,
} from '../types/routes.type'

export interface RouteTreeBuilderInput {
  basePath: string
  stepRouteIndex: StepRouteIndex
  journeyRouteIndex: JourneyRouteIndex
}

export default class RouteTreeBuilder {
  constructor(private readonly routeTreeIndex: RouteTreeIndex) {}

  build(input: RouteTreeBuilderInput): RouteTreeBuildResult {
    const journeyContexts = this.buildJourneyContexts(input.journeyRouteIndex, input.basePath)
    const catalogsByBasePath = new Map<string, JourneyRouteTemplateCatalog>()

    journeyContexts.forEach(context => {
      const descriptor = input.journeyRouteIndex.get(context.journeyId)
      const route: StoredRouteTreeRoute = {
        kind: 'journey',
        nodeId: context.journeyId,
        title: descriptor?.title,
        description: descriptor?.description,
        metadata: descriptor?.metadata,
      }
      const node = this.insertConcreteRoute(context.templatePath, route)

      this.routeTreeIndex.journeyNodesById.set(context.journeyId, node)
    })

    const stepContexts = Array.from(input.stepRouteIndex.entries()).map(([stepId, descriptor]) =>
      this.buildStepContext(stepId, descriptor, input.journeyRouteIndex, input.basePath, catalogsByBasePath),
    )

    stepContexts.forEach(context => {
      const descriptor = input.stepRouteIndex.get(context.stepId)
      const route: StoredRouteTreeRoute = {
        kind: 'step',
        nodeId: context.stepId,
        title: descriptor?.title,
        description: descriptor?.description,
        metadata: descriptor?.metadata,
      }
      const node = this.insertConcreteRoute(context.routeTemplatePath, route)

      this.routeTreeIndex.stepNodesById.set(context.stepId, node)
    })

    return {
      journeyContexts,
      stepContexts,
      catalogsByBasePath,
    }
  }

  private buildJourneyContexts(journeyRouteIndex: JourneyRouteIndex, basePath: string): JourneyRouteContext[] {
    const contextsById = new Map<NodeId, JourneyRouteContext>()

    journeyRouteIndex.forEach(descriptor => {
      let parentPath = basePath
      let parentTemplatePath: string | undefined

      descriptor.ancestorJourneyIds.forEach(ancestorId => {
        const ancestor = journeyRouteIndex.get(ancestorId)

        if (!ancestor) {
          return
        }

        const templatePath = joinPaths(parentPath, ancestor.path)

        if (!contextsById.has(ancestor.nodeId)) {
          contextsById.set(ancestor.nodeId, {
            journeyId: ancestor.nodeId,
            templatePath,
            mountPath:
              parentTemplatePath === undefined ? joinPaths(basePath, ancestor.path) : joinPaths('', ancestor.path),
            parentTemplatePath,
          })
        }

        parentPath = templatePath
        parentTemplatePath = templatePath
      })
    })

    return Array.from(contextsById.values())
  }

  private buildStepContext(
    stepId: NodeId,
    descriptor: StepRouteDescriptor,
    journeyRouteIndex: JourneyRouteIndex,
    basePath: string,
    catalogsByBasePath: Map<string, JourneyRouteTemplateCatalog>,
  ): StepRouteContext {
    const journeyBasePath = this.getJourneyBasePath(descriptor.ancestorJourneyIds, journeyRouteIndex, basePath)
    const routeTemplatePath = joinPaths(journeyBasePath, descriptor.path)
    const routeTemplateCatalog = this.getRouteTemplateCatalog(catalogsByBasePath, journeyBasePath)

    routeTemplateCatalog.routeTemplatePathByStepId.set(stepId, routeTemplatePath)
    routeTemplateCatalog.stepIdByRouteTemplatePath.set(routeTemplatePath, stepId)

    return {
      stepId,
      path: descriptor.path,
      routeTemplatePath,
      routeTemplateCatalog,
      journeyBasePath,
    }
  }

  private getJourneyBasePath(
    ancestorJourneyIds: readonly NodeId[],
    journeyRouteIndex: JourneyRouteIndex,
    basePath: string,
  ): string {
    return ancestorJourneyIds.reduce((path, id) => {
      const descriptor = journeyRouteIndex.get(id)

      if (!descriptor) {
        return path
      }

      return joinPaths(path, descriptor.path)
    }, basePath)
  }

  private getRouteTemplateCatalog(
    catalogsByBasePath: Map<string, JourneyRouteTemplateCatalog>,
    journeyBasePath: string,
  ): JourneyRouteTemplateCatalog {
    const existing = catalogsByBasePath.get(journeyBasePath)

    if (existing) {
      return existing
    }

    const catalog = {
      routeTemplatePathByStepId: new Map<NodeId, string>(),
      stepIdByRouteTemplatePath: new Map<string, NodeId>(),
    }

    catalogsByBasePath.set(journeyBasePath, catalog)

    return catalog
  }

  private insertConcreteRoute(templatePath: string, route: StoredRouteTreeRoute): StoredRouteTreeNode {
    const node = this.ensureNode(templatePath)

    if (node.route !== undefined) {
      const isStepOverridingJourney = node.route.kind === 'journey' && route.kind === 'step'

      if (!isStepOverridingJourney) {
        throw new DuplicateRouteError({ path: templatePath })
      }
    }

    node.route = route
    node.metadata = route.metadata

    return node
  }

  private ensureNode(path: string): StoredRouteTreeNode {
    const templatePath = joinPaths(path)
    const existing = this.routeTreeIndex.nodesByTemplatePath.get(templatePath)

    if (existing) {
      return existing
    }

    const segments = this.getPathSegments(templatePath)

    if (segments.length === 0) {
      return this.ensureChildNode(this.routeTreeIndex.roots, '', '/')
    }

    let parentPath = ''
    let siblings = this.routeTreeIndex.roots
    let node: StoredRouteTreeNode | undefined

    segments.forEach(segment => {
      const childPath = joinPaths(parentPath, segment)

      node = this.ensureChildNode(siblings, segment, childPath)
      siblings = node.children
      parentPath = childPath
    })

    if (!node) {
      throw new Error(`Unable to build route tree node for path "${path}"`)
    }

    return node
  }

  private ensureChildNode(siblings: StoredRouteTreeNode[], segment: string, templatePath: string): StoredRouteTreeNode {
    const existing = siblings.find(child => child.segment === segment)

    if (existing) {
      return existing
    }

    const node: StoredRouteTreeNode = {
      segment,
      templatePath,
      children: [],
    }

    siblings.push(node)
    this.routeTreeIndex.nodesByTemplatePath.set(templatePath, node)

    return node
  }

  private getPathSegments(path: string): string[] {
    return path.split('/').filter(Boolean)
  }
}
