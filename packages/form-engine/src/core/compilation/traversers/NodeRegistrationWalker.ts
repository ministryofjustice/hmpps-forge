import { ASTNode, NodeId } from '@form-engine/core/types/engine.type'
import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import NodeRegistry from '@form-engine/core/compilation/registries/NodeRegistry'
import MetadataRegistry from '@form-engine/core/compilation/registries/MetadataRegistry'
import { NodeFactory } from '@form-engine/core/nodes/NodeFactory'
import { FieldBlockASTNode } from '@form-engine/core/types/structures.type'
import { ExpressionType } from '@form-engine/form/types/enums'
import { ReferenceExpr } from '@form-engine/form/types/expressions.type'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { isASTNode, isTemplateNode } from '@form-engine/core/typeguards/nodes'
import { isFieldBlockStructNode } from '@form-engine/core/typeguards/structure-nodes'
import { isReferenceExprNode } from '@form-engine/core/typeguards/expression-nodes'
import { cloneASTValue } from '@form-engine/core/utils/astValueCloning'
import InvalidNodeError from '@form-engine/errors/InvalidNodeError'
import ASTNodeTree from '@form-engine/core/compilation/node-tree/ASTNodeTree'

/**
 * Single-pass walker that replaces 4 separate structuralTraverse passes
 * (assignIds + AddSelfValueToFields + ResolveSelfReferences + Registration + Metadata)
 * with one recursive descent.
 *
 * No context objects, no array copies, no sibling tracking.
 * Just a mutable field stack and parent tracking via the call stack.
 */
export default class NodeRegistrationWalker {
  constructor(
    private readonly nodeIdGenerator: NodeIDGenerator,
    private readonly idCategory: NodeIDCategory.COMPILE_AST | NodeIDCategory.RUNTIME_AST,
    private readonly nodeRegistry: NodeRegistry,
    private readonly nodeFactory: NodeFactory,
    private readonly metadataRegistry: MetadataRegistry,
    private readonly markAsDescendantOfStep: boolean,
    private readonly astNodeTree: ASTNodeTree,
  ) {}

  /**
   * Walk an AST subtree: assign IDs, normalize, register, and set metadata in one pass.
   *
   * For compile-time: call without parentNodeId (root journey has no parent).
   * For runtime: call with parentNodeId (the iterate node that owns these runtime nodes).
   */
  register(root: ASTNode, parentNodeId?: NodeId, parentProperty?: string): void {
    this.walk(root, parentNodeId, parentProperty, [], undefined)
  }

  private walk(
    value: unknown,
    parentNodeId: NodeId | undefined,
    propertyKey: string | undefined,
    fieldStack: FieldBlockASTNode[],
    codeOwnerFieldId: NodeId | undefined,
  ): void {
    if (value === null || value === undefined || typeof value !== 'object') {
      return
    }

    if (Array.isArray(value)) {
      value.forEach(item => this.walk(item, parentNodeId, propertyKey, fieldStack, codeOwnerFieldId))

      return
    }

    if (isTemplateNode(value)) {
      if (parentNodeId !== undefined && propertyKey !== undefined) {
        this.scanTemplateForBlockTypes(value, parentNodeId, propertyKey)
      }

      return
    }

    if (!isASTNode(value)) {
      Object.values(value).forEach(v => this.walk(v, parentNodeId, propertyKey, fieldStack, codeOwnerFieldId))

      return
    }

    const node = value

    // 1. Assign ID if missing (replaces assignIdsToClonedValue)
    if (!node.id) {
      ;(node as { id: string }).id = this.nodeIdGenerator.next(this.idCategory)
    }

    // 2. Add Self() to field blocks (replaces AddSelfValueToFieldsNormalizer)
    const isField = isFieldBlockStructNode(node)

    if (isField) {
      node.properties.value = this.nodeFactory.createNode({
        type: ExpressionType.REFERENCE,
        path: ['answers', '@self'],
      } satisfies ReferenceExpr)
    }

    // 3. Resolve @self references (replaces ResolveSelfReferencesNormalizer)
    if (isReferenceExprNode(node)) {
      this.resolveSelfReference(node, fieldStack, codeOwnerFieldId)
    }

    // 4. Register (replaces RegistrationTraverser)
    this.nodeRegistry.register(node.id, node)
    this.astNodeTree.addNode(node.id, parentNodeId, propertyKey, node.type)

    // 5. Set metadata (replaces MetadataTraverser)
    if (parentNodeId) {
      this.metadataRegistry.set(node.id, 'attachedToParentNode', parentNodeId)

      if (propertyKey) {
        this.metadataRegistry.set(node.id, 'attachedToParentProperty', propertyKey)
      }
    }

    if (this.markAsDescendantOfStep) {
      this.metadataRegistry.set(node.id, 'isDescendantOfStep', true)
    }

    // 6. Walk children — field blocks push onto stack for @self resolution
    if (isField) {
      fieldStack.push(node)
    }

    if (node.properties) {
      Object.entries(node.properties).forEach(([key, propValue]) => {
        const codeId = isField && key === 'code' ? node.id : codeOwnerFieldId

        this.walk(propValue, node.id, key, fieldStack, codeId)
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
    const refPath = (node as any).properties?.path

    if (!Array.isArray(refPath) || refPath.length < 2) {
      return
    }

    if (refPath[0] !== 'answers' || refPath[1] !== '@self') {
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

  /** Scan a template node for block-type descendants and mark the parent's property edge */
  private scanTemplateForBlockTypes(
    value: { originalType: string; properties?: Record<string, unknown> },
    parentNodeId: NodeId,
    propertyKey: string,
  ): void {
    if (value.originalType === ASTNodeType.BLOCK) {
      this.astNodeTree.markPropertyContainsType(parentNodeId, propertyKey, ASTNodeType.BLOCK)

      return
    }

    if (value.properties) {
      Object.values(value.properties).forEach(propValue => {
        this.scanTemplateValueForBlocks(propValue, parentNodeId, propertyKey)
      })
    }
  }

  /** Recursively scan template values for block-type template nodes */
  private scanTemplateValueForBlocks(value: unknown, parentNodeId: NodeId, propertyKey: string): void {
    if (value === null || value === undefined || typeof value !== 'object') {
      return
    }

    if (isTemplateNode(value)) {
      this.scanTemplateForBlockTypes(value, parentNodeId, propertyKey)

      return
    }

    if (Array.isArray(value)) {
      value.forEach(item => this.scanTemplateValueForBlocks(item, parentNodeId, propertyKey))

      return
    }

    Object.values(value).forEach(v => this.scanTemplateValueForBlocks(v, parentNodeId, propertyKey))
  }
}
