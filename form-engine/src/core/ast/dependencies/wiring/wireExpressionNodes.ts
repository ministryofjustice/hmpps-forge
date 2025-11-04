import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import {
  isReferenceExprNode,
  isConditionalExprNode,
  isPipelineExprNode,
  isFormatExprNode,
  isFunctionExprNode,
  isPredicateExprNode,
  isValidationExprNode,
} from '@form-engine/core/typeguards/expression-nodes'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { NodeId } from '@form-engine/core/types/engine.type'
import {
  isPredicateTestNode,
  isPredicateNotNode,
  isPredicateAndNode,
  isPredicateOrNode,
  isPredicateXorNode,
} from '@form-engine/core/typeguards/predicate-nodes'
import {
  ReferenceASTNode,
  ConditionalASTNode,
  PipelineASTNode,
  FormatASTNode,
  FunctionASTNode,
  PredicateASTNode,
  ValidationASTNode,
} from '@form-engine/core/types/expressions.type'
import { PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { buildPseudoNodeLookup } from '@form-engine/core/ast/dependencies/wiring/buildPseudoNodeLookup'

export function wireExpressionNodes(
  astNodeRegistry: NodeRegistry,
  pseudoNodeRegistry: NodeRegistry,
  graph: DependencyGraph,
): void {
  // Build lookup maps for pseudo nodes
  const pseudoNodeByType = buildPseudoNodeLookup(pseudoNodeRegistry)

  // Iterate through all AST nodes and wire expression dependencies
  astNodeRegistry.getAll().forEach((node, nodeId) => {
    // Reference expressions → pseudo nodes
    if (isReferenceExprNode(node)) {
      wireReferenceExpression(nodeId, node, pseudoNodeByType, graph)
    }

    // Conditional expressions → predicate, then, else
    if (isConditionalExprNode(node)) {
      wireConditionalExpression(nodeId, node, graph)
    }

    // Pipeline expressions → input, transformers
    if (isPipelineExprNode(node)) {
      wirePipelineExpression(nodeId, node, graph)
    }

    // Format expressions → arguments
    if (isFormatExprNode(node)) {
      wireFormatExpression(nodeId, node, graph)
    }

    // Function expressions → arguments
    if (isFunctionExprNode(node)) {
      wireFunctionExpression(nodeId, node, graph)
    }

    // Predicate expressions → subject, operand, condition
    if (isPredicateExprNode(node)) {
      wirePredicateExpression(nodeId, node, graph)
    }

    // Validation expressions → condition
    if (isValidationExprNode(node)) {
      wireValidationExpression(nodeId, node, graph)
    }
  })
}

/**
 * Wire reference expression to its pseudo node
 */
function wireReferenceExpression(
  referenceNodeId: NodeId,
  referenceNode: ReferenceASTNode,
  pseudoNodeLookup: Map<PseudoNodeType, Map<string, NodeId>>,
  graph: DependencyGraph,
): void {
  const path = referenceNode.properties.get('path')

  if (!Array.isArray(path) || path.length < 2) {
    return
  }

  const [refType, key] = path

  if (typeof key !== 'string') {
    return
  }

  // Map reference type to pseudo node type
  let pseudoNodeType: PseudoNodeType | undefined

  if (refType === 'post') {
    pseudoNodeType = PseudoNodeType.POST
  } else if (refType === 'query') {
    pseudoNodeType = PseudoNodeType.QUERY
  } else if (refType === 'params') {
    pseudoNodeType = PseudoNodeType.PARAMS
  } else if (refType === 'data') {
    pseudoNodeType = PseudoNodeType.DATA
  } else if (refType === 'answers') {
    pseudoNodeType = PseudoNodeType.ANSWER
  }

  // Find pseudo node
  const typeMap = pseudoNodeLookup.get(pseudoNodeType)
  const pseudoNodeId = typeMap?.get(key)

  if (!pseudoNodeId) {
    return
  }

  // Wire pseudo node → reference (pseudo node must be evaluated before reference)
  graph.addEdge(pseudoNodeId, referenceNodeId, DependencyEdgeType.DATA_FLOW, {
    referenceType: refType,
    key,
  })
}

/**
 * Wire conditional expression to its predicate, then, and else branches
 */
function wireConditionalExpression(
  conditionalNodeId: NodeId,
  conditionalNode: ConditionalASTNode,
  graph: DependencyGraph,
): void {
  const predicate = conditionalNode.properties.get('predicate')
  const thenValue = conditionalNode.properties.get('then')
  const elseValue = conditionalNode.properties.get('else')

  // Wire predicate → conditional (predicate must be evaluated before conditional)
  if (isASTNode(predicate)) {
    graph.addEdge(predicate.id, conditionalNodeId, DependencyEdgeType.DATA_FLOW, {
      property: 'predicate',
    })
  }

  // Wire then branch → conditional
  if (isASTNode(thenValue)) {
    graph.addEdge(thenValue.id, conditionalNodeId, DependencyEdgeType.DATA_FLOW, {
      property: 'then',
    })
  }

  // Wire else branch → conditional
  if (isASTNode(elseValue)) {
    graph.addEdge(elseValue.id, conditionalNodeId, DependencyEdgeType.DATA_FLOW, {
      property: 'else',
    })
  }
}

/**
 * Wire pipeline expression to its input and transformers
 */
function wirePipelineExpression(pipelineNodeId: NodeId, pipelineNode: PipelineASTNode, graph: DependencyGraph): void {
  const input = pipelineNode.properties.get('input')
  const transformers = pipelineNode.properties.get('transformers')

  // Wire input → pipeline (input must be evaluated before pipeline)
  if (isASTNode(input) && input.id) {
    graph.addEdge(input.id, pipelineNodeId, DependencyEdgeType.DATA_FLOW, {
      property: 'input',
    })
  }

  // Wire transformers → pipeline
  if (Array.isArray(transformers)) {
    transformers.filter(isASTNode).forEach((transformer, index) => {
      graph.addEdge(transformer.id, pipelineNodeId, DependencyEdgeType.DATA_FLOW, {
        property: 'transformers',
        index,
      })
    })
  }
}

/**
 * Wire format expression to its arguments
 */
function wireFormatExpression(formatNodeId: NodeId, formatNode: FormatASTNode, graph: DependencyGraph): void {
  const args = formatNode.properties.get('arguments')

  if (Array.isArray(args)) {
    args.filter(isASTNode).forEach((arg, index) => {
      graph.addEdge(arg.id, formatNodeId, DependencyEdgeType.DATA_FLOW, {
        property: 'arguments',
        index,
      })
    })
  }
}

/**
 * Wire function expression to its arguments
 */
function wireFunctionExpression(functionNodeId: NodeId, functionNode: FunctionASTNode, graph: DependencyGraph): void {
  const args = functionNode.properties.get('arguments')

  if (Array.isArray(args)) {
    args.filter(isASTNode).forEach((arg, index) => {
      graph.addEdge(arg.id, functionNodeId, DependencyEdgeType.DATA_FLOW, {
        property: 'arguments',
        index,
      })
    })
  }
}

/**
 * Wire predicate expression to its operands based on predicate type
 * - TEST: subject and condition
 * - NOT: single operand
 * - AND/OR/XOR: multiple operands
 */
function wirePredicateExpression(
  predicateNodeId: NodeId,
  predicateNode: PredicateASTNode,
  graph: DependencyGraph,
): void {
  // TEST: subject.condition with optional negation
  if (isPredicateTestNode(predicateNode)) {
    const subject = predicateNode.properties.get('subject')
    const condition = predicateNode.properties.get('condition')

    if (isASTNode(subject)) {
      graph.addEdge(subject.id, predicateNodeId, DependencyEdgeType.DATA_FLOW, {
        property: 'subject',
      })
    }

    if (isASTNode(condition)) {
      graph.addEdge(condition.id, predicateNodeId, DependencyEdgeType.DATA_FLOW, {
        property: 'condition',
      })
    }

    return
  }

  // NOT: Single operand negation
  if (isPredicateNotNode(predicateNode)) {
    const operand = (predicateNode as PredicateASTNode).properties.get('operand')

    if (isASTNode(operand)) {
      graph.addEdge(operand.id, predicateNodeId, DependencyEdgeType.DATA_FLOW, {
        property: 'operand',
      })
    }

    return
  }

  // AND/OR/XOR: Multiple operands
  if (isPredicateAndNode(predicateNode) || isPredicateOrNode(predicateNode) || isPredicateXorNode(predicateNode)) {
    const operands = (predicateNode as PredicateASTNode).properties.get('operands')

    if (Array.isArray(operands)) {
      operands.filter(isASTNode).forEach((operand, index) => {
        graph.addEdge(operand.id, predicateNodeId, DependencyEdgeType.DATA_FLOW, {
          property: 'operands',
          index,
        })
      })
    }
  }
}

/**
 * Wire validation expression to its condition
 */
function wireValidationExpression(
  validationNodeId: NodeId,
  validationNode: ValidationASTNode,
  graph: DependencyGraph,
): void {
  const condition = validationNode.properties.get('condition')

  // Wire condition → validation (condition must be evaluated before validation)
  if (isASTNode(condition)) {
    graph.addEdge(condition.id, validationNodeId, DependencyEdgeType.DATA_FLOW, {
      property: 'condition',
    })
  }
}
