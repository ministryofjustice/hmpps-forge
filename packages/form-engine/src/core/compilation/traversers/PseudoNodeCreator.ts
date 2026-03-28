import NodeRegistry from '@form-engine/core/compilation/registries/NodeRegistry'
import MetadataRegistry from '@form-engine/core/compilation/registries/MetadataRegistry'
import PseudoNodeFactory from '@form-engine/core/nodes/PseudoNodeFactory'
import { getPseudoNodeKey } from '@form-engine/core/utils/pseudoNodeKeyExtractor'
import { PseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { NodeId } from '@form-engine/core/types/engine.type'
import { FieldBlockASTNode } from '@form-engine/core/types/structures.type'
import { ReferenceASTNode } from '@form-engine/core/types/expressions.type'

/**
 * Creates pseudo nodes for field blocks and reference expressions.
 *
 * Pseudo nodes represent runtime data sources (POST data, query params, external data, etc.)
 * that don't exist in the AST but are needed for dependency tracking and evaluation.
 *
 * The caller provides the field and reference nodes to process — this class
 * handles creation, registration, and deduplication.
 *
 * Pseudo node types created:
 * - POST: Raw form submission data for fields
 * - ANSWER_LOCAL: Resolved field answers for fields on current step (POST + formatters + loaded + defaults)
 * - ANSWER_REMOTE: Field answers from other steps (read from context.answers)
 * - QUERY: URL query parameters
 * - PARAMS: URL path parameters
 * - SESSION: Server-side session data
 * - DATA: External data loaded via onLoad transitions
 */
export default class PseudoNodeCreator {
  /** Track created pseudo nodes by (type, key) to avoid duplicates */
  private readonly created: Map<PseudoNodeType, Set<string>>

  constructor(
    private readonly nodeRegistry: NodeRegistry,
    private readonly pseudoNodeFactory: PseudoNodeFactory,
    private readonly metadataRegistry: MetadataRegistry,
  ) {
    // Seed from existing registry so all subsequent dedup checks are O(1) Set lookups
    this.created = this.seedFromRegistry()
  }

  /**
   * Create ANSWER_LOCAL and POST pseudo nodes for field blocks on the current step.
   * Fields not on the current step are skipped.
   */
  createForFields(fieldNodes: FieldBlockASTNode[]) {
    fieldNodes.forEach(blockNode => {
      const fieldCode = blockNode.properties.code

      if (typeof fieldCode === 'string') {
        if (this.metadataRegistry.get(blockNode.id, 'isDescendantOfStep', false)) {
          this.createAnswerLocalPseudoNode(blockNode, fieldCode)
          this.createPostPseudoNode(fieldCode, blockNode.id)
        }
      }
    })
  }

  /**
   * Create pseudo nodes for reference expressions based on their source type.
   * Each reference source (query, params, post, data, request, session, answers)
   * produces the corresponding pseudo node type.
   */
  createForReferences(referenceNodes: ReferenceASTNode[]) {
    referenceNodes.forEach(referenceExpressionNode => {
      const path = referenceExpressionNode.properties.path

      if (Array.isArray(path) && path.length >= 2) {
        const [referenceSource, key] = path

        if (typeof key === 'string') {
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
              this.createPostPseudoNode(baseFieldCode)
              break

            case 'data':
              this.createDataPseudoNode(baseFieldCode)
              break

            case 'request':
              this.createRequestPseudoNode(path)
              break

            case 'session':
              this.createSessionPseudoNode(baseFieldCode)
              break

            case 'answers':
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
   *
   * @example
   * expandPath('fieldName') → ['fieldName']
   * expandPath('fieldName.subProperty') → ['fieldName', 'subProperty']
   */
  private expandPath(pathString: string): string[] {
    return pathString.split('.')
  }

  private createPostPseudoNode(baseFieldCode: string, fieldNodeId?: NodeId): void {
    if (this.created.get(PseudoNodeType.POST)!.has(baseFieldCode)) {
      return
    }

    const node = this.pseudoNodeFactory.createPostPseudoNode(baseFieldCode, fieldNodeId)

    this.nodeRegistry.register(node.id, node)
    this.created.get(PseudoNodeType.POST)!.add(baseFieldCode)
  }

  private createAnswerRemotePseudoNode(baseFieldCode: string): void {
    // Also checks if the `local` equivalent exists, as that takes preference.
    if (
      this.created.get(PseudoNodeType.ANSWER_REMOTE)!.has(baseFieldCode) ||
      this.created.get(PseudoNodeType.ANSWER_LOCAL)!.has(baseFieldCode)
    ) {
      return
    }

    const answerPseudoNode = this.pseudoNodeFactory.createAnswerRemotePseudoNode(baseFieldCode)

    this.nodeRegistry.register(answerPseudoNode.id, answerPseudoNode)
    this.created.get(PseudoNodeType.ANSWER_REMOTE)!.add(baseFieldCode)
  }

  private createAnswerLocalPseudoNode(fieldNode: FieldBlockASTNode, fieldCode: string): void {
    if (this.created.get(PseudoNodeType.ANSWER_LOCAL)!.has(fieldCode)) {
      return
    }

    const answerPseudoNode = this.pseudoNodeFactory.createAnswerLocalPseudoNode(fieldCode, fieldNode.id)

    this.nodeRegistry.register(answerPseudoNode.id, answerPseudoNode)
    this.created.get(PseudoNodeType.ANSWER_LOCAL)!.add(fieldCode)
  }

  private createQueryPseudoNode(paramName: string): void {
    if (this.created.get(PseudoNodeType.QUERY)!.has(paramName)) {
      return
    }

    const node = this.pseudoNodeFactory.createQueryPseudoNode(paramName)

    this.nodeRegistry.register(node.id, node)
    this.created.get(PseudoNodeType.QUERY)!.add(paramName)
  }

  private createParamsPseudoNode(paramName: string): void {
    if (this.created.get(PseudoNodeType.PARAMS)!.has(paramName)) {
      return
    }

    const node = this.pseudoNodeFactory.createParamsPseudoNode(paramName)

    this.nodeRegistry.register(node.id, node)
    this.created.get(PseudoNodeType.PARAMS)!.add(paramName)
  }

  private createDataPseudoNode(baseProperty: string): void {
    if (this.created.get(PseudoNodeType.DATA)!.has(baseProperty)) {
      return
    }

    const node = this.pseudoNodeFactory.createDataPseudoNode(baseProperty)

    this.nodeRegistry.register(node.id, node)
    this.created.get(PseudoNodeType.DATA)!.add(baseProperty)
  }

  private createRequestPseudoNode(path: unknown[]): void {
    const requestRef = this.parseRequestReference(path)

    if (!requestRef) {
      return
    }

    if (this.created.get(PseudoNodeType.REQUEST)!.has(requestRef.requestPath)) {
      return
    }

    const node = this.pseudoNodeFactory.createRequestPseudoNode(requestRef.requestPath)

    this.nodeRegistry.register(node.id, node)
    this.created.get(PseudoNodeType.REQUEST)!.add(requestRef.requestPath)
  }

  private createSessionPseudoNode(baseSessionKey: string): void {
    if (this.created.get(PseudoNodeType.SESSION)!.has(baseSessionKey)) {
      return
    }

    const node = this.pseudoNodeFactory.createSessionPseudoNode(baseSessionKey)

    this.nodeRegistry.register(node.id, node)
    this.created.get(PseudoNodeType.SESSION)!.add(baseSessionKey)
  }

  /**
   * Scan the registry once for existing pseudo nodes and populate the created Sets.
   * This makes all subsequent dedup checks O(1) Set lookups.
   */
  private seedFromRegistry(): Map<PseudoNodeType, Set<string>> {
    const allTypes = [
      PseudoNodeType.POST,
      PseudoNodeType.ANSWER_LOCAL,
      PseudoNodeType.ANSWER_REMOTE,
      PseudoNodeType.QUERY,
      PseudoNodeType.PARAMS,
      PseudoNodeType.DATA,
      PseudoNodeType.REQUEST,
      PseudoNodeType.SESSION,
    ]

    const created = new Map<PseudoNodeType, Set<string>>()

    allTypes.forEach(type => {
      const keys = new Set<string>()

      this.nodeRegistry.findByType<PseudoNode>(type).forEach(node => {
        const key = getPseudoNodeKey(node)

        if (key !== undefined) {
          keys.add(key)
        }
      })

      created.set(type, keys)
    })

    return created
  }

  private parseRequestReference(path: unknown[]): { requestPath: string } | undefined {
    const [, source, key] = path

    if (source === 'url' || source === 'path' || source === 'method') {
      return { requestPath: source }
    }

    if ((source === 'headers' || source === 'cookies' || source === 'state') && typeof key === 'string') {
      return { requestPath: `${source}.${key}` }
    }

    return undefined
  }
}
