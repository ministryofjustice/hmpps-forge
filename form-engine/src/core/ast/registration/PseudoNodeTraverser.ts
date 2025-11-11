import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import MetadataRegistry from '@form-engine/core/ast/registration/MetadataRegistry'
import { isReferenceExprNode } from '@form-engine/core/typeguards/expression-nodes'
import { PseudoNodeFactory } from '@form-engine/core/ast/nodes/PseudoNodeFactory'
import { PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { BlockASTNode } from '@form-engine/core/types/structures.type'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionASTNode } from '@form-engine/core/types/expressions.type'

/**
 * Traverses the AST to discover and create pseudo nodes at compile-time.
 *
 * Pseudo nodes represent runtime data sources (POST data, query params, external data, etc.)
 * that don't exist in the AST but are needed for dependency tracking and evaluation.
 *
 * Pseudo node types created:
 * - POST: Raw form submission data for fields
 * - ANSWER_LOCAL: Resolved field answers for fields on current step (POST + formatters + loaded + defaults)
 * - ANSWER_REMOTE: Field answers from other steps (read from context.answers)
 * - QUERY: URL query parameters
 * - PARAMS: URL path parameters
 * - DATA: External data loaded via onLoad transitions
 */
export default class PseudoNodeTraverser {
  /** Track created pseudo nodes by (type, key) to avoid duplicates */
  private readonly created = new Map<PseudoNodeType, Set<string>>()

  constructor(
    private readonly nodeRegistry: NodeRegistry,
    private readonly pseudoNodeFactory: PseudoNodeFactory,
    private readonly metadataRegistry: MetadataRegistry,
  ) {
    // Pre-populate all pseudo node type sets to avoid existence checks
    this.created.set(PseudoNodeType.POST, new Set())
    this.created.set(PseudoNodeType.ANSWER_LOCAL, new Set())
    this.created.set(PseudoNodeType.ANSWER_REMOTE, new Set())
    this.created.set(PseudoNodeType.QUERY, new Set())
    this.created.set(PseudoNodeType.PARAMS, new Set())
    this.created.set(PseudoNodeType.DATA, new Set())
  }

  createPseudoNodes() {
    // Setup AnswerLocalPseudoNodes first
    this.nodeRegistry.findByType<BlockASTNode>(ASTNodeType.BLOCK)
      .filter(blockNode => blockNode.blockType === 'field')
      .forEach(blockNode => {
        const fieldCode = blockNode.properties.get('code')

        if (typeof fieldCode === 'string') {
          // Check if the field is on the current step
          if (this.metadataRegistry.get(blockNode.id, 'isDescendantOfStep', false)) {
            this.createAnswerLocalPseudoNode(blockNode, fieldCode)
            this.createPostPseudoNode(fieldCode)
          }
        }
        // TODO: If its not a string, we need to defer this till runtime somehow.
      })

    // Setup all other reference nodes
    this.nodeRegistry.findByType<ExpressionASTNode>(ASTNodeType.EXPRESSION)
      .filter(isReferenceExprNode)
      .forEach(referenceExpressionNode => {
        const path = referenceExpressionNode.properties.get('path')

        if (Array.isArray(path) && path.length >= 2) {
          const [referenceSource, key] = path

          if (typeof key === 'string') {
            // Expand dotted paths like 'field.subProperty' into ['field', 'subProperty']
            const expandedKey = this.expandPath(key)
            const baseFieldCode = expandedKey[0]

            switch (referenceSource) {
              case 'query':
                this.createQueryPseudoNode(key)
                break

              case 'params':
                this.createParamsPseudoNode(key)
                break

              case 'post':
                // Create pseudo node with only base field name
                this.createPostPseudoNode(baseFieldCode)
                break

              case 'data':
                // Create pseudo node with only base field name
                this.createDataPseudoNode(baseFieldCode)
                break

              case 'answers':
                // Create pseudo node with only base field name
                this.createAnswerRemotePseudoNode(baseFieldCode)
                break

              default:
                break
            }
          }
        }
      })
  }

  /**
   * Expand a dotted path string into an array of path segments.
   * Handles nested property access like 'field.subProperty' or array access like 'field.0'
   *
   * @example
   * expandPath('fieldName') → ['fieldName']
   * expandPath('fieldName.subProperty') → ['fieldName', 'subProperty']
   * expandPath('fieldName.0') → ['fieldName', '0']
   * expandPath('fieldName.nested.deep') → ['fieldName', 'nested', 'deep']
   */
  private expandPath(pathString: string): string[] {
    return pathString.split('.')
  }

  /**
   * Create a POST pseudo node with deduplication
   */
  private createPostPseudoNode(baseFieldCode: string): void {
    // Check if already created
    if (this.created.get(PseudoNodeType.POST).has(baseFieldCode)) {
      return
    }

    const node = this.pseudoNodeFactory.createPostPseudoNode(baseFieldCode)

    this.nodeRegistry.register(node.id, node)
    this.created.get(PseudoNodeType.POST).add(baseFieldCode)
  }

  /**
   * Create an ANSWER pseudo node with deduplication
   * Creates ANSWER_REMOTE for representing Answers that are not also fields on the current Step.
   */
  private createAnswerRemotePseudoNode(baseFieldCode: string): void {
    // Check if already created
    // Note: Also checks if the `local` equivalent exists, as that takes preference.
    if (
      this.created.get(PseudoNodeType.ANSWER_REMOTE).has(baseFieldCode) ||
      this.created.get(PseudoNodeType.ANSWER_LOCAL).has(baseFieldCode)
    ) {
      return
    }

    const answerPseudoNode = this.pseudoNodeFactory.createAnswerRemotePseudoNode(baseFieldCode)

    this.nodeRegistry.register(answerPseudoNode.id, answerPseudoNode)
    this.created.get(PseudoNodeType.ANSWER_REMOTE).add(baseFieldCode)
  }

  /**
   * Create an ANSWER pseudo node with deduplication
   * Creates ANSWER_LOCAL for representing Answers that are fields on the current Step.
   */
  private createAnswerLocalPseudoNode(fieldNode: BlockASTNode, fieldCode: string): void {
    // Check if already created
    // Note: this shouldn't ever occur, unless someone fudged up and made 2 fields with the same code on a single step
    if (this.created.get(PseudoNodeType.ANSWER_LOCAL).has(fieldCode)) {
      return
    }

    const answerPseudoNode = this.pseudoNodeFactory.createAnswerLocalPseudoNode(fieldCode, fieldNode.id)

    this.nodeRegistry.register(answerPseudoNode.id, answerPseudoNode)
    this.created.get(PseudoNodeType.ANSWER_LOCAL).add(fieldCode)
  }

  /**
   * Create a QUERY pseudo node with deduplication
   */
  private createQueryPseudoNode(paramName: string): void {
    // Check if already created
    if (this.created.get(PseudoNodeType.QUERY).has(paramName)) {
      return
    }

    const node = this.pseudoNodeFactory.createQueryPseudoNode(paramName)

    this.nodeRegistry.register(node.id, node)
    this.created.get(PseudoNodeType.QUERY).add(paramName)
  }

  /**
   * Create a PARAMS pseudo node with deduplication
   */
  private createParamsPseudoNode(paramName: string): void {
    // Check if already created
    if (this.created.get(PseudoNodeType.PARAMS).has(paramName)) {
      return
    }

    const node = this.pseudoNodeFactory.createParamsPseudoNode(paramName)

    this.nodeRegistry.register(node.id, node)
    this.created.get(PseudoNodeType.PARAMS).add(paramName)
  }

  /**
   * Create a DATA pseudo node with deduplication
   */
  private createDataPseudoNode(baseFieldCode: string): void {
    // Check if already created
    if (this.created.get(PseudoNodeType.DATA).has(baseFieldCode)) {
      return
    }

    const node = this.pseudoNodeFactory.createDataPseudoNode(baseFieldCode)

    this.nodeRegistry.register(node.id, node)
    this.created.get(PseudoNodeType.DATA).add(baseFieldCode)
  }
}
