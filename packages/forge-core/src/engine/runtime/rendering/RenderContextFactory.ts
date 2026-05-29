import { NodeId } from '../../types/engine.type'
import { DomainValidationFailure, StepValidationFailure } from '../context/RuntimeEvaluationContext'
import { ValidationResult } from '../types/ValidationResult.type'
import { BlockType } from '../../../authoring/types/enums'
import { isObjectValue } from '../../../shared/typeguards/primitives'
import {
  isRenderBlock,
  JourneyAncestor,
  RenderBlock,
  RenderContext,
  RouteTree,
  RouteTreeNode,
  RouteTreeRoute,
  HasNestedBlocksLookup,
} from '../../../framework/rendering/types'
import { resolvePathParams } from '../../../framework/path/routePath'
import { StoredRouteTree, StoredRouteTreeNode, StoredRouteTreeRoute } from '../types/routes.type'

export interface RenderContextOptions {
  /** Show validation errors on blocks. Set to true after form submission. Defaults to false. */
  showValidationFailures?: boolean

  /** Raw route hierarchy from the router, hydrated with params and active state. */
  routeTree: StoredRouteTree

  /** Full route template path of the current step, used to determine active state in the route tree. */
  currentStepPath: string

  /** Route params from the current request, used to resolve :param placeholders in route paths. */
  params: Record<string, string>
}

export interface RenderContextInput {
  step: RenderContext['step']
  ancestors: JourneyAncestor[]
  blocks: RenderBlock[]
  answers: Record<string, unknown>
  data: Record<string, unknown>
  fieldValidationFailures?: StepValidationFailure[]
  domainValidationFailures?: DomainValidationFailure[]
  hasNestedBlocks?: HasNestedBlocksLookup
}

/** Builds RenderContext from explicit evaluated render inputs. */
export default class RenderContextFactory {
  static build(input: RenderContextInput, options: RenderContextOptions): RenderContext {
    const showValidationFailures = options.showValidationFailures ?? false
    const fieldValidationFailures = showValidationFailures ? (input.fieldValidationFailures ?? []) : []
    const domainValidationFailures = showValidationFailures ? (input.domainValidationFailures ?? []) : []
    const blocks =
      fieldValidationFailures.length > 0
        ? attachValidationToBlocks(input.blocks, fieldValidationFailures)
        : input.blocks
    const routeTree = buildRouteTree(options.routeTree, options.currentStepPath, options.params)

    return {
      routeTree,
      step: input.step,
      ancestors: input.ancestors,
      blocks,
      showValidationFailures,
      fieldValidationErrors: fieldValidationFailures.map(stripBlockId),
      domainValidationErrors: domainValidationFailures,
      answers: input.answers,
      data: input.data,
      hasNestedBlocks: input.hasNestedBlocks,
    }
  }
}

function buildRouteTree(
  routeTree: StoredRouteTree,
  currentStepPath: string,
  params: Record<string, string>,
): RouteTree {
  return routeTree.map(node => toRouteTreeNode(node, currentStepPath, params))
}

function toRouteTreeNode(
  stored: StoredRouteTreeNode,
  currentStepPath: string,
  params: Record<string, string>,
): RouteTreeNode {
  const children = stored.children.map(child => toRouteTreeNode(child, currentStepPath, params))

  return {
    segment: stored.segment,
    path: resolvePathParams(stored.templatePath, params),
    templatePath: stored.templatePath,
    active: stored.templatePath === currentStepPath || children.some(child => child.active),
    metadata: stored.metadata,
    route: stored.route ? toRouteTreeRoute(stored.route) : undefined,
    children,
  }
}

function toRouteTreeRoute(stored: StoredRouteTreeRoute): RouteTreeRoute {
  return {
    title: stored.title,
    description: stored.description,
    kind: stored.kind,
    nodeId: stored.nodeId,
    metadata: stored.metadata,
  }
}

function attachValidationToBlocks(blocks: RenderBlock[], failures: StepValidationFailure[]): RenderBlock[] {
  const failuresByBlockId = groupFailuresByBlockId(failures)

  return blocks.map(block => attachValidationToBlock(block, failuresByBlockId))
}

function groupFailuresByBlockId(failures: StepValidationFailure[]): Map<NodeId, ValidationResult[]> {
  return failures.reduce((map, failure) => {
    const existing = map.get(failure.blockId) ?? []

    existing.push(stripBlockId(failure))
    map.set(failure.blockId, existing)

    return map
  }, new Map<NodeId, ValidationResult[]>())
}

function attachValidationToBlock(block: RenderBlock, failuresByBlockId: Map<NodeId, ValidationResult[]>): RenderBlock {
  const properties = walkPropertiesForBlocks(block.properties, failuresByBlockId)

  if (block.blockType !== BlockType.FIELD) {
    return {
      ...block,
      properties,
    }
  }

  const fieldProperties = {
    ...properties,
    validWhen: failuresByBlockId.get(block.id) ?? [],
  }

  return {
    ...block,
    properties: fieldProperties,
  }
}

function walkPropertiesForBlocks(
  properties: Record<string, unknown>,
  failuresByBlockId: Map<NodeId, ValidationResult[]>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [key, walkValueForBlocks(value, failuresByBlockId)]),
  )
}

function walkValueForBlocks(value: unknown, failuresByBlockId: Map<NodeId, ValidationResult[]>): unknown {
  if (Array.isArray(value)) {
    return value.map(item => walkValueForBlocks(item, failuresByBlockId))
  }

  if (isRenderBlock(value)) {
    return attachValidationToBlock(value, failuresByBlockId)
  }

  if (isObjectValue(value)) {
    return walkPropertiesForBlocks(value, failuresByBlockId)
  }

  return value
}

function stripBlockId(failure: StepValidationFailure): ValidationResult {
  const { blockId: _, ...validation } = failure

  return validation
}
