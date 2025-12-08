import { NodeId, PseudoNodeId } from '@form-engine/core/types/engine.type'

/**
 * Types of pseudo nodes in the dependency graph
 * Pseudo nodes represent runtime data sources that aren't part of the AST
 */
export enum PseudoNodeType {
  POST = 'PseudoNodeType.Post',
  QUERY = 'PseudoNodeType.Query',
  PARAMS = 'PseudoNodeType.Params',
  DATA = 'PseudoNodeType.Data',
  ANSWER_LOCAL = 'PseudoNodeType.AnswerLocal',
  ANSWER_REMOTE = 'PseudoNodeType.AnswerRemote',
}

/**
 * Base interface for all pseudo nodes
 */
export interface BasePseudoNode {
  id: PseudoNodeId
  type: PseudoNodeType
  properties: Record<string, unknown>
}

/**
 * QUERY pseudo node - represents URL query parameter
 */
export interface QueryPseudoNode extends BasePseudoNode {
  type: PseudoNodeType.QUERY
  properties: {
    paramName: string
  }
}

/**
 * PARAMS pseudo node - represents URL path parameter
 */
export interface ParamsPseudoNode extends BasePseudoNode {
  type: PseudoNodeType.PARAMS
  properties: {
    paramName: string
  }
}

/**
 * POST pseudo node - represents raw form submission data for a field
 *
 * Stores the base field code and optionally a reference to the field node.
 * Nested property access (e.g., 'fieldName.subProperty') is handled by the expression evaluator.
 */
export interface PostPseudoNode extends BasePseudoNode {
  type: PseudoNodeType.POST
  properties: {
    baseFieldCode: string
    fieldNodeId?: NodeId
  }
}

/**
 * DATA pseudo node - represents external data loaded via onLoad transitions
 *
 * Stores only the base field code.
 * Nested property access (e.g., 'userData.name') is handled by the expression evaluator.
 */
export interface DataPseudoNode extends BasePseudoNode {
  type: PseudoNodeType.DATA
  properties: {
    baseFieldCode: string
  }
}

/**
 * ANSWER_LOCAL pseudo node - represents resolved field answer for a field on the current step
 * Has dependencies on POST, formatters, defaultValue, and onLoad transitions
 *
 * Stores only the base field code.
 * Nested property access (e.g., 'business-type.0.title') is handled by the expression evaluator.
 */
export interface AnswerLocalPseudoNode extends BasePseudoNode {
  type: PseudoNodeType.ANSWER_LOCAL
  properties: {
    baseFieldCode: string
    fieldNodeId: NodeId
  }
}

/**
 * ANSWER_REMOTE pseudo node - represents resolved field answer for a field on a different step
 * Only has dependencies on onLoad transitions (value is read from context.answers)
 *
 * Stores only the base field code.
 * Nested property access (e.g., 'business-type.0.title') is handled by the expression evaluator.
 * All references to the same base field share one pseudo node.
 */
export interface AnswerRemotePseudoNode extends BasePseudoNode {
  type: PseudoNodeType.ANSWER_REMOTE
  properties: {
    baseFieldCode: string
  }
}

/**
 * Union type for answer pseudo nodes
 */
export type AnswerPseudoNode = AnswerLocalPseudoNode | AnswerRemotePseudoNode

/**
 * Union type of all pseudo nodes
 */
export type PseudoNode =
  | PostPseudoNode
  | QueryPseudoNode
  | ParamsPseudoNode
  | DataPseudoNode
  | AnswerLocalPseudoNode
  | AnswerRemotePseudoNode
