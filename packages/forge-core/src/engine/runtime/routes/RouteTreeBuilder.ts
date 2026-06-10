import type {
  JourneyRouteIndex,
  StepRouteIndex,
  StepRouteDescriptor,
} from '../../contracts/routing/routeDescriptors.type'
import type { NodeId } from '../../contracts/ast/ast.type'
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
} from '../../contracts/routing/routeTree.type'

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
      const descriptor = input.journeyRouteIndex.get(context.journeyNodeId)
      const route: StoredRouteTreeRoute = {
        kind: 'journey',
        nodeId: context.journeyNodeId,
        title: descriptor?.title,
        description: descriptor?.description,
        metadata: descriptor?.metadata,
      }
      const node = this.insertConcreteRoute(context.templatePath, route)

      this.routeTreeIndex.journeyNodesById.set(context.journeyNodeId, node)
    })

    const stepContexts = Array.from(input.stepRouteIndex.entries()).map(([stepNodeId, descriptor]) =>
      this.buildStepContext(stepNodeId, descriptor, input.journeyRouteIndex, input.basePath, catalogsByBasePath),
    )

    stepContexts.forEach(context => {
      const descriptor = input.stepRouteIndex.get(context.stepNodeId)
      const route: StoredRouteTreeRoute = {
        kind: 'step',
        nodeId: context.stepNodeId,
        title: descriptor?.title,
        description: descriptor?.description,
        metadata: descriptor?.metadata,
      }
      const node = this.insertConcreteRoute(context.routeTemplatePath, route)

      this.routeTreeIndex.stepNodesById.set(context.stepNodeId, node)
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

      descriptor.ancestorJourneyNodeIds.forEach(ancestorId => {
        const ancestor = journeyRouteIndex.get(ancestorId)

        if (!ancestor) {
          return
        }

        const templatePath = joinPaths(parentPath, ancestor.path)

        if (!contextsById.has(ancestor.nodeId)) {
          contextsById.set(ancestor.nodeId, {
            journeyNodeId: ancestor.nodeId,
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
    stepNodeId: NodeId,
    descriptor: StepRouteDescriptor,
    journeyRouteIndex: JourneyRouteIndex,
    basePath: string,
    catalogsByBasePath: Map<string, JourneyRouteTemplateCatalog>,
  ): StepRouteContext {
    const journeyBasePath = this.getJourneyBasePath(descriptor.ancestorJourneyNodeIds, journeyRouteIndex, basePath)
    const routeTemplatePath = joinPaths(journeyBasePath, descriptor.path)
    const routeTemplateCatalog = this.getRouteTemplateCatalog(catalogsByBasePath, journeyBasePath)

    routeTemplateCatalog.routeTemplatePathByStepNodeId.set(stepNodeId, routeTemplatePath)
    routeTemplateCatalog.stepNodeIdByRouteTemplatePath.set(routeTemplatePath, stepNodeId)

    return {
      stepNodeId,
      path: descriptor.path,
      routeTemplatePath,
      routeTemplateCatalog,
      journeyBasePath,
    }
  }

  private getJourneyBasePath(
    ancestorJourneyNodeIds: readonly NodeId[],
    journeyRouteIndex: JourneyRouteIndex,
    basePath: string,
  ): string {
    return ancestorJourneyNodeIds.reduce((path, id) => {
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
      routeTemplatePathByStepNodeId: new Map<NodeId, string>(),
      stepNodeIdByRouteTemplatePath: new Map<string, NodeId>(),
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
