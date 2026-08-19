import { ASTNode } from '../../../contracts/ast/engine.type'
import ASTNodeIndex from './ASTNodeIndex'
import TemplateNodeIndex from './TemplateNodeIndex'
import { isASTNode, isTemplateNode } from '../../../contracts/ast/nodes'
import ForgeInternalError from '../../../../errors/ForgeInternalError'

/**
 * Indexes an AST subtree in one recursive descent.
 *
 * The walker registers nodes by ID and wires each node's direct `parent`.
 * Template nodes are not registered in `ASTNodeIndex` because generated
 * functions evaluate iterator templates inline instead of materialising
 * runtime AST nodes; their contents go into `TemplateNodeIndex` so semantic
 * analysis can query them without re-walking every template.
 */
export default class NodeRegistrationWalker {
  constructor(
    private readonly nodeIndex: ASTNodeIndex,
    private readonly templateNodeIndex: TemplateNodeIndex = new TemplateNodeIndex(),
  ) {}

  /**
   * Register a root AST node and every non-template descendant.
   */
  register(root: ASTNode): void {
    this.walk(root, undefined)
  }

  private walk(value: unknown, parentNode: ASTNode | undefined): void {
    if (value === null || value === undefined || typeof value !== 'object') {
      return
    }

    if (Array.isArray(value)) {
      value.forEach(item => this.walk(item, parentNode))

      return
    }

    // Template contents stay out of the main registry but are indexed for
    // semantic analysis, keyed to the registered node that carries them.
    if (isTemplateNode(value)) {
      if (parentNode === undefined) {
        throw new ForgeInternalError('Template node reached with no registered parent to own it')
      }

      this.templateNodeIndex.registerTree(value, parentNode)

      return
    }

    if (!isASTNode(value)) {
      Object.values(value).forEach(v => this.walk(v, parentNode))

      return
    }

    const node = value

    // Non-enumerable so blind property walkers (template compilation) never
    // recurse back up the tree. Assigned before register() freezes the node.
    if (parentNode !== undefined) {
      Object.defineProperty(node, 'parent', { value: parentNode, enumerable: false })
    }

    this.nodeIndex.register(node.id, node)

    if (node.properties) {
      Object.values(node.properties).forEach(propValue => this.walk(propValue, node))
    }
  }
}
