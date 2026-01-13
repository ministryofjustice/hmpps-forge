import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import {
  AnswerLocalPseudoNode,
  AnswerRemotePseudoNode,
  DataPseudoNode,
  ParamsPseudoNode,
  PostPseudoNode,
  QueryPseudoNode,
} from '@form-engine/core/types/pseudoNodes.type'
import { NodeId } from '@form-engine/core/types/engine.type'
import PostFactory from '@form-engine/core/nodes/pseudo-nodes/post/PostFactory'
import AnswerLocalFactory from '@form-engine/core/nodes/pseudo-nodes/answer-local/AnswerLocalFactory'
import AnswerRemoteFactory from '@form-engine/core/nodes/pseudo-nodes/answer-remote/AnswerRemoteFactory'
import DataFactory from '@form-engine/core/nodes/pseudo-nodes/data/DataFactory'
import QueryFactory from '@form-engine/core/nodes/pseudo-nodes/query/QueryFactory'
import ParamsFactory from '@form-engine/core/nodes/pseudo-nodes/params/ParamsFactory'

/**
 * PseudoNodeFactory: Creates pseudo nodes with dependency-injected ID generation
 *
 * Pseudo nodes represent runtime data sources that are created during dependency
 * graph building and used during evaluation. Unlike AST nodes which are created
 * at compile time, pseudo nodes are created as needed during graph construction.
 */
export default class PseudoNodeFactory {
  private readonly postFactory: PostFactory

  private readonly answerLocalFactory: AnswerLocalFactory

  private readonly answerRemoteFactory: AnswerRemoteFactory

  private readonly dataFactory: DataFactory

  private readonly queryFactory: QueryFactory

  private readonly paramsFactory: ParamsFactory

  constructor(
    nodeIDGenerator: NodeIDGenerator,
    category: NodeIDCategory.COMPILE_PSEUDO | NodeIDCategory.RUNTIME_PSEUDO,
  ) {
    this.postFactory = new PostFactory(nodeIDGenerator, category)
    this.answerLocalFactory = new AnswerLocalFactory(nodeIDGenerator, category)
    this.answerRemoteFactory = new AnswerRemoteFactory(nodeIDGenerator, category)
    this.dataFactory = new DataFactory(nodeIDGenerator, category)
    this.queryFactory = new QueryFactory(nodeIDGenerator, category)
    this.paramsFactory = new ParamsFactory(nodeIDGenerator, category)
  }

  createPostPseudoNode(baseFieldCode: string, fieldNodeId?: NodeId): PostPseudoNode {
    return this.postFactory.create(baseFieldCode, fieldNodeId)
  }

  createAnswerLocalPseudoNode(baseFieldCode: string, fieldNodeId: NodeId): AnswerLocalPseudoNode {
    return this.answerLocalFactory.create(baseFieldCode, fieldNodeId)
  }

  createAnswerRemotePseudoNode(baseFieldCode: string): AnswerRemotePseudoNode {
    return this.answerRemoteFactory.create(baseFieldCode)
  }

  createDataPseudoNode(baseProperty: string): DataPseudoNode {
    return this.dataFactory.create(baseProperty)
  }

  createQueryPseudoNode(paramName: string): QueryPseudoNode {
    return this.queryFactory.create(paramName)
  }

  createParamsPseudoNode(paramName: string): ParamsPseudoNode {
    return this.paramsFactory.create(paramName)
  }
}
