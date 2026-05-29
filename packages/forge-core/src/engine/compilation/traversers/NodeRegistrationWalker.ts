import { ASTNode, NodeId } from '../../types/engine.type'
import { NodeIDCategory, NodeIDGenerator } from '../id-generators/NodeIDGenerator'
import NodeRegistry from '../registries/NodeRegistry'
import { FieldBlockASTNode } from '../../types/structures.type'
import { isASTNode, isTemplateNode } from '../../typeguards/nodes'
import { isFieldBlockStructNode } from '../../typeguards/structure-nodes'
import { isReferenceExprNode } from '../../typeguards/expression-nodes'
import { cloneASTValue } from '../../utils/astValueCloning'
import InvalidNodeError from '../../errors/InvalidNodeError'
import ASTNodeTree from '../node-tree/ASTNodeTree'

/**
 * Normalises and indexes an AST subtree in one recursive descent.
 *
 * The walker assigns any missing compile IDs, resolves `Self()` references in
 * ordinary AST nodes, registers nodes by ID, and records parent edges in
 * ASTNodeTree. Template nodes are not registered because generated functions
 * evaluate iterator templates inline instead of materialising runtime AST nodes.
 */
export default class NodeRegistrationWalker {
  constructor(
    private readonly nodeIdGenerator: NodeIDGenerator,
    private readonly idCategory: NodeIDCategory.COMPILE_AST,
    private readonly nodeRegistry: NodeRegistry,
    private readonly astNodeTree: ASTNodeTree,
  ) {}

  /**
   * Register a root AST node and every non-template descendant.
   */
  register(root: ASTNode): void {
    this.walk(root, undefined, [], undefined)
  }

  private walk(
    value: unknown,
    parentNodeId: NodeId | undefined,
    fieldStack: FieldBlockASTNode[],
    codeOwnerFieldId: NodeId | undefined,
  ): void {
    if (value === null || value === undefined || typeof value !== 'object') {
      return
    }

    if (Array.isArray(value)) {
      value.forEach(item => this.walk(item, parentNodeId, fieldStack, codeOwnerFieldId))

      return
    }

    if (isTemplateNode(value)) {
      return
    }

    if (!isASTNode(value)) {
      Object.values(value).forEach(v => this.walk(v, parentNodeId, fieldStack, codeOwnerFieldId))

      return
    }

    const node = value

    // Cloned @self expressions can arrive without IDs, but every registered AST
    // node needs a stable compile ID for runtime plans and source generation.
    if (!node.id) {
      ;(node as { id: string }).id = this.nodeIdGenerator.next(this.idCategory)
    }

    const isField = isFieldBlockStructNode(node)

    // Resolve Self() to a cloned copy of the containing field code while the
    // field stack still tells us which field owns the current expression.
    if (isReferenceExprNode(node)) {
      this.resolveSelfReference(node, fieldStack, codeOwnerFieldId)
    }

    this.nodeRegistry.register(node.id, node)
    this.astNodeTree.addNode(node.id, parentNodeId)

    // Field blocks push onto the stack only while their descendants are scanned.
    if (isField) {
      fieldStack.push(node)
    }

    if (node.properties) {
      Object.entries(node.properties).forEach(([key, propValue]) => {
        const codeId = isField && key === 'code' ? node.id : codeOwnerFieldId

        this.walk(propValue, node.id, fieldStack, codeId)
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
      throw new InvalidNodeError({
        message: 'Self() reference used outside of a field block',
        code: 'self_outside_field',
      })
    }

    if (codeOwnerFieldId === containingField.id) {
      throw new InvalidNodeError({
        message: "Self() cannot be used within the field's code expression",
        code: 'self_inside_code',
      })
    }

    const codeValue = containingField.properties?.code

    if (codeValue === undefined) {
      throw new InvalidNodeError({
        message: 'Containing field has no code to resolve Self()',
        code: 'missing_field_code',
      })
    }

    const clonedCode = cloneASTValue(codeValue)
    this.assignIdsRecursive(clonedCode)
    refPath[1] = clonedCode
  }

  private assignIdsRecursive(value: unknown): void {
    if (value === null || value === undefined || typeof value !== 'object') {
      return
    }

    if (Array.isArray(value)) {
      value.forEach(item => this.assignIdsRecursive(item))

      return
    }

    if (isTemplateNode(value)) {
      return
    }

    if (isASTNode(value) && !value.id) {
      ;(value as { id: string }).id = this.nodeIdGenerator.next(this.idCategory)
    }

    Object.values(value as Record<string, unknown>).forEach(v => this.assignIdsRecursive(v))
  }
}
