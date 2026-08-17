import { IteratorType } from '../../../../authoring/types/enums'
import type { ASTNode } from '../../../contracts/ast/ast.type'
import type { TemplateNode } from '../../../contracts/ast/template.type'
import {
  AuthoredValueKind,
  toRawOperand,
  type AuthoredValue,
  type BlockValue,
  type ConditionalValue,
  type IterationValue,
  type ListValue,
  type MatchValue,
  type RecordValue,
} from '../../../contracts/models/authoredValue.type'
import ForgeInternalError from '../../../errors/ForgeInternalError'
import { Code, code, literal, SafeCode } from '../../codegen/Code'
import CodeGenerator from '../../codegen/CodeGenerator'
import Name from '../../codegen/Name'
import IteratorLoopEmitter from '../emitters/IteratorLoopEmitter'
import ExpressionDispatcher from '../expressions/ExpressionDispatcher'

export interface RuntimeValueCompileOptions {
  readonly expressionErrorFallback?: Code
  readonly expressionErrorMode?: RuntimeValueErrorMode
  readonly omitUndefinedArrayItems?: boolean
}

export interface RuntimeValueCompilerPolicy {
  readonly expressionErrorFallback: Code
  readonly expressionErrorMode?: RuntimeValueErrorMode
  readonly omitUndefinedArrayItems: boolean
  /**
   * Emits a nested `BlockValue`. Only the resolve concern renders nested
   * blocks; a policy without this callback treats one as an impossible state.
   */
  readonly compileBlockValue?: (block: BlockValue, generator: CodeGenerator, target: Name) => void
}

type RuntimeValueErrorMode = 'fallback' | 'throw'

/** Materialises classified authored values into generated runtime values. */
export default class RuntimeValueCompiler {
  private readonly loops: IteratorLoopEmitter

  constructor(
    private readonly expr: ExpressionDispatcher,
    private readonly policy: RuntimeValueCompilerPolicy,
  ) {
    this.loops = new IteratorLoopEmitter(this.expr)
  }

  compileAssignment(
    value: AuthoredValue,
    generator: CodeGenerator,
    targetObject: SafeCode,
    key: string,
    options: RuntimeValueCompileOptions = {},
  ): void {
    if (value.kind === AuthoredValueKind.STATIC) {
      generator.assign(code`${targetObject}[${key}]`, literal(value.value))

      return
    }

    generator.comment('RuntimeValueCompiler.compileAssignment')
    generator.scope(() => {
      const result = generator.let(this.toPropertyValueVariablePrefix(key))

      this.compileValue(value, generator, result, options)
      generator.assign(code`${targetObject}[${key}]`, result)
    })
  }

  compileValue(
    value: AuthoredValue,
    generator: CodeGenerator,
    target: Name,
    options: RuntimeValueCompileOptions = {},
  ): void {
    switch (value.kind) {
      case AuthoredValueKind.STATIC:
        generator.assign(target, literal(value.value))

        return
      case AuthoredValueKind.EXPRESSION:
        this.compileExpressionValue(value.node, generator, target, options)

        return
      case AuthoredValueKind.CONDITIONAL:
        this.compileConditionalValue(value, generator, target, options)

        return
      case AuthoredValueKind.MATCH:
        this.compileMatchValue(value, generator, target, options)

        return
      case AuthoredValueKind.ITERATION:
        this.compileIterationValue(value, generator, target, options)

        return
      case AuthoredValueKind.LIST:
        this.compileListValue(value, generator, target, options)

        return
      case AuthoredValueKind.RECORD:
        this.compileRecordValue(value, generator, target, options)

        return
      case AuthoredValueKind.BLOCK:
        this.compileBlockValue(value, generator, target)

        return
      default:
        throw new ForgeInternalError('Unclassified authored value reached the runtime value compiler')
    }
  }

  private compileExpressionValue(
    node: ASTNode | TemplateNode,
    generator: CodeGenerator,
    target: Name,
    options: RuntimeValueCompileOptions,
  ): void {
    const expression = this.expr.isTemplateNode(node)
      ? this.expr.compileTemplateExpressionCode(node)
      : this.expr.compileExpressionCode(node)

    this.compileExpressionWithCatch(expression, generator, target, options)
  }

  private compileExpressionWithCatch(
    expression: Code,
    generator: CodeGenerator,
    target: Name,
    options: RuntimeValueCompileOptions,
  ): void {
    const errorMode = options.expressionErrorMode ?? this.policy.expressionErrorMode ?? 'fallback'

    if (errorMode === 'throw') {
      generator.assign(target, expression)

      return
    }

    const fallback = options.expressionErrorFallback ?? this.policy.expressionErrorFallback

    generator.tryCatch(
      () => generator.assign(target, expression),
      'error',
      () => generator.assign(target, fallback),
    )
  }

  private compileListValue(
    value: ListValue,
    generator: CodeGenerator,
    target: Name,
    options: RuntimeValueCompileOptions,
  ): void {
    const omitUndefined = options.omitUndefinedArrayItems ?? this.policy.omitUndefinedArrayItems

    generator.comment('RuntimeValueCompiler.compileArrayValue')
    generator.scope(() => {
      const arrayValue = generator.const('arrayValue', code`[]`)

      value.items.forEach(element => {
        if (element.kind === AuthoredValueKind.STATIC) {
          generator.statement(code`${arrayValue}.push(${literal(element.value)})`)

          return
        }

        generator.scope(() => {
          const arrayItem = generator.let('arrayItem')

          this.compileValue(element, generator, arrayItem, options)

          if (omitUndefined) {
            generator.if(code`${arrayItem} !== undefined`, () => {
              generator.statement(code`${arrayValue}.push(${arrayItem})`)
            })

            return
          }

          generator.statement(code`${arrayValue}.push(${arrayItem})`)
        })
      })

      generator.assign(target, arrayValue)
    })
  }

  private compileRecordValue(
    value: RecordValue,
    generator: CodeGenerator,
    target: Name,
    options: RuntimeValueCompileOptions,
  ): void {
    generator.comment('RuntimeValueCompiler.compileObjectValue')
    generator.scope(() => {
      const objectValue = generator.const('objectValue', code`{}`)

      value.entries.forEach(entry => {
        this.compileAssignment(entry.value, generator, objectValue, entry.key, options)
      })

      generator.assign(target, objectValue)
    })
  }

  private compileConditionalValue(
    value: ConditionalValue,
    generator: CodeGenerator,
    target: Name,
    options: RuntimeValueCompileOptions,
  ): void {
    generator.comment('RuntimeValueCompiler.compileConditionalValue')
    const predicate = generator.let('conditionalPredicate')

    this.compileExpressionWithCatch(this.expr.compileOperandCode(toRawOperand(value.predicate)), generator, predicate, {
      ...options,
      expressionErrorFallback: literal(false),
    })

    generator.if(
      predicate,
      () => this.compileValue(value.thenValue, generator, target, options),
      () => this.compileValue(value.elseValue, generator, target, options),
    )
  }

  private compileMatchValue(
    value: MatchValue,
    generator: CodeGenerator,
    target: Name,
    options: RuntimeValueCompileOptions,
  ): void {
    generator.comment('RuntimeValueCompiler.compileMatchValue')
    const compiledBranches = value.branches.map(branch => {
      const predicate = generator.let('matchPredicate')

      this.compileExpressionWithCatch(
        this.expr.compileOperandCode(toRawOperand(branch.predicate)),
        generator,
        predicate,
        { ...options, expressionErrorFallback: literal(false) },
      )

      return {
        condition: predicate,
        body: () => this.compileValue(branch.value, generator, target, options),
      }
    })
    const { otherwise } = value

    generator.ifChain(
      compiledBranches,
      otherwise === undefined ? undefined : () => this.compileValue(otherwise, generator, target, options),
    )
  }

  private compileIterationValue(
    value: IterationValue,
    generator: CodeGenerator,
    target: Name,
    options: RuntimeValueCompileOptions,
  ): void {
    if (value.iterator === IteratorType.MAP) {
      this.compileMapValue(value, generator, target, options)

      return
    }

    if (value.iterator === IteratorType.FILTER) {
      this.compileFilterValue(value, generator, target)

      return
    }

    if (value.iterator === IteratorType.FIND) {
      this.compileFindValue(value, generator, target)

      return
    }

    generator.assign(target, literal(undefined))
  }

  private compileMapValue(
    value: IterationValue,
    generator: CodeGenerator,
    target: Name,
    options: RuntimeValueCompileOptions,
  ): void {
    generator.comment('RuntimeValueCompiler.compileMapValue')
    generator.scope(() => {
      const mapValue = generator.const('mapValue', code`[]`)

      this.loops.compileLoop(toRawOperand(value.input), generator, () => {
        const mapItem = generator.let('mapItem')

        if (value.yieldTemplate === undefined) {
          generator.assign(mapItem, literal(undefined))
        } else {
          this.compileValue(value.yieldTemplate, generator, mapItem, options)
        }

        generator.if(code`${mapItem} !== undefined`, () => {
          generator.statement(code`${mapValue}.push(${mapItem})`)
        })
      })

      generator.assign(target, mapValue)
    })
  }

  private compileFilterValue(value: IterationValue, generator: CodeGenerator, target: Name): void {
    generator.comment('RuntimeValueCompiler.compileFilterValue')
    generator.scope(() => {
      const filterValue = generator.const('filterValue', code`[]`)

      this.loops.compileLoop(toRawOperand(value.input), generator, scope => {
        const predicate = generator.let('filterPredicate')

        this.compileExpressionWithCatch(
          this.expr.compileOperandCode(this.toRawPredicate(value)),
          generator,
          predicate,
          { expressionErrorFallback: literal(false) },
        )
        generator.if(predicate, () => {
          generator.statement(code`${filterValue}.push(${scope.rawItem})`)
        })
      })

      generator.assign(target, filterValue)
    })
  }

  private compileFindValue(value: IterationValue, generator: CodeGenerator, target: Name): void {
    generator.comment('RuntimeValueCompiler.compileFindValue')
    this.loops.compileLoop(toRawOperand(value.input), generator, scope => {
      const predicate = generator.let('findPredicate')

      this.compileExpressionWithCatch(this.expr.compileOperandCode(this.toRawPredicate(value)), generator, predicate, {
        expressionErrorFallback: literal(false),
      })
      generator.if(predicate, () => {
        generator.assign(target, scope.rawItem)
        generator.break()
      })
    })
  }

  private compileBlockValue(value: BlockValue, generator: CodeGenerator, target: Name): void {
    if (this.policy.compileBlockValue === undefined) {
      throw new ForgeInternalError('A nested block value is only compilable by the resolve concern')
    }

    this.policy.compileBlockValue(value, generator, target)
  }

  private toRawPredicate(value: IterationValue): unknown {
    return value.predicate === undefined ? undefined : toRawOperand(value.predicate)
  }

  private toPropertyValueVariablePrefix(key: string): string {
    const words = key.match(/[A-Za-z0-9]+/g)?.map(word => word.toLowerCase()) ?? []

    if (words.length === 0) {
      return 'propertyValue'
    }

    const firstWord = words[0] ?? 'property'
    const restWords = words.slice(1)
    const variablePrefix = `${firstWord}${restWords.map(word => this.capitaliseWord(word)).join('')}Value`

    if (/^[A-Za-z_$]/.test(variablePrefix)) {
      return variablePrefix
    }

    return `property${this.capitaliseWord(variablePrefix)}`
  }

  private capitaliseWord(value: string): string {
    return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
  }
}
