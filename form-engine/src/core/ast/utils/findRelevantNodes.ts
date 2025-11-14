import { JourneyASTNode } from '@form-engine/core/types/structures.type'
import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import MetadataRegistry from '@form-engine/core/ast/registration/MetadataRegistry'
import { ASTNode } from '@form-engine/core/types/engine.type'
import { PseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import {
  StructuralContext,
  structuralTraverse,
  StructuralVisitResult,
  VisitorResult,
} from '@form-engine/core/ast/traverser/StructuralTraverser'
import { isLoadTransitionNode, isSubmitTransitionNode } from '@form-engine/core/typeguards/transition-nodes'
import { isBlockStructNode, isJourneyStructNode, isStepStructNode } from '@form-engine/core/typeguards/structure-nodes'
import { isReferenceExprNode } from '@form-engine/core/typeguards/expression-nodes'
import { isPseudoNode } from '@form-engine/core/typeguards/nodes'

export function findStepArtefactRelevantNodes(
  rootNode: JourneyASTNode,
  nodeRegistry: NodeRegistry,
  metadataRegistry: MetadataRegistry,
) {
  const nodes: (ASTNode | PseudoNode)[] = []

  structuralTraverse(rootNode, {
    enterNode: (node: ASTNode, ctx: StructuralContext): VisitorResult => {
      // Handle OnLoad transitions whose owner is ancestor of step
      if (isLoadTransitionNode(node)) {
        // Find the Journey/Step node that owns this OnLoad transition
        const ownerNode = ctx.ancestors
          .filter(ancestor => isJourneyStructNode(ancestor) || isStepStructNode(ancestor))
          .at(-1)

        if (ownerNode && metadataRegistry.get(ownerNode.id, 'isAncestorOfStep')) {
          // Owner is ancestor of step - traverse this OnLoad subtree
          structuralTraverse(node, {
            enterNode(childNode: ASTNode): VisitorResult {
              nodes.push(childNode)
              return StructuralVisitResult.CONTINUE
            },
          })
        }

        // Skip in outer traversal - we already handled this subtree (or decided not to)
        return StructuralVisitResult.SKIP
      }

      // Handle Step nodes marked as ancestor of step
      if (isStepStructNode(node) && metadataRegistry.get(node.id, 'isAncestorOfStep')) {
        // Traverse entire Step subtree
        structuralTraverse(node, {
          enterNode(childNode: ASTNode): VisitorResult {
            nodes.push(childNode)
            return StructuralVisitResult.CONTINUE
          },
        })

        // Skip in outer traversal - we already handled this subtree
        return StructuralVisitResult.SKIP
      }

      if (isJourneyStructNode(node) && metadataRegistry.get(node.id, 'isAncestorOfStep')) {
        nodes.push(node)
      }

      return StructuralVisitResult.CONTINUE
    },
  })

  return [...nodes, ...findRelevantPseudoNodes(nodes, nodeRegistry)]
}

export function findJourneyMetadataArtefactRelevantNodes(
  rootNode: JourneyASTNode,
  nodeRegistry: NodeRegistry,
  metadataRegistry: MetadataRegistry,
) {
  const nodes: (ASTNode | PseudoNode)[] = []

  structuralTraverse(rootNode, {
    enterNode: (node: ASTNode, ctx: StructuralContext): VisitorResult => {
      // Handle OnLoad transitions whose owner is ancestor of step
      if (isLoadTransitionNode(node)) {
        // We need to look back in ancestors for the last Journey/Step node
        const ownerNode = ctx.ancestors
          .filter(ancestor => isJourneyStructNode(ancestor) || isStepStructNode(ancestor))
          .at(-1)

        if (ownerNode && metadataRegistry.get(ownerNode.id, 'isAncestorOfStep')) {
          // Owner is ancestor of step - traverse this OnLoad subtree
          structuralTraverse(node, {
            enterNode(childNode: ASTNode): VisitorResult {
              nodes.push(childNode)
              return StructuralVisitResult.CONTINUE
            },
          })
        }

        // Skip in outer traversal - we already handled this subtree (or decided not to)
        return StructuralVisitResult.SKIP
      }

      // Handle OnSubmit transitions from all steps
      if (isSubmitTransitionNode(node)) {
        const ownerNode = ctx.ancestors
          .filter(ancestor => isStepStructNode(ancestor))
          .at(-1)

        if (ownerNode) {
          structuralTraverse(node, {
            enterNode(childNode: ASTNode): VisitorResult {
              nodes.push(childNode)
              return StructuralVisitResult.CONTINUE
            },
          })
        }

        // Skip in outer traversal - we already handled this subtree (or decided not to)
        return StructuralVisitResult.SKIP
      }

      // Collect this node
      nodes.push(node)

      return StructuralVisitResult.CONTINUE
    },

    enterProperty: (key: string, value: any, ctx: StructuralContext): VisitorResult => {
      const { parent } = ctx

      // Journey nodes: only traverse specific properties
      if (isJourneyStructNode(parent)) {
        const allowedProps = ['path', 'title', 'description', 'journeys', 'steps', 'onLoad']
        return allowedProps.includes(key) ? StructuralVisitResult.CONTINUE : StructuralVisitResult.SKIP
      }

      // Step nodes: only traverse specific properties
      if (isStepStructNode(parent)) {
        const allowedProps = ['path', 'title', 'description', 'entry', 'onSubmission', 'blocks', 'onLoad']
        return allowedProps.includes(key) ? StructuralVisitResult.CONTINUE : StructuralVisitResult.SKIP
      }

      // Block nodes: only traverse specific properties
      if (isBlockStructNode(parent)) {
        const allowedProps = ['code', 'validate', 'dependent', 'formatPipeline', 'defaultValue']
        return allowedProps.includes(key) ? StructuralVisitResult.CONTINUE : StructuralVisitResult.SKIP
      }

      return StructuralVisitResult.CONTINUE
    },
  })

  return [...nodes, ...findRelevantPseudoNodes(nodes, nodeRegistry)]
}

/**
 * Find all pseudo nodes referenced by the given AST nodes
 * @param nodes - Array of AST nodes to scan for references
 * @param nodeRegistry - Registry containing all pseudo nodes
 */
export function findRelevantPseudoNodes(nodes: (ASTNode | PseudoNode)[], nodeRegistry: NodeRegistry): PseudoNode[] {
  // Extract reference nodes from collected nodes
  const referenceNodes = nodes.filter(isReferenceExprNode)

  // Extract identifiers from reference nodes
  const identifiers = {
    answers: new Set<string>(), // Answer() and Data() base field codes
    query: new Set<string>(), // Query() param names
    params: new Set<string>(), // Params() param names
  }

  referenceNodes.forEach(refNode => {
    const path = refNode.properties.path as string[]

    if (!Array.isArray(path) || path.length < 2) {
      return
    }

    const source = path[0] // 'answers', 'data', 'post', 'query', 'params'
    const identifier = path[1] // 'firstName', 'user', 'redirect_url', etc.

    switch (source) {
      case 'answers':
      case 'data':
      case 'post': {
        // Extract base field code (before the dot)
        const baseFieldCode = identifier.split('.')[0]
        identifiers.answers.add(baseFieldCode)
        break
      }
      case 'query':
        identifiers.query.add(identifier)
        break

      case 'params':
        identifiers.params.add(identifier)
        break
      default:
        break
    }
  })

  // Filter pseudo nodes from registry that match those identifiers
  return (
    Array.from(nodeRegistry.getAll().values())
      .filter(isPseudoNode)
      .filter(pseudoNode => {
        switch (pseudoNode.type) {
          case PseudoNodeType.ANSWER_LOCAL:
          case PseudoNodeType.ANSWER_REMOTE:
          case PseudoNodeType.DATA:
          case PseudoNodeType.POST:
            return identifiers.answers.has(pseudoNode.properties.baseFieldCode)

          case PseudoNodeType.QUERY:
            return identifiers.query.has(pseudoNode.properties.paramName)

          case PseudoNodeType.PARAMS:
            return identifiers.params.has(pseudoNode.properties.paramName)

          default:
            return false
        }
      })
  )
}
