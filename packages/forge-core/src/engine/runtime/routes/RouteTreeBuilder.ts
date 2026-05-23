import type { JourneyIndex, StepIndex } from '../../types/compilationArtefacts.type'
import type { CompilationContext } from '../../compilation/CompilationContext'
import type { NodeId } from '../../types/ast.type'
import type { JourneyASTNode, StepASTNode } from '../../types/structures.type'
import { joinPaths } from '../../../framework/path/routePath'
import DuplicateRouteError from '../../errors/DuplicateRouteError'
import getAncestorChain from '../../utils/getAncestorChain'
import { isJourneyStructNode } from '../../typeguards/structure-nodes'
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
  stepIndex: StepIndex
  journeyIndex: JourneyIndex
  compilationContext: CompilationContext
}

export default class RouteTreeBuilder {
  constructor(private readonly routeTreeIndex: RouteTreeIndex) {}

  build(input: RouteTreeBuilderInput): RouteTreeBuildResult {
    const journeyContexts = this.buildJourneyContexts(input.journeyIndex, input.compilationContext, input.basePath)
    const catalogsByBasePath = new Map<string, JourneyRouteTemplateCatalog>()

    journeyContexts.forEach(context => {
      const node = this.insertConcreteRoute(context.templatePath, this.createJourneyRoute(context))

      this.routeTreeIndex.journeyNodesById.set(context.journeyId, node)
    })

    const stepContexts = Array.from(input.stepIndex.entries()).map(([stepId, stepNode]) =>
      this.buildStepContext(stepId, stepNode, input.compilationContext, input.basePath, catalogsByBasePath),
    )

    stepContexts.forEach(context => {
      const node = this.insertConcreteRoute(context.routeTemplatePath, this.createStepRoute(context))

      this.routeTreeIndex.stepNodesById.set(context.stepId, node)
    })

    return {
      journeyContexts,
      stepContexts,
      catalogsByBasePath,
    }
  }

  private buildJourneyContexts(
    journeyIndex: JourneyIndex,
    compilationContext: CompilationContext,
    basePath: string,
  ): JourneyRouteContext[] {
    const contextsById = new Map<NodeId, JourneyRouteContext>()

    journeyIndex.forEach((_, journeyId) => {
      const chain = getAncestorChain(journeyId, compilationContext.astNodeTree)
        .map(nodeId => compilationContext.nodeRegistry.get(nodeId))
        .filter(isJourneyStructNode)

      let parentPath = basePath
      let parentTemplatePath: string | undefined

      chain.forEach(journeyNode => {
        const templatePath = joinPaths(parentPath, journeyNode.properties.path)

        if (!contextsById.has(journeyNode.id)) {
          contextsById.set(journeyNode.id, {
            journeyId: journeyNode.id,
            journeyNode,
            templatePath,
            mountPath:
              parentTemplatePath === undefined
                ? joinPaths(basePath, journeyNode.properties.path)
                : joinPaths('', journeyNode.properties.path),
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
    stepNode: StepASTNode,
    compilationContext: CompilationContext,
    basePath: string,
    catalogsByBasePath: Map<string, JourneyRouteTemplateCatalog>,
  ): StepRouteContext {
    const journeyAncestry = this.getJourneyAncestry(stepId, compilationContext)
    const journeyBasePath = this.getJourneyBasePath(journeyAncestry, basePath)
    const routeTemplatePath = joinPaths(journeyBasePath, stepNode.properties.path)
    const routeTemplateCatalog = this.getRouteTemplateCatalog(catalogsByBasePath, journeyBasePath)

    routeTemplateCatalog.routeTemplatePathByStepId.set(stepId, routeTemplatePath)
    routeTemplateCatalog.stepIdByRouteTemplatePath.set(routeTemplatePath, stepId)

    return {
      stepId,
      stepNode,
      routeTemplatePath,
      routeTemplateCatalog,
      journeyBasePath,
    }
  }

  private getJourneyAncestry(stepId: NodeId, compilationContext: CompilationContext): JourneyASTNode[] {
    return getAncestorChain(stepId, compilationContext.astNodeTree)
      .filter(nodeId => nodeId !== stepId)
      .map(nodeId => compilationContext.nodeRegistry.get(nodeId))
      .filter(isJourneyStructNode)
  }

  private getJourneyBasePath(journeyAncestry: JourneyASTNode[], basePath: string): string {
    return journeyAncestry.reduce((path, journey) => joinPaths(path, journey.properties.path), basePath)
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

  private createJourneyRoute(context: JourneyRouteContext): StoredRouteTreeRoute {
    return {
      kind: 'journey',
      nodeId: context.journeyId,
      title: context.journeyNode.properties.title,
      description: context.journeyNode.properties.description,
      metadata: context.journeyNode.properties.metadata,
      journeyNode: context.journeyNode,
    }
  }

  private createStepRoute(context: StepRouteContext): StoredRouteTreeRoute {
    return {
      kind: 'step',
      nodeId: context.stepId,
      title: context.stepNode.properties.title,
      description: context.stepNode.properties.description,
      metadata: context.stepNode.properties.metadata,
      stepNode: context.stepNode,
    }
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
