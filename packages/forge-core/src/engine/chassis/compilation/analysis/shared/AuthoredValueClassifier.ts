import { ExpressionType, IteratorType } from '../../../../../authoring/types/enums'
import type { ASTNode } from '../../../contracts/ast/ast.type'
import { ASTNodeType } from '../../../contracts/ast/enums'
import { isASTNode, isTemplateNode } from '../../../contracts/ast/nodes'
import type { TemplateNode } from '../../../contracts/ast/template.type'
import {
  AuthoredValueKind,
  expressionValue,
  isBlockShapedValue,
  isDeepStaticValue,
  staticValue,
  type AuthoredValue,
  type BlockValue,
  type MatchBranchValue,
  type RecordEntryValue,
} from '../../../contracts/models/authoredValue.type'

/**
 * Classifies every authored value (the raw values journey authors write) into
 * the `AuthoredValue` union — the analysis stage's single answer to "what kind
 * of value is this?". Lowering (the stage that turns analysis models into
 * generated JavaScript) reads the classified tree and never re-derives value
 * kinds during code generation. Classification is lossless: branches backed by
 * AST or template nodes keep their source node, so the code generator receives
 * exactly what the author wrote.
 */
export default class AuthoredValueClassifier {
  classify(value: unknown): AuthoredValue {
    if (isDeepStaticValue(value)) {
      return staticValue(value)
    }

    if (isTemplateNode(value)) {
      return this.classifyTemplateNode(value)
    }

    if (isBlockShapedValue(value)) {
      return this.classifyBlockObject(value as Record<string, unknown>)
    }

    if (this.isCompilableNode(value)) {
      return this.classifyExpressionNode(value)
    }

    if (Array.isArray(value)) {
      return { kind: AuthoredValueKind.LIST, items: value.map(item => this.classify(item)) }
    }

    return { kind: AuthoredValueKind.RECORD, entries: this.classifyEntries(value as Record<string, unknown>) }
  }

  private classifyTemplateNode(node: TemplateNode): AuthoredValue {
    if (node.originalType === ASTNodeType.BLOCK) {
      return this.classifyBlockTemplate(node)
    }

    const expressionType =
      node.originalType === ASTNodeType.EXPRESSION && typeof node.expressionType === 'string'
        ? node.expressionType
        : undefined

    return this.classifyByExpressionType(node, expressionType)
  }

  private classifyExpressionNode(node: ASTNode): AuthoredValue {
    const expressionType = (node as { expressionType?: unknown }).expressionType
    const resolvedType =
      node.type === ASTNodeType.EXPRESSION && typeof expressionType === 'string' ? expressionType : undefined

    return this.classifyByExpressionType(node, resolvedType)
  }

  private classifyByExpressionType(node: ASTNode | TemplateNode, expressionType: string | undefined): AuthoredValue {
    if (expressionType === ExpressionType.CONDITIONAL) {
      const properties = this.propertiesOf(node)

      return {
        kind: AuthoredValueKind.CONDITIONAL,
        source: node,
        predicate: this.classify(properties.predicate),
        thenValue: this.classify(properties.thenValue),
        elseValue: this.classify(properties.elseValue),
      }
    }

    if (expressionType === ExpressionType.MATCH) {
      const properties = this.propertiesOf(node)

      return {
        kind: AuthoredValueKind.MATCH,
        source: node,
        branches: this.classifyMatchBranches(properties.branches),
        otherwise: properties.otherwise === undefined ? undefined : this.classify(properties.otherwise),
      }
    }

    if (expressionType === ExpressionType.ITERATE) {
      return this.classifyIteration(node)
    }

    return expressionValue(node)
  }

  private classifyIteration(node: ASTNode | TemplateNode): AuthoredValue {
    const properties = this.propertiesOf(node)
    const iterator = this.isRecord(properties.iterator) ? properties.iterator : undefined
    const iteratorType = this.resolveIteratorType(iterator?.type)

    return {
      kind: AuthoredValueKind.ITERATION,
      source: node,
      iterator: iteratorType,
      input: this.classify(properties.input),
      yieldTemplate:
        iteratorType === IteratorType.MAP && iterator?.yieldTemplate !== undefined
          ? this.classify(iterator.yieldTemplate)
          : undefined,
      predicate:
        iteratorType === IteratorType.FILTER || iteratorType === IteratorType.FIND
          ? this.classify(iterator?.predicateTemplate)
          : undefined,
    }
  }

  private classifyBlockTemplate(node: TemplateNode): BlockValue {
    return {
      kind: AuthoredValueKind.BLOCK,
      source: node,
      variant: String(node.variant),
      blockType: String(node.blockType),
      id: undefined,
      entries: this.classifyEntries(this.propertiesOf(node)),
    }
  }

  private classifyBlockObject(block: Record<string, unknown>): BlockValue {
    return {
      kind: AuthoredValueKind.BLOCK,
      source: block,
      variant: block.variant as string,
      blockType: block.blockType as string,
      id: typeof block.id === 'string' ? block.id : undefined,
      entries: this.classifyEntries(this.isRecord(block.properties) ? block.properties : {}),
    }
  }

  private classifyMatchBranches(value: unknown): MatchBranchValue[] {
    if (!Array.isArray(value)) {
      return []
    }

    return value
      .filter((item): item is Record<string, unknown> => this.isRecord(item))
      .map(branch => ({
        predicate: this.classify(branch.predicate),
        value: this.classify(branch.value),
      }))
  }

  private classifyEntries(record: Record<string, unknown>): RecordEntryValue[] {
    return Object.entries(record).map(([key, entry]) => ({ key, value: this.classify(entry) }))
  }

  private resolveIteratorType(value: unknown): IteratorType | undefined {
    return value === IteratorType.MAP || value === IteratorType.FILTER || value === IteratorType.FIND
      ? value
      : undefined
  }

  private propertiesOf(node: ASTNode | TemplateNode): Record<string, unknown> {
    return (node.properties ?? {}) as Record<string, unknown>
  }

  private isCompilableNode(value: unknown): value is ASTNode {
    return isASTNode(value) && 'id' in value
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)
  }
}
