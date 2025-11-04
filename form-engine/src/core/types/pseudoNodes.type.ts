import { NodeId, PseudoNodeId } from '@form-engine/core/types/engine.type'

/**
 * Types of pseudo nodes in the dependency graph
 * Pseudo nodes represent runtime data sources that aren't part of the AST
 */
export enum PseudoNodeType {
  POST = 'POST',
  QUERY = 'QUERY',
  PARAMS = 'PARAMS',
  DATA = 'DATA',
  ANSWER = 'ANSWER',
}

/**
 * Base interface for all pseudo nodes
 */
export interface BasePseudoNode {
  id: PseudoNodeId
  type: PseudoNodeType
  metadata: Record<string, unknown>
}

/**
 * POST pseudo node - represents raw form submission data for a field
 */
export interface PostPseudoNode extends BasePseudoNode {
  type: PseudoNodeType.POST
  metadata: {
    fieldCode: string
  }
}

/**
 * QUERY pseudo node - represents URL query parameter
 */
export interface QueryPseudoNode extends BasePseudoNode {
  type: PseudoNodeType.QUERY
  metadata: {
    paramName: string
  }
}

/**
 * PARAMS pseudo node - represents URL path parameter
 */
export interface ParamsPseudoNode extends BasePseudoNode {
  type: PseudoNodeType.PARAMS
  metadata: {
    paramName: string
  }
}

/**
 * DATA pseudo node - represents external data loaded via onLoad transitions
 */
export interface DataPseudoNode extends BasePseudoNode {
  type: PseudoNodeType.DATA
  metadata: {
    dataKey: string
  }
}

/**
 * ANSWER pseudo node - represents resolved field answer (POST + formatters + defaultValue)
 */
export interface AnswerPseudoNode extends BasePseudoNode {
  type: PseudoNodeType.ANSWER
  metadata: {
    fieldCode: string
    fieldNodeId?: NodeId
  }
}

/**
 * Union type of all pseudo nodes
 */
export type PseudoNode = PostPseudoNode | QueryPseudoNode | ParamsPseudoNode | DataPseudoNode | AnswerPseudoNode
