import { ASTNode, NodeId } from '../../../contracts/ast/engine.type'
import { NodeIDGenerator } from './NodeIDGenerator'
import ASTNodeIndex from './ASTNodeIndex'
import { FieldBlockASTNode } from '../../../contracts/ast/structures.type'
import { isASTNode, isTemplateNode } from '../../../contracts/ast/nodes'
import { isFieldBlockStructNode } from '../../../contracts/ast/structure-nodes'
import { isReferenceExprNode } from '../../../contracts/ast/expression-nodes'
import { cloneASTValue } from './astValueCloning'
import ForgeInvalidNodeError from '../../../../errors/ForgeInvalidNodeError'

/**
 * Normalises and indexes an AST subtree in one recursive descent.
 *
 * The walker assigns any missing compile IDs, resolves `Self()` references in
 * ordinary AST nodes, registers nodes by ID, and wires each node's direct
 * `parent`. Template nodes are not registered because generated functions
 * evaluate iterator templates inline instead of materialising runtime AST nodes.
 */
export default class NodeRegistrationWalker {
  constructor(
    private readonly nodeIdGenerator: NodeIDGenerator,
    private readonly nodeRegistry: ASTNodeIndex,
  ) {}

  /**
   * Register a root AST node and every non-template descendant.
   */
  register(root: ASTNode): void {
    this.walk(root, undefined, [], undefined)
  }

  private walk(
    value: unknown,
    parentNode: ASTNode | undefined,
    fieldStack: FieldBlockASTNode[],
    codeOwnerFieldId: NodeId | undefined,
  ): void {
    if (value === null || value === undefined || typeof value !== 'object') {
      return
    }

    if (Array.isArray(value)) {
      value.forEach(item => this.walk(item, parentNode, fieldStack, codeOwnerFieldId))

      return
    }

    if (isTemplateNode(value)) {
      return
    }

    if (!isASTNode(value)) {
      Object.values(value).forEach(v => this.walk(v, parentNode, fieldStack, codeOwnerFieldId))

      return
    }

    const node = value

    // Cloned @self expressions can arrive without IDs, but every registered AST
    // node needs a stable compile ID for runtime plans and source generation.
    if (!node.id) {
      ;(node as { id: string }).id = this.nodeIdGenerator.nextAstNodeId()
    }

    const isField = isFieldBlockStructNode(node)

    // Resolve Self() to a cloned copy of the containing field code while the
    // field stack still tells us which field owns the current expression.
    if (isReferenceExprNode(node)) {
      this.resolveSelfReference(node, fieldStack, codeOwnerFieldId)
    }

    // Non-enumerable so blind property walkers (cloning, template compilation)
    // never recurse back up the tree. Assigned before register() freezes the node.
    if (parentNode !== undefined) {
      Object.defineProperty(node, 'parent', { value: parentNode, enumerable: false })
    }

    this.nodeRegistry.register(node.id, node)

    // Field blocks push onto the stack only while their descendants are scanned.
    if (isField) {
      fieldStack.push(node)
    }

    if (node.properties) {
      Object.entries(node.properties).forEach(([key, propValue]) => {
        const codeId = isField && key === 'code' ? node.id : codeOwnerFieldId

        this.walk(propValue, node, fieldStack, codeId)
      })
    }

    if (isField) {
      fieldStack.pop()
    }
  }

  private resolveSelfReference(
    node: ASTNode,
    fieldStack: FieldBlockASTNode[],
    codeOwnerFieldId: NodeId | undefined,
  ): void {
    const refPath = node.properties?.path

    if (!Array.isArray(refPath)) {
      return
    }

    if (refPath[0] === '@self') {
      refPath.unshift('answers')
    }

    if (refPath.length < 2 || refPath[0] !== 'answers' || refPath[1] !== '@self') {
      return
    }

    const containingField = fieldStack[fieldStack.length - 1]

    if (!containingField) {
      throw new ForgeInvalidNodeError({
        message: 'Self() reference used outside of a field block',
        formattedPath: node.diagnostics?.source.formattedPath,
        callsite: node.diagnostics?.callsite,
      })
    }

    if (codeOwnerFieldId === containingField.id) {
      throw new ForgeInvalidNodeError({
        message: "Self() cannot be used within the field's code expression",
        formattedPath: node.diagnostics?.source.formattedPath,
        callsite: node.diagnostics?.callsite,
      })
    }

    const codeValue = containingField.properties?.code

    if (codeValue === undefined) {
      throw new ForgeInvalidNodeError({
        message: 'Containing field has no code to resolve Self()',
        formattedPath: node.diagnostics?.source.formattedPath,
        callsite: node.diagnostics?.callsite,
      })
    }

    const clonedCode = cloneASTValue(codeValue)
    refPath[1] = clonedCode
  }
}
