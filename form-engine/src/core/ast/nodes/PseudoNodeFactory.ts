import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import {
  AnswerPseudoNode,
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
  constructor(private readonly nodeIDGenerator: NodeIDGenerator) {}

  /**
   * Create a POST pseudo node - represents form submission data for a field
   *
   * @param fieldCode - The field code this POST node represents
   * @returns PostPseudoNode with auto-generated ID
   */
  createPostPseudoNode(fieldCode: string): PostPseudoNode {
    return {
      id: this.nodeIDGenerator.next(NodeIDCategory.COMPILE_PSEUDO),
      type: PseudoNodeType.POST,
      metadata: {
        fieldCode,
      },
    }
  }

  /**
   * Create an ANSWER pseudo node - represents field answer with default value fallback
   *
   * @param fieldCode - The field code this ANSWER node represents
   * @param fieldNodeId - Optional reference to the field node for defaultValue lookup
   * @returns AnswerPseudoNode with auto-generated ID
   */
  createAnswerPseudoNode(fieldCode: string, fieldNodeId?: NodeId): AnswerPseudoNode {
    return {
      id: this.nodeIDGenerator.next(NodeIDCategory.COMPILE_PSEUDO),
      type: PseudoNodeType.ANSWER,
      metadata: {
        fieldCode,
        fieldNodeId,
      },
    }
  }

  /**
   * Create a DATA pseudo node - represents external data reference
   *
   * @param dataKey - The data key this DATA node represents
   * @returns DataPseudoNode with auto-generated ID
   */
  createDataPseudoNode(dataKey: string): DataPseudoNode {
    return {
      id: this.nodeIDGenerator.next(NodeIDCategory.COMPILE_PSEUDO),
      type: PseudoNodeType.DATA,
      metadata: {
        dataKey,
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
      id: this.nodeIDGenerator.next(NodeIDCategory.COMPILE_PSEUDO),
      type: PseudoNodeType.QUERY,
      metadata: {
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
      id: this.nodeIDGenerator.next(NodeIDCategory.COMPILE_PSEUDO),
      type: PseudoNodeType.PARAMS,
      metadata: {
        paramName,
      },
    }
  }
}
