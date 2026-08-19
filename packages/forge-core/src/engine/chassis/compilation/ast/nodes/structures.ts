import { isFieldBlockDefinition } from '../../../../../components/typeguards'
import { ASTNodeType } from '../../../contracts/ast/enums'
import { ExpressionType, BlockType } from '../../../../../authoring/types/enums'
import {
  BasicBlockASTNode,
  BlockASTNode,
  FieldBlockASTNode,
  JourneyASTNode,
  JourneyReachabilityAST,
  StepASTNode,
  StepReachabilityAST,
} from '../../../contracts/ast/structures.type'
import ForgeInvalidNodeError from '../../../../errors/ForgeInvalidNodeError'
import type { JourneyDefinition, StepDefinition, TieBreaker } from '../../../../../authoring/types/structures.type'
import type { BlockDefinition, FieldBlockDefinition } from '../../../../../components/types/structures.type'
import type { NodeBuildContext } from './NodeFactory'

function isTieBreaker(obj: unknown): obj is TieBreaker {
  return obj != null && (obj as { type?: string }).type === ExpressionType.TIE_BREAKER
}

/**
 * Journey: Top-level form container
 * Extracts properties and recursively transforms nested steps/children
 */
export function createJourneyNode(json: JourneyDefinition, ctx: NodeBuildContext): JourneyASTNode {
  const { type, ...dataProperties } = json

  const properties: JourneyASTNode['properties'] = {
    code: dataProperties.code,
    path: dataProperties.path,
    title: ctx.transformValue(dataProperties.title),
  }

  if (dataProperties.code === undefined) {
    const diagnostics = ctx.diagnosticsFor(json)

    throw new ForgeInvalidNodeError({
      message: 'Journey requires a code property',
      node: json,
      expected: 'code property',
      actual: 'undefined',
      formattedPath: diagnostics?.source.formattedPath,
      callsite: diagnostics?.callsite,
    })
  }

  if (dataProperties.path === undefined) {
    const diagnostics = ctx.diagnosticsFor(json)

    throw new ForgeInvalidNodeError({
      message: 'Journey requires a path property',
      node: json,
      expected: 'path property',
      actual: 'undefined',
      formattedPath: diagnostics?.source.formattedPath,
      callsite: diagnostics?.callsite,
    })
  }

  if (dataProperties.title === undefined) {
    const diagnostics = ctx.diagnosticsFor(json)

    throw new ForgeInvalidNodeError({
      message: 'Journey requires a title property',
      node: json,
      expected: 'title property',
      actual: 'undefined',
      formattedPath: diagnostics?.source.formattedPath,
      callsite: diagnostics?.callsite,
    })
  }

  if (dataProperties.description !== undefined) {
    properties.description = ctx.transformValue(dataProperties.description)
  }

  if (dataProperties.onAccess !== undefined) {
    properties.onAccess = ctx.transformValue(dataProperties.onAccess)
  }

  if (dataProperties.steps !== undefined) {
    properties.steps = ctx.transformValue(dataProperties.steps)
  }

  if (dataProperties.children !== undefined) {
    properties.children = ctx.transformValue(dataProperties.children)
  }

  if (dataProperties.view !== undefined) {
    properties.view = ctx.transformValue(dataProperties.view)
  }

  if (dataProperties.metadata !== undefined) {
    properties.metadata = ctx.transformValue(dataProperties.metadata)
  }

  if (dataProperties.data !== undefined) {
    properties.data = dataProperties.data
  }

  if (dataProperties.reachability !== undefined) {
    const { resumeWhen, unreachableRedirect, disableReachabilityChecks } = dataProperties.reachability
    const reachability: JourneyReachabilityAST = {}

    // false compiles like undefined; only true and expressions reach the AST
    if (resumeWhen === true) {
      reachability.resumeWhen = true
    } else if (resumeWhen !== undefined && resumeWhen !== false) {
      reachability.resumeWhen = ctx.createNode(resumeWhen)
    }

    if (unreachableRedirect !== undefined) {
      reachability.unreachableRedirect = unreachableRedirect
    }

    if (disableReachabilityChecks !== undefined) {
      reachability.disableReachabilityChecks = disableReachabilityChecks
    }

    properties.reachability = reachability
  }

  return {
    id: ctx.nextId(),
    type: ASTNodeType.JOURNEY,
    properties,
  }
}

/**
 * Step: Single page within a journey
 * Contains blocks and hooks for user interaction
 */
export function createStepNode(json: StepDefinition, ctx: NodeBuildContext): StepASTNode {
  const { type, ...dataProperties } = json

  const properties: StepASTNode['properties'] = {
    path: json.path,
    title: ctx.transformValue(json.title),
  }

  if (dataProperties.path === undefined) {
    const diagnostics = ctx.diagnosticsFor(json)

    throw new ForgeInvalidNodeError({
      message: 'Step requires a path property',
      node: json,
      expected: 'path property',
      actual: 'undefined',
      formattedPath: diagnostics?.source.formattedPath,
      callsite: diagnostics?.callsite,
    })
  }

  if (dataProperties.title === undefined) {
    const diagnostics = ctx.diagnosticsFor(json)

    throw new ForgeInvalidNodeError({
      message: 'Step requires a title property',
      node: json,
      expected: 'title property',
      actual: 'undefined',
      formattedPath: diagnostics?.source.formattedPath,
      callsite: diagnostics?.callsite,
    })
  }

  if (dataProperties.onAccess !== undefined) {
    properties.onAccess = ctx.transformValue(dataProperties.onAccess)
  }

  if (dataProperties.code !== undefined) {
    properties.code = dataProperties.code
  }

  if (dataProperties.onSubmission !== undefined) {
    properties.onSubmission = ctx.transformValue(dataProperties.onSubmission)
  }

  if (dataProperties.validateOnEntry !== undefined) {
    properties.validateOnEntry = dataProperties.validateOnEntry.flatMap(entry => {
      if (entry.when === false) {
        return []
      }

      return {
        groups: entry.groups,
        when: entry.when === true ? true : ctx.createNode(entry.when),
      }
    })
  }

  if (dataProperties.blocks !== undefined) {
    properties.blocks = ctx.transformValue(dataProperties.blocks)
  }

  if (dataProperties.description !== undefined) {
    properties.description = ctx.transformValue(dataProperties.description)
  }

  if (dataProperties.view !== undefined) {
    properties.view = ctx.transformValue(dataProperties.view)
  }

  if (dataProperties.reachability !== undefined) {
    const { entryWhen, tieBreakers } = dataProperties.reachability
    const reachability: StepReachabilityAST = {}

    // false compiles like undefined; only true and expressions reach the AST
    if (entryWhen === true) {
      reachability.entryWhen = true
    } else if (entryWhen !== undefined && entryWhen !== false) {
      reachability.entryWhen = ctx.createNode(entryWhen)
    }

    if (tieBreakers?.every(isTieBreaker)) {
      reachability.tieBreakers = ctx.transformValue(tieBreakers)
    }

    properties.reachability = reachability
  }

  if (dataProperties.backlink !== undefined) {
    properties.backlink = dataProperties.backlink
  }

  if (dataProperties.metadata !== undefined) {
    properties.metadata = ctx.transformValue(dataProperties.metadata)
  }

  if (dataProperties.data !== undefined) {
    properties.data = dataProperties.data
  }

  if (dataProperties.validWhen !== undefined) {
    properties.validWhen = ctx.transformValue(dataProperties.validWhen)
  }

  if (dataProperties.cleardownFieldCodes !== undefined) {
    properties.cleardownFieldCodes = dataProperties.cleardownFieldCodes
  }

  return {
    id: ctx.nextId(),
    type: ASTNodeType.STEP,
    properties,
  }
}

/**
 * Block: UI component within a step (basic or field)
 * Basic blocks render but don't collect data; field blocks collect user data
 * via a code property.
 */
export function createBlockNode(json: BlockDefinition | FieldBlockDefinition, ctx: NodeBuildContext): BlockASTNode {
  if (isFieldBlockDefinition(json)) {
    return createFieldBlock(json, ctx)
  }

  return createBasicBlock(json, ctx)
}

function createBasicBlock(json: BlockDefinition, ctx: NodeBuildContext): BasicBlockASTNode {
  const { variant, type, ...dataProperties } = json
  const properties: BasicBlockASTNode['properties'] = {}

  Object.entries(dataProperties).forEach(([key, value]) => {
    properties[key] = ctx.transformValue(value)
  })

  if (dataProperties.metadata !== undefined) {
    properties.metadata = dataProperties.metadata
  }

  return {
    id: ctx.nextId(),
    type: ASTNodeType.BLOCK,
    variant,
    blockType: BlockType.BASIC,
    properties,
  }
}

function createFieldBlock(json: FieldBlockDefinition, ctx: NodeBuildContext): FieldBlockASTNode {
  const { variant, type, ...dataProperties } = json

  if (dataProperties.code === undefined) {
    const diagnostics = ctx.diagnosticsFor(json)

    throw new ForgeInvalidNodeError({
      message: 'Field block requires a code property',
      node: json,
      expected: 'code property',
      actual: 'undefined',
      formattedPath: diagnostics?.source.formattedPath,
      callsite: diagnostics?.callsite,
    })
  }

  const properties: FieldBlockASTNode['properties'] = {}

  Object.entries(dataProperties).forEach(([key, value]) => {
    properties[key] = ctx.transformValue(value)
  })

  // Override properties that should not be transformed
  if (dataProperties.metadata !== undefined) {
    properties.metadata = dataProperties.metadata
  }

  return {
    id: ctx.nextId(),
    type: ASTNodeType.BLOCK,
    variant,
    blockType: BlockType.FIELD,
    properties,
  }
}
