import {
  ExpressionType,
  IteratorType,
  FunctionCallType,
  PolicyType,
  PredicateType,
} from '../../../../../shared/taxonomy'
import type { ASTNode } from '../../../contracts/ast/ast.type'
import { ASTNodeFamily, astNodeFamily } from '../../../contracts/ast/enums'
import { isASTNode } from '../../../contracts/ast/nodes'
import {
  AuthoredValueKind,
  MatchBranchKind,
  isBlockShapedValue,
  isDeepStaticValue,
  staticValue,
  type AuthoredValue,
  type BlockValue,
  type FunctionValue,
  type MatchBranchValue,
  type RecordEntryValue,
} from '../../../contracts/models/authoredValue.type'

/** Preserves executable operands in one typed tree and source nodes only for diagnostics and identity. */
export default class AuthoredValueClassifier {
  classify(value: unknown): AuthoredValue {
    if (isDeepStaticValue(value)) {
      return staticValue(value)
    }

    if (isASTNode(value)) {
      return this.classifyNode(value)
    }

    if (Array.isArray(value)) {
      return { kind: AuthoredValueKind.LIST, items: value.map(item => this.classify(item)) }
    }

    if (this.isRecord(value)) {
      if (isBlockShapedValue(value)) {
        return this.classifyBlockObject(value)
      }

      return { kind: AuthoredValueKind.RECORD, entries: this.classifyEntries(value) }
    }

    return staticValue(value)
  }

  private classifyNode(source: ASTNode): AuthoredValue {
    const properties = source.properties ?? {}

    if (astNodeFamily(source.kind) === ASTNodeFamily.COMPONENT_CALL) {
      return {
        kind: AuthoredValueKind.BLOCK,
        source,
        variant: 'variant' in source ? String(source.variant) : '',
        blockType: source.kind,
        id: source.isTemplate ? undefined : source.id,
        entries: this.classifyEntries(properties),
      }
    }

    switch (source.kind) {
      case ExpressionType.REFERENCE:
        return {
          kind: AuthoredValueKind.REFERENCE,
          source,
          path: this.array(properties.path).map(segment =>
            typeof segment === 'string' || typeof segment === 'number' ? segment : this.classify(segment),
          ),
          base: this.classifyOptional(properties.base),
        }
      case FunctionCallType.CONDITION:
      case FunctionCallType.TRANSFORMER:
      case FunctionCallType.GENERATOR:
        return this.classifyFunction(source)
      case ExpressionType.PIPELINE:
        return {
          kind: AuthoredValueKind.PIPELINE,
          source,
          input: this.classify(properties.input),
          steps: this.array(properties.steps)
            .filter(isASTNode)
            .map(node => this.classifyFunction(node)),
        }
      case ExpressionType.NULLISH:
        return {
          kind: AuthoredValueKind.NULLISH,
          source,
          input: this.classify(properties.input),
          fallback: this.classify(properties.fallback),
        }
      case ExpressionType.CONDITIONAL:
        return {
          kind: AuthoredValueKind.CONDITIONAL,
          source,
          predicate: this.classify(properties.predicate),
          thenValue: this.classify(properties.thenValue),
          elseValue: this.classify(properties.elseValue),
        }
      case ExpressionType.MATCH:
        return {
          kind: AuthoredValueKind.MATCH,
          source,
          subject: this.classify(properties.subject),
          branches: this.classifyMatchBranches(properties.branches),
          otherwise: this.classifyOptional(properties.otherwise),
        }
      case ExpressionType.ITERATE: {
        const iterator = this.isRecord(properties.iterator) ? properties.iterator : {}
        const iteratorType = this.resolveIteratorType(iterator.type)

        return {
          kind: AuthoredValueKind.ITERATION,
          source,
          iterator: iteratorType,
          input: this.classify(properties.input),
          yieldTemplate: iteratorType === IteratorType.MAP ? this.classifyOptional(iterator.yieldTemplate) : undefined,
          predicate: iteratorType !== IteratorType.MAP ? this.classifyOptional(iterator.predicateTemplate) : undefined,
        }
      }
      case PolicyType.VALIDATION_RULE:
        return {
          kind: AuthoredValueKind.VALIDATION,
          source,
          function: this.classifyOptional(properties.function),
          condition: this.classifyOptional(properties.condition),
          message: this.classify(properties.message),
          details: this.classifyOptional(properties.details),
          submissionOnly: properties.submissionOnly === true,
          groups: this.classifyOptional(properties.groups),
        }
      case PredicateType.TEST:
      case PredicateType.AND:
      case PredicateType.OR:
      case PredicateType.NOT:
      case PredicateType.XOR:
        return {
          kind: AuthoredValueKind.PREDICATE,
          source,
          predicate: source.kind,
          subject: this.classifyOptional(properties.subject),
          condition: isASTNode(properties.condition) ? this.classifyFunction(properties.condition) : undefined,
          negate: properties.negate === true,
          operands: this.array(properties.operands).map(operand => this.classify(operand)),
          operand: this.classify(properties.operand),
        }
      default:
        return staticValue(source)
    }
  }

  private classifyFunction(source: ASTNode): FunctionValue {
    const properties = source.properties ?? {}

    return {
      kind: AuthoredValueKind.FUNCTION,
      source,
      name: String(properties.name),
      arguments: this.array(properties.arguments).map(argument => this.classify(argument)),
    }
  }

  private classifyBlockObject(block: Record<string, unknown>): BlockValue {
    return {
      kind: AuthoredValueKind.BLOCK,
      source: block,
      variant: String(block.variant),
      blockType: String(block.blockType),
      id: typeof block.id === 'string' ? block.id : undefined,
      entries: this.classifyEntries(this.isRecord(block.properties) ? block.properties : {}),
    }
  }

  private classifyMatchBranches(value: unknown): MatchBranchValue[] {
    return this.array(value)
      .filter(item => this.isRecord(item))
      .map(branch =>
        'expected' in branch
          ? {
              kind: MatchBranchKind.CASE,
              expected: this.classify(branch.expected),
              value: this.classify(branch.value),
            }
          : {
              kind: MatchBranchKind.PREDICATE,
              predicate: this.classify(branch.predicate),
              value: this.classify(branch.value),
            },
      )
  }

  private classifyEntries(record: Record<string, unknown>): RecordEntryValue[] {
    return Object.entries(record).map(([key, entry]) => ({ key, value: this.classify(entry) }))
  }

  private classifyOptional(value: unknown): AuthoredValue | undefined {
    return value === undefined ? undefined : this.classify(value)
  }

  private resolveIteratorType(value: unknown): IteratorType | undefined {
    return value === IteratorType.MAP ||
      value === IteratorType.FILTER ||
      value === IteratorType.FIND ||
      value === IteratorType.SOME ||
      value === IteratorType.EVERY ||
      value === IteratorType.COUNT
      ? value
      : undefined
  }

  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : []
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
  }
}
