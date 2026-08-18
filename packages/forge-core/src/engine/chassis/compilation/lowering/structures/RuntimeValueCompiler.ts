import { IteratorType } from '../../../../../authoring/types/enums'
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
import ForgeInternalError from '../../../../errors/ForgeInternalError'
import {
  CodeFragment,
  arrayCode,
  code,
  literal,
  objectCode,
  propertyCode,
  structuredLiteralCode,
  SafeCode,
} from '../codegen/fragments/CodeFragment'
import CodeGenerator from '../codegen/CodeGenerator'
import IdentifierName from '../codegen/fragments/IdentifierName'
import IteratorLoopEmitter from '../emitters/IteratorLoopEmitter'
import ExpressionDispatcher from '../expressions/ExpressionDispatcher'

export interface RuntimeValueCompileOptions {
  readonly expressionErrorFallback?: CodeFragment
  readonly expressionErrorMode?: RuntimeValueErrorMode
  readonly omitUndefinedArrayItems?: boolean
}

export interface RuntimeValueCompilerPolicy {
  readonly expressionErrorFallback: CodeFragment
  readonly expressionErrorMode?: RuntimeValueErrorMode
  readonly omitUndefinedArrayItems: boolean
  /**
   * Emits a nested `BlockValue` as its own named unit (comment, props const,
   * resolve const) and returns the name to reference. Only the resolve concern
   * (which turns blocks into render-ready props) handles nested blocks; a
   * policy without this callback treats a nested block as an impossible state.
   */
  readonly compileBlockValue?: (block: BlockValue, generator: CodeGenerator, nameHint: string) => SafeCode
}

type RuntimeValueErrorMode = 'fallback' | 'throw'

/** Turns authored values (the raw values journey authors write) into generated JavaScript code that produces them at runtime. */
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
    const target = code`${targetObject}${propertyCode(key)}`

    if (value.kind === AuthoredValueKind.EXPRESSION) {
      this.compileExpressionInto(value.node, generator, target, options)

      return
    }

    generator.assign(target, this.compileValueExpression(value, generator, key, options))
  }

  /**
   * Compiles a value to an expression usable inside a literal. Values that
   * need statements — nested blocks, invoking expressions, conditionals,
   * matches, iterations — are hoisted into named consts emitted just above,
   * in authored order, and the returned expression references the name.
   */
  compileValueExpression(
    value: AuthoredValue,
    generator: CodeGenerator,
    nameHint: string,
    options: RuntimeValueCompileOptions = {},
  ): SafeCode {
    switch (value.kind) {
      case AuthoredValueKind.STATIC:
        return structuredLiteralCode(value.value)
      case AuthoredValueKind.EXPRESSION:
        return this.compileExpressionOperand(value.node, generator, nameHint, options)
      case AuthoredValueKind.RECORD:
        return this.compileRecordExpression(value, generator, options)
      case AuthoredValueKind.LIST:
        return this.compileListExpression(value, generator, nameHint, options)
      case AuthoredValueKind.BLOCK:
        return this.compileBlockExpression(value, generator, nameHint)
      default: {
        const result = generator.let(this.toPropertyValueVariablePrefix(nameHint))

        this.compileValue(value, generator, result, options)

        return result
      }
    }
  }

  compileValue(
    value: AuthoredValue,
    generator: CodeGenerator,
    target: IdentifierName,
    options: RuntimeValueCompileOptions = {},
  ): void {
    switch (value.kind) {
      case AuthoredValueKind.STATIC:
        generator.assign(target, structuredLiteralCode(value.value))

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
        generator.assign(target, this.compileListExpression(value, generator, target.value, options))

        return
      case AuthoredValueKind.RECORD:
        generator.assign(target, this.compileRecordExpression(value, generator, options))

        return
      case AuthoredValueKind.BLOCK:
        generator.assign(target, this.compileBlockExpression(value, generator, target.value))

        return
      default:
        throw new ForgeInternalError('Unclassified authored value reached the runtime value compiler')
    }
  }

  private compileExpressionValue(
    node: ASTNode | TemplateNode,
    generator: CodeGenerator,
    target: IdentifierName,
    options: RuntimeValueCompileOptions,
  ): void {
    this.compileExpressionInto(node, generator, target, options)
  }

  /**
   * Assigns a compiled expression to `target`. In throw mode the assignment is
   * an unconditional statement, so function calls may hoist their argument
   * consts into the surrounding body; in fallback mode every temp must stay
   * inside the try block, so hoisting stays off.
   */
  private compileExpressionInto(
    node: ASTNode | TemplateNode,
    generator: CodeGenerator,
    target: SafeCode,
    options: RuntimeValueCompileOptions,
  ): void {
    const errorMode = options.expressionErrorMode ?? this.policy.expressionErrorMode ?? 'fallback'

    if (errorMode === 'throw') {
      const expression = this.expr.withCallHoistingScope(generator, () => this.compileNodeExpression(node))

      generator.assign(target, expression)

      return
    }

    const expression = this.compileNodeExpression(node)
    const fallback = options.expressionErrorFallback ?? this.policy.expressionErrorFallback

    generator.tryCatch(
      () => generator.assign(target, expression),
      'error',
      () => generator.assign(target, fallback),
    )
  }

  private compileNodeExpression(node: ASTNode | TemplateNode): CodeFragment {
    return this.expr.isTemplateNode(node)
      ? this.expr.compileTemplateExpressionCode(node)
      : this.expr.compileExpressionCode(node)
  }

  private compileExpressionWithCatch(
    expression: CodeFragment,
    generator: CodeGenerator,
    target: IdentifierName,
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

  /**
   * Compiles an expression operand for a literal position. Invocation-bearing
   * expressions are hoisted into a named const so authored calls keep their
   * source order and stay inspectable; plain reads are inlined. Fallback-mode
   * expressions always hoist, because the try/catch needs statements.
   */
  private compileExpressionOperand(
    node: ASTNode | TemplateNode,
    generator: CodeGenerator,
    nameHint: string,
    options: RuntimeValueCompileOptions,
  ): SafeCode {
    const errorMode = options.expressionErrorMode ?? this.policy.expressionErrorMode ?? 'fallback'

    if (errorMode === 'throw') {
      const expression = this.expr.withCallHoistingScope(generator, () => this.compileNodeExpression(node))

      if (!expression.containsInvocation) {
        return expression
      }

      return generator.const(this.toPropertyValueVariablePrefix(nameHint), expression)
    }

    const result = generator.let(this.toPropertyValueVariablePrefix(nameHint))

    this.compileExpressionInto(node, generator, result, options)

    return result
  }

  private compileRecordExpression(
    value: RecordValue,
    generator: CodeGenerator,
    options: RuntimeValueCompileOptions,
  ): CodeFragment {
    return objectCode(
      value.entries.map(entry => ({
        key: entry.key,
        value: this.compileValueExpression(entry.value, generator, entry.key, options),
      })),
    )
  }

  /**
   * Lists inline as array literals when no item can resolve to `undefined`.
   * When one can and undefined items must be dropped, the list falls back to
   * push-based construction under a named const.
   */
  private compileListExpression(
    value: ListValue,
    generator: CodeGenerator,
    nameHint: string,
    options: RuntimeValueCompileOptions,
  ): SafeCode {
    const omitUndefined = options.omitUndefinedArrayItems ?? this.policy.omitUndefinedArrayItems

    if (omitUndefined && value.items.some(item => this.mayResolveUndefined(item))) {
      return this.compileListConstruction(value, generator, this.toPropertyValueVariablePrefix(nameHint), options)
    }

    return arrayCode(value.items.map(item => this.compileValueExpression(item, generator, nameHint, options)))
  }

  private mayResolveUndefined(value: AuthoredValue): boolean {
    if (value.kind === AuthoredValueKind.STATIC) {
      return value.value === undefined
    }

    return value.kind !== AuthoredValueKind.RECORD &&
      value.kind !== AuthoredValueKind.LIST &&
      value.kind !== AuthoredValueKind.BLOCK
  }

  private compileListConstruction(
    value: ListValue,
    generator: CodeGenerator,
    namePrefix: string,
    options: RuntimeValueCompileOptions,
  ): IdentifierName {
    const omitUndefined = options.omitUndefinedArrayItems ?? this.policy.omitUndefinedArrayItems
    const arrayValue = generator.const(namePrefix, code`[]`)

    value.items.forEach(element => {
      if (element.kind === AuthoredValueKind.STATIC) {
        generator.statement(code`${arrayValue}.push(${structuredLiteralCode(element.value)})`)

        return
      }

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

    return arrayValue
  }

  private compileConditionalValue(
    value: ConditionalValue,
    generator: CodeGenerator,
    target: IdentifierName,
    options: RuntimeValueCompileOptions,
  ): void {
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
    target: IdentifierName,
    options: RuntimeValueCompileOptions,
  ): void {
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
    target: IdentifierName,
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
    target: IdentifierName,
    options: RuntimeValueCompileOptions,
  ): void {
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
  }

  private compileFilterValue(value: IterationValue, generator: CodeGenerator, target: IdentifierName): void {
    const filterValue = generator.const('filterValue', code`[]`)

    this.loops.compileLoop(toRawOperand(value.input), generator, scope => {
      const predicate = generator.let('filterPredicate')

      this.compileExpressionWithCatch(this.expr.compileOperandCode(this.toRawPredicate(value)), generator, predicate, {
        expressionErrorFallback: literal(false),
      })
      generator.if(predicate, () => {
        generator.statement(code`${filterValue}.push(${scope.rawItem})`)
      })
    })

    generator.assign(target, filterValue)
  }

  private compileFindValue(value: IterationValue, generator: CodeGenerator, target: IdentifierName): void {
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

  private compileBlockExpression(value: BlockValue, generator: CodeGenerator, nameHint: string): SafeCode {
    if (this.policy.compileBlockValue === undefined) {
      throw new ForgeInternalError('A nested block value is only compilable by the resolve concern')
    }

    return this.policy.compileBlockValue(value, generator, nameHint)
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
