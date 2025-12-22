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
import {
  isAccessTransitionNode,
  isActionTransitionNode,
  isLoadTransitionNode,
  isSubmitTransitionNode,
} from '@form-engine/core/typeguards/transition-nodes'
import { isBlockStructNode, isJourneyStructNode, isStepStructNode } from '@form-engine/core/typeguards/structure-nodes'
import { isIterateExprNode, isReferenceExprNode } from '@form-engine/core/typeguards/expression-nodes'
import { isPseudoNode } from '@form-engine/core/typeguards/nodes'

/**
 * Find all nodes relevant for a unified artefact compilation
 *
 * This creates a single artefact with smart property filtering based on whether
 * a step is the current step being rendered or not.
 *
 * For the CURRENT STEP (isCurrentStep = true):
 * - Full traversal of all properties (blocks with rendering properties)
 * - onLoad, onSubmission, all block properties
 *
 * For ANCESTOR journeys/steps:
 * - Their onLoad transitions (because they affect current step)
 *
 * For OTHER STEPS:
 * - Navigation metadata (path, title)
 * - onSubmission (for journey navigation)
 * - Block validation properties only (code, validate, dependent, formatPipeline, defaultValue)
 * - NO rendering properties (label, hint, items, etc.)
 *
 * This approach:
 * - Creates one artefact with one handler set
 * - Effects run once
 * - Skips evaluating rendering thunks for off-screen steps
 *
 * @param rootNode - Root journey node to search from
 * @param nodeRegistry - Registry containing all nodes
 * @param metadataRegistry - Registry containing node metadata (isAncestorOfStep, isCurrentStep, etc.)
 * @returns Array of all relevant AST and pseudo nodes for unified artifact compilation
 */
export function findRelevantNodes(
  rootNode: JourneyASTNode,
  nodeRegistry: NodeRegistry,
  metadataRegistry: MetadataRegistry,
) {
  const nodes: (ASTNode | PseudoNode)[] = []

  // Collect transition nodes using dedicated functions
  const onLoadNodes = collectOnLoadTransitionsFromAncestors(rootNode, metadataRegistry)
  const onAccessNodes = collectOnAccessTransitionsFromAncestors(rootNode, metadataRegistry)
  const onActionNodes = collectOnActionTransitionsFromCurrentStep(rootNode, metadataRegistry)
  const onSubmitNodes = collectOnSubmitTransitionsFromAllSteps(rootNode)

  nodes.push(...onLoadNodes, ...onAccessNodes, ...onActionNodes, ...onSubmitNodes)

  structuralTraverse(rootNode, {
    enterNode: (node: ASTNode): VisitorResult => {
      // Skip all transition nodes - they're handled by the dedicated collection functions above
      if (
        isLoadTransitionNode(node) ||
        isAccessTransitionNode(node) ||
        isActionTransitionNode(node) ||
        isSubmitTransitionNode(node)
      ) {
        return StructuralVisitResult.SKIP
      }

      // Handle the CURRENT step - full traversal
      if (isStepStructNode(node) && metadataRegistry.get(node.id, 'isCurrentStep')) {
        // Push the step node itself first
        nodes.push(node)

        // Then traverse all descendants
        structuralTraverse(node, {
          enterNode(childNode: ASTNode): VisitorResult {
            // Skip the step node itself (already added above)
            if (childNode.id === node.id) {
              return StructuralVisitResult.CONTINUE
            }

            // Skip transition nodes - they're already collected by the dedicated functions above
            if (
              isLoadTransitionNode(childNode) ||
              isAccessTransitionNode(childNode) ||
              isActionTransitionNode(childNode) ||
              isSubmitTransitionNode(childNode)
            ) {
              return StructuralVisitResult.SKIP
            }

            nodes.push(childNode)
            return StructuralVisitResult.CONTINUE
          },
        })

        return StructuralVisitResult.SKIP
      }

      // Collect all nodes that pass through the property filter
      nodes.push(node)

      return StructuralVisitResult.CONTINUE
    },

    /**
     * Property filtering for non-current steps
     *
     * Current step gets full traversal (handled above with inner structuralTraverse).
     * Other steps/blocks get filtered properties for validation/navigation only.
     */
    enterProperty: (key: string, value: any, ctx: StructuralContext): VisitorResult => {
      const { parent } = ctx

      // Journey nodes: only traverse specific properties or iterators
      if (isJourneyStructNode(parent)) {
        const allowedProps = ['children', 'steps', 'view']

        if (allowedProps.includes(key)) {
          return StructuralVisitResult.CONTINUE
        }

        if (isIterateExprNode(value)) {
          return StructuralVisitResult.CONTINUE
        }

        return StructuralVisitResult.SKIP
      }

      // Step nodes (non-current): only traverse metadata/navigation properties
      if (isStepStructNode(parent)) {
        const allowedProps = ['blocks', 'view']

        if (allowedProps.includes(key)) {
          return StructuralVisitResult.CONTINUE
        }

        return StructuralVisitResult.SKIP
      }

      // Block nodes (non-current step): only validation/dependency properties
      if (isBlockStructNode(parent)) {
        const allowedProps = ['code', 'validate', 'dependent', 'formatPipeline', 'defaultValue']

        if (allowedProps.includes(key)) {
          return StructuralVisitResult.CONTINUE
        }

        if (isBlockStructNode(value)) {
          return StructuralVisitResult.CONTINUE
        }

        return StructuralVisitResult.SKIP
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
    answers: new Set<string>(), // Answer() and Post() base field codes
    data: new Set<string>(), // Data() base property names
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
      case 'post': {
        // Extract base field code (before the dot)
        const baseFieldCode = identifier.split('.')[0]
        identifiers.answers.add(baseFieldCode)
        break
      }
      case 'data': {
        // Extract base property name (before the dot)
        const baseProperty = identifier.split('.')[0]
        identifiers.data.add(baseProperty)
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
          case PseudoNodeType.POST:
            return identifiers.answers.has(pseudoNode.properties.baseFieldCode)

          case PseudoNodeType.DATA:
            return identifiers.data.has(pseudoNode.properties.baseProperty)

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

/**
 * Collect all OnLoad transition nodes from ancestor journeys/steps
 *
 * OnLoad transitions fire when entering a journey/step. For ancestor nodes,
 * these transitions have already fired and their effects should be included
 * in the current step's evaluation context.
 *
 * @param rootNode - Root journey node to search from
 * @param metadataRegistry - Registry containing node metadata (isAncestorOfStep, etc.)
 * @returns Array of all AST nodes within OnLoad transitions of ancestors
 */
function collectOnLoadTransitionsFromAncestors(
  rootNode: JourneyASTNode,
  metadataRegistry: MetadataRegistry,
): ASTNode[] {
  const nodes: ASTNode[] = []

  structuralTraverse(rootNode, {
    enterNode: (node: ASTNode, ctx: StructuralContext): VisitorResult => {
      if (!isLoadTransitionNode(node)) {
        return StructuralVisitResult.CONTINUE
      }

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

      return StructuralVisitResult.SKIP
    },
  })

  return nodes
}

/**
 * Collect all OnAccess transition nodes from ancestor journeys/steps
 *
 * OnAccess transitions fire when a step is accessed (rendered). For ancestor nodes,
 * these transitions should be included when they affect the current step's context.
 *
 * @param rootNode - Root journey node to search from
 * @param metadataRegistry - Registry containing node metadata (isAncestorOfStep, etc.)
 * @returns Array of all AST nodes within OnAccess transitions of ancestors
 */
function collectOnAccessTransitionsFromAncestors(
  rootNode: JourneyASTNode,
  metadataRegistry: MetadataRegistry,
): ASTNode[] {
  const nodes: ASTNode[] = []

  structuralTraverse(rootNode, {
    enterNode: (node: ASTNode, ctx: StructuralContext): VisitorResult => {
      if (!isAccessTransitionNode(node)) {
        return StructuralVisitResult.CONTINUE
      }

      // Find the Journey/Step node that owns this OnAccess transition
      const ownerNode = ctx.ancestors
        .filter(ancestor => isJourneyStructNode(ancestor) || isStepStructNode(ancestor))
        .at(-1)

      if (ownerNode && metadataRegistry.get(ownerNode.id, 'isAncestorOfStep')) {
        // Owner is ancestor of step - traverse this OnAccess subtree
        structuralTraverse(node, {
          enterNode(childNode: ASTNode): VisitorResult {
            nodes.push(childNode)
            return StructuralVisitResult.CONTINUE
          },
        })
      }

      return StructuralVisitResult.SKIP
    },
  })

  return nodes
}

/**
 * Collect all OnAction transition nodes from the current step only
 *
 * OnAction transitions fire on POST requests before block evaluation.
 * Only collected from the current step (step-level only).
 *
 * @param rootNode - Root journey node to search from
 * @param metadataRegistry - Registry containing node metadata (isCurrentStep, etc.)
 * @returns Array of all AST nodes within OnAction transitions of the current step
 */
function collectOnActionTransitionsFromCurrentStep(
  rootNode: JourneyASTNode,
  metadataRegistry: MetadataRegistry,
): ASTNode[] {
  const nodes: ASTNode[] = []

  structuralTraverse(rootNode, {
    enterNode: (node: ASTNode, ctx: StructuralContext): VisitorResult => {
      if (!isActionTransitionNode(node)) {
        return StructuralVisitResult.CONTINUE
      }

      // Find the Step node that owns this OnAction transition
      const ownerNode = ctx.ancestors.filter(ancestor => isStepStructNode(ancestor)).at(-1)

      if (ownerNode && metadataRegistry.get(ownerNode.id, 'isCurrentStep')) {
        // Owner is the current step - traverse this OnAction subtree
        structuralTraverse(node, {
          enterNode(childNode: ASTNode): VisitorResult {
            nodes.push(childNode)
            return StructuralVisitResult.CONTINUE
          },
        })
      }

      return StructuralVisitResult.SKIP
    },
  })

  return nodes
}

/**
 * Collect all OnSubmit transition nodes from all steps
 *
 * OnSubmit transitions define navigation and validation behavior.
 * These are needed from all steps for journey-wide navigation logic.
 *
 * @param rootNode - Root journey node to search from
 * @returns Array of all AST nodes within OnSubmit transitions
 */
export function collectOnSubmitTransitionsFromAllSteps(rootNode: JourneyASTNode): ASTNode[] {
  const nodes: ASTNode[] = []

  structuralTraverse(rootNode, {
    enterNode: (node: ASTNode, ctx: StructuralContext): VisitorResult => {
      if (!isSubmitTransitionNode(node)) {
        return StructuralVisitResult.CONTINUE
      }

      // Find the Step node that owns this OnSubmit transition
      const ownerNode = ctx.ancestors.filter(ancestor => isStepStructNode(ancestor)).at(-1)

      if (ownerNode) {
        // Traverse this OnSubmit subtree
        structuralTraverse(node, {
          enterNode(childNode: ASTNode): VisitorResult {
            nodes.push(childNode)
            return StructuralVisitResult.CONTINUE
          },
        })
      }

      return StructuralVisitResult.SKIP
    },
  })

  return nodes
}
