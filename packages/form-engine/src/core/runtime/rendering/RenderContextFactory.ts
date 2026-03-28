import { NodeId } from '@form-engine/core/types/engine.type'
import {
  DomainValidationFailure,
  StepValidationFailure,
} from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import { ValidationResult } from '@form-engine/core/nodes/expressions/validation/ValidationHandler'
import { isBlockStructNode } from '@form-engine/core/typeguards/structure-nodes'
import { BlockASTNode } from '@form-engine/core/types/structures.type'
import { BlockType } from '@form-engine/form/types/enums'
import { isObjectValue } from '@form-engine/typeguards/primitives'
import {
  JourneyAncestor,
  RenderContext,
  NavigationTree,
  NavigationJourney,
  NavigationStep,
  JourneyMetadata,
  StepMetadata,
  Evaluated,
  HasNestedBlocksLookup,
} from './types'

export interface RenderContextOptions {
  /** Show validation errors on blocks. Set to true after form submission. Defaults to false. */
  showValidationFailures?: boolean

  /** Raw navigation metadata from the router, hydrated with active state. */
  navigationMetadata?: JourneyMetadata[]

  /** Full path of the current step, used to determine active state in navigation. */
  currentStepPath?: string
}

export interface RenderContextInput {
  step: RenderContext['step']
  ancestors: JourneyAncestor[]
  blocks: Evaluated<BlockASTNode>[]
  answers: Record<string, unknown>
  data: Record<string, unknown>
  fieldValidationFailures?: StepValidationFailure[]
  domainValidationFailures?: DomainValidationFailure[]
  hasNestedBlocks?: HasNestedBlocksLookup
}

/** Builds RenderContext from explicit evaluated render inputs. */
export default class RenderContextFactory {
  static build(input: RenderContextInput, options: RenderContextOptions = {}): RenderContext {
    const showValidationFailures = options.showValidationFailures ?? false
    const fieldValidationFailures = showValidationFailures ? (input.fieldValidationFailures ?? []) : []
    const domainValidationFailures = showValidationFailures ? (input.domainValidationFailures ?? []) : []
    const blocks =
      fieldValidationFailures.length > 0
        ? attachValidationToBlocks(input.blocks, fieldValidationFailures)
        : input.blocks

    return {
      navigation: buildNavigationTree(options.navigationMetadata ?? [], options.currentStepPath ?? ''),
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

function buildNavigationTree(metadata: JourneyMetadata[], currentStepPath: string): NavigationTree {
  return metadata.map(journey => toNavigationJourney(journey, currentStepPath))
}

function toNavigationJourney(stored: JourneyMetadata, currentStepPath: string): NavigationJourney {
  const children = stored.children.map(child => {
    if ('children' in child) {
      return toNavigationJourney(child, currentStepPath)
    }

    return toNavigationStep(child, currentStepPath)
  })

  return {
    type: 'journey',
    title: stored.title,
    description: stored.description,
    path: stored.path,
    active: children.some(child => child.active),
    hiddenFromNavigation: stored.hiddenFromNavigation,
    children,
  }
}

function toNavigationStep(stored: StepMetadata, currentStepPath: string): NavigationStep {
  return {
    type: 'step',
    title: stored.title,
    path: stored.path,
    active: stored.path === currentStepPath,
    hiddenFromNavigation: stored.hiddenFromNavigation,
  }
}

function attachValidationToBlocks(
  blocks: Evaluated<BlockASTNode>[],
  failures: StepValidationFailure[],
): Evaluated<BlockASTNode>[] {
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

function attachValidationToBlock(
  block: Evaluated<BlockASTNode>,
  failuresByBlockId: Map<NodeId, ValidationResult[]>,
): Evaluated<BlockASTNode> {
  const properties = walkPropertiesForBlocks(block.properties, failuresByBlockId)

  if (block.blockType !== BlockType.FIELD) {
    return {
      ...block,
      properties,
    }
  }

  const fieldProperties = {
    ...properties,
    validate: failuresByBlockId.get(block.id) ?? [],
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

  if (isBlockStructNode(value)) {
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
