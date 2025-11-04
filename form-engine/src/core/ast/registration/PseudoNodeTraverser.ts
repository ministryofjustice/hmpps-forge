import { ASTNode, NodeId } from '@form-engine/core/types/engine.type'
import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import {
  structuralTraverse,
  StructuralVisitor,
  StructuralVisitResult,
  StructuralContext,
} from '@form-engine/core/ast/traverser/StructuralTraverser'
import { isBlockStructNode } from '@form-engine/core/typeguards/structure-nodes'
import { isExpressionNode, isReferenceExprNode } from '@form-engine/core/typeguards/expression-nodes'
import { PseudoNodeFactory } from '@form-engine/core/ast/nodes/PseudoNodeFactory'
import { PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'

/**
 * Traverses the AST to discover and create pseudo nodes at compile-time.
 *
 * Pseudo nodes represent runtime data sources (POST data, query params, external data, etc.)
 * that don't exist in the AST but are needed for dependency tracking and evaluation.
 *
 * Pseudo node types created:
 * - POST: Raw form submission data for fields
 * - ANSWER: Resolved field answers (POST + formatters + loaded + defaults)
 * - QUERY: URL query parameters
 * - PARAMS: URL path parameters
 * - DATA: External data loaded via onLoad transitions
 */
export default class PseudoNodeTraverser implements StructuralVisitor {
  /** Track created pseudo nodes by (type, key) to avoid duplicates */
  private readonly created = new Map<PseudoNodeType, Set<string>>()

  constructor(
    private readonly pseudoNodeRegistry: NodeRegistry,
    private readonly pseudoNodeFactory: PseudoNodeFactory,
  ) {}

  /**
   * Visitor method: called when entering a node during traversal
   */
  enterNode(node: ASTNode, _ctx: StructuralContext): StructuralVisitResult {
    // Discover POST and ANSWER pseudo nodes from field blocks
    if (isBlockStructNode(node) && node.blockType === 'field') {
      const code = node.properties?.get('code')

      if (typeof code === 'string') {
        // Literal field code - create pseudo nodes at compile-time
        this.createPostPseudoNode(code)
        this.createAnswerPseudoNode(code, node.id)
      } else if (isExpressionNode(code)) {
        // Expression-based field code (e.g., Format('field_%1', Query('id')) or Item().id)
        // Skip at compile-time - pseudo nodes will be created at runtime when expression evaluates
      }
    }

    // Discover QUERY, PARAMS, DATA pseudo nodes from reference expressions
    if (isReferenceExprNode(node)) {
      const path = node.properties?.get('path')

      if (Array.isArray(path) && path.length >= 2) {
        const [refType, key] = path

        if (typeof key === 'string') {
          switch (refType) {
            case 'post':
              this.createPostPseudoNode(key)
              break

            case 'query':
              this.createQueryPseudoNode(key)
              break

            case 'params':
              this.createParamsPseudoNode(key)
              break

            case 'data':
              this.createDataPseudoNode(key)
              break

            case 'answers':
              // Create Answer pseudo node (may reference answers from previous steps)
              this.createAnswerPseudoNode(key)
              break

            default:
              // Unknown reference type - ignore
              break
          }
        }
      }
    }

    return StructuralVisitResult.CONTINUE
  }

  /**
   * Register all pseudo nodes discovered in the AST
   * @param root The root node of the AST to traverse
   */
  register(root: ASTNode): void {
    structuralTraverse(root, this)
  }

  /**
   * Create a POST pseudo node with deduplication
   */
  private createPostPseudoNode(fieldCode: string): void {
    // Check if already created
    if (this.created.get(PseudoNodeType.POST)?.has(fieldCode)) {
      return
    }

    const node = this.pseudoNodeFactory.createPostPseudoNode(fieldCode)
    this.pseudoNodeRegistry.register(node.id, node, [])

    // Track by (type, key)
    if (!this.created.has(PseudoNodeType.POST)) {
      this.created.set(PseudoNodeType.POST, new Set())
    }

    this.created.get(PseudoNodeType.POST)!.add(fieldCode)
  }

  /**
   * Create an ANSWER pseudo node with deduplication
   */
  private createAnswerPseudoNode(fieldCode: string, fieldNodeId?: NodeId): void {
    // Check if already created
    if (this.created.get(PseudoNodeType.ANSWER)?.has(fieldCode)) {
      return
    }

    const node = this.pseudoNodeFactory.createAnswerPseudoNode(fieldCode, fieldNodeId)
    this.pseudoNodeRegistry.register(node.id, node, [])

    // Track by (type, key)
    if (!this.created.has(PseudoNodeType.ANSWER)) {
      this.created.set(PseudoNodeType.ANSWER, new Set())
    }

    this.created.get(PseudoNodeType.ANSWER)!.add(fieldCode)
  }

  /**
   * Create a QUERY pseudo node with deduplication
   */
  private createQueryPseudoNode(paramName: string): void {
    // Check if already created
    if (this.created.get(PseudoNodeType.QUERY)?.has(paramName)) {
      return
    }

    const node = this.pseudoNodeFactory.createQueryPseudoNode(paramName)
    this.pseudoNodeRegistry.register(node.id, node, [])

    // Track by (type, key)
    if (!this.created.has(PseudoNodeType.QUERY)) {
      this.created.set(PseudoNodeType.QUERY, new Set())
    }

    this.created.get(PseudoNodeType.QUERY)!.add(paramName)
  }

  /**
   * Create a PARAMS pseudo node with deduplication
   */
  private createParamsPseudoNode(paramName: string): void {
    // Check if already created
    if (this.created.get(PseudoNodeType.PARAMS)?.has(paramName)) {
      return
    }

    const node = this.pseudoNodeFactory.createParamsPseudoNode(paramName)
    this.pseudoNodeRegistry.register(node.id, node, [])

    // Track by (type, key)
    if (!this.created.has(PseudoNodeType.PARAMS)) {
      this.created.set(PseudoNodeType.PARAMS, new Set())
    }

    this.created.get(PseudoNodeType.PARAMS)!.add(paramName)
  }

  /**
   * Create a DATA pseudo node with deduplication
   */
  private createDataPseudoNode(dataKey: string): void {
    // Check if already created
    if (this.created.get(PseudoNodeType.DATA)?.has(dataKey)) {
      return
    }

    const node = this.pseudoNodeFactory.createDataPseudoNode(dataKey)
    this.pseudoNodeRegistry.register(node.id, node, [])

    // Track by (type, key)
    if (!this.created.has(PseudoNodeType.DATA)) {
      this.created.set(PseudoNodeType.DATA, new Set())
    }

    this.created.get(PseudoNodeType.DATA)!.add(dataKey)
  }
}
