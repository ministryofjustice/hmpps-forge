import { ExpressionType, IteratorType } from '../../../../../shared/taxonomy'
import type { ASTNode } from '../../../contracts/ast/ast.type'
import { ASTNodeFamily, astNodeFamily } from '../../../contracts/ast/enums'
import { isASTNode } from '../../../contracts/ast/nodes'
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

    if (isASTNode(value)) {
      return this.classifyNode(value)
    }

    if (isBlockShapedValue(value)) {
      return this.classifyBlockObject(value as Record<string, unknown>)
    }

    if (Array.isArray(value)) {
      return { kind: AuthoredValueKind.LIST, items: value.map(item => this.classify(item)) }
    }

    return { kind: AuthoredValueKind.RECORD, entries: this.classifyEntries(value as Record<string, unknown>) }
  }

  private classifyNode(node: ASTNode): AuthoredValue {
    if (astNodeFamily(node.kind) === ASTNodeFamily.COMPONENT_CALL) {
      return this.classifyBlockNode(node)
    }

    return this.classifyByExpressionKind(node)
  }

  private classifyByExpressionKind(node: ASTNode): AuthoredValue {
    if (node.kind === ExpressionType.CONDITIONAL) {
      const properties = this.propertiesOf(node)

      return {
        kind: AuthoredValueKind.CONDITIONAL,
        source: node,
        predicate: this.classify(properties.predicate),
        thenValue: this.classify(properties.thenValue),
        elseValue: this.classify(properties.elseValue),
      }
    }

    if (node.kind === ExpressionType.MATCH) {
      const properties = this.propertiesOf(node)

      return {
        kind: AuthoredValueKind.MATCH,
        source: node,
        branches: this.classifyMatchBranches(properties.branches),
        otherwise: properties.otherwise === undefined ? undefined : this.classify(properties.otherwise),
      }
    }

    if (node.kind === ExpressionType.ITERATE) {
      return this.classifyIteration(node)
    }

    return expressionValue(node)
  }

  private classifyIteration(node: ASTNode): AuthoredValue {
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

  private classifyBlockNode(node: ASTNode): BlockValue {
    return {
      kind: AuthoredValueKind.BLOCK,
      source: node,
      variant: 'variant' in node ? String(node.variant) : '',
      blockType: node.kind,
      id: node.isTemplate ? undefined : node.id,
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

  private propertiesOf(node: ASTNode): Record<string, unknown> {
    return node.properties ?? {}
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)
  }
}
