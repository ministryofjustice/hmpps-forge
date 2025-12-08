import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import {
  AnswerLocalPseudoNode,
  AnswerRemotePseudoNode,
  DataPseudoNode,
  ParamsPseudoNode,
  PostPseudoNode,
  PseudoNodeType,
  QueryPseudoNode,
} from '@form-engine/core/types/pseudoNodes.type'
import { NodeId } from '@form-engine/core/types/engine.type'

/**
 * PseudoNodeFactory: Creates pseudo nodes with dependency-injected ID generation
 *
 * Pseudo nodes represent runtime data sources that are created during dependency
 * graph building and used during evaluation. Unlike AST nodes which are created
 * at compile time, pseudo nodes are created as needed during graph construction.
 */
export class PseudoNodeFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly category: NodeIDCategory.COMPILE_PSEUDO | NodeIDCategory.RUNTIME_PSEUDO,
  ) {}

  /**
   * Create a POST pseudo node - represents form submission data for a field
   *
   * @param baseFieldCode - The base field code (e.g., 'fieldName')
   * @param fieldNodeId - Optional reference to the field node for accessing field properties
   * @returns PostPseudoNode with auto-generated ID
   */
  createPostPseudoNode(baseFieldCode: string, fieldNodeId?: NodeId): PostPseudoNode {
    return {
      id: this.nodeIDGenerator.next(this.category),
      type: PseudoNodeType.POST,
      properties: {
        baseFieldCode,
        fieldNodeId,
      },
    }
  }

  /**
   * Create an ANSWER_LOCAL pseudo node - represents field answer for a field on the current step
   * Has dependencies on POST, formatters, defaultValue, and onLoad transitions
   *
   * @param baseFieldCode - The base field code (e.g., 'fieldName')
   * @param fieldNodeId - Reference to the field node for dependency tracking
   * @returns AnswerLocalPseudoNode with auto-generated ID
   */
  createAnswerLocalPseudoNode(baseFieldCode: string, fieldNodeId: NodeId): AnswerLocalPseudoNode {
    return {
      id: this.nodeIDGenerator.next(this.category),
      type: PseudoNodeType.ANSWER_LOCAL,
      properties: {
        baseFieldCode,
        fieldNodeId,
      },
    }
  }

  /**
   * Create an ANSWER_REMOTE pseudo node - represents field answer for a field on a different step
   * Only has dependencies on onLoad transitions (value is read from context.answers)
   *
   * @param baseFieldCode - The base field code (e.g., 'fieldName')
   * @returns AnswerRemotePseudoNode with auto-generated ID
   */
  createAnswerRemotePseudoNode(baseFieldCode: string): AnswerRemotePseudoNode {
    return {
      id: this.nodeIDGenerator.next(this.category),
      type: PseudoNodeType.ANSWER_REMOTE,
      properties: {
        baseFieldCode,
      },
    }
  }

  /**
   * Create a DATA pseudo node - represents external data reference
   *
   * @param baseFieldCode - The base field code (e.g., 'userData')
   * @returns DataPseudoNode with auto-generated ID
   */
  createDataPseudoNode(baseFieldCode: string): DataPseudoNode {
    return {
      id: this.nodeIDGenerator.next(this.category),
      type: PseudoNodeType.DATA,
      properties: {
        baseFieldCode,
      },
    }
  }

  /**
   * Create a QUERY pseudo node - represents URL query parameter
   *
   * @param paramName - The query parameter name
   * @returns QueryPseudoNode with auto-generated ID
   */
  createQueryPseudoNode(paramName: string): QueryPseudoNode {
    return {
      id: this.nodeIDGenerator.next(this.category),
      type: PseudoNodeType.QUERY,
      properties: {
        paramName,
      },
    }
  }

  /**
   * Create a PARAMS pseudo node - represents URL path parameter
   *
   * @param paramName - The path parameter name
   * @returns ParamsPseudoNode with auto-generated ID
   */
  createParamsPseudoNode(paramName: string): ParamsPseudoNode {
    return {
      id: this.nodeIDGenerator.next(this.category),
      type: PseudoNodeType.PARAMS,
      properties: {
        paramName,
      },
    }
  }
}
