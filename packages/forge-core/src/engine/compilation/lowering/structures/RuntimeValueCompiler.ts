import { ExpressionType, IteratorType } from '../../../../authoring/types/enums'
import { ASTNode } from '../../../contracts/ast/ast.type'
import { ASTNodeType } from '../../../contracts/ast/enums'
import { TemplateNode } from '../../../contracts/ast/template.type'
import { Code, code, literal, objectCode, SafeCode } from '../../codegen/Code'
import CodeGenerator from '../../codegen/CodeGenerator'
import Name from '../../codegen/Name'
import ExpressionDispatcher from '../expressions/ExpressionDispatcher'
import { IteratorScopeFrame } from '../expressions/types'

export interface RuntimeValueCompileOptions {
  readonly expressionErrorFallback?: Code
  readonly expressionErrorMode?: RuntimeValueErrorMode
  readonly omitUndefinedArrayItems?: boolean
}

export interface RuntimeValueCompilerPolicy {
  readonly expressionErrorFallback: Code
  readonly expressionErrorMode?: RuntimeValueErrorMode
  readonly omitUndefinedArrayItems: boolean
  readonly isStructuralValue?: (value: unknown) => boolean
  readonly compileStructuralValue?: (value: unknown, generator: CodeGenerator, target: Name) => boolean
  readonly noteInlineIterator?: (nodeId: string) => void
}

type RuntimeValueErrorMode = 'fallback' | 'throw'

interface MatchBranch {
  readonly predicate?: unknown
  readonly value?: unknown
}

interface IteratorValueScope {
  readonly input: Name
  readonly index: Name
  readonly item: Name
  readonly rawItem: Name
  readonly inputLength: Code
}

/** Materialises authored values into generated runtime values. */
export default class RuntimeValueCompiler {
  constructor(
    private readonly expr: ExpressionDispatcher,
    private readonly policy: RuntimeValueCompilerPolicy,
  ) {}

  compileAssignment(
    value: unknown,
    generator: CodeGenerator,
    targetObject: SafeCode,
    key: string,
    options: RuntimeValueCompileOptions = {},
  ): void {
    if (this.isStaticValue(value)) {
      generator.assign(code`${targetObject}[${key}]`, literal(value))

      return
    }

    generator.comment('RuntimeValueCompiler.compileAssignment')
    generator.scope(() => {
      const result = generator.let(this.toPropertyValueVariablePrefix(key))

      this.compileValue(value, generator, result, options)
      generator.assign(code`${targetObject}[${key}]`, result)
    })
  }

  compileValue(value: unknown, generator: CodeGenerator, target: Name, options: RuntimeValueCompileOptions = {}): void {
    if (value === null || value === undefined) {
      generator.assign(target, literal(value))

      return
    }

    if (this.policy.compileStructuralValue?.(value, generator, target) === true) {
      return
    }

    if (this.expr.isTemplateNode(value) || this.expr.isCompilableNode(value)) {
      this.compileNodeValue(value, generator, target, options)

      return
    }

    if (Array.isArray(value)) {
      this.compileArrayValue(value, generator, target, options)

      return
    }

    if (this.isRecord(value)) {
      this.compileObjectValue(value, generator, target, options)

      return
    }

    generator.assign(target, literal(value))
  }

  isStaticValue(value: unknown): boolean {
    if (value === null || value === undefined || typeof value !== 'object') {
      return true
    }

    if (this.policy.isStructuralValue?.(value) === true) {
      return false
    }

    if (this.expr.isCompilableNode(value) || this.expr.isTemplateNode(value)) {
      return false
    }

    if (Array.isArray(value)) {
      return value.every(item => this.isStaticValue(item))
    }

    return Object.values(value).every(item => this.isStaticValue(item))
  }

  private compileNodeValue(
    node: ASTNode | TemplateNode,
    generator: CodeGenerator,
    target: Name,
    options: RuntimeValueCompileOptions,
  ): void {
    const expressionType = this.getExpressionType(node)

    if (expressionType === ExpressionType.CONDITIONAL) {
      this.compileConditionalValue(node, generator, target, options)

      return
    }

    if (expressionType === ExpressionType.MATCH) {
      this.compileMatchValue(node, generator, target, options)

      return
    }

    if (expressionType === ExpressionType.ITERATE) {
      this.compileIterateValue(node, generator, target, options)

      return
    }

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

  private compileArrayValue(
    value: unknown[],
    generator: CodeGenerator,
    target: Name,
    options: RuntimeValueCompileOptions,
  ): void {
    const omitUndefined = options.omitUndefinedArrayItems ?? this.policy.omitUndefinedArrayItems

    generator.comment('RuntimeValueCompiler.compileArrayValue')
    generator.scope(() => {
      const arrayValue = generator.const('arrayValue', code`[]`)

      value.forEach(element => {
        if (this.isStaticValue(element)) {
          generator.statement(code`${arrayValue}.push(${literal(element)})`)

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

  private compileObjectValue(
    value: Record<string, unknown>,
    generator: CodeGenerator,
    target: Name,
    options: RuntimeValueCompileOptions,
  ): void {
    generator.comment('RuntimeValueCompiler.compileObjectValue')
    generator.scope(() => {
      const objectValue = generator.const('objectValue', code`{}`)

      Object.entries(value).forEach(([key, entry]) => {
        this.compileAssignment(entry, generator, objectValue, key, options)
      })

      generator.assign(target, objectValue)
    })
  }

  private compileConditionalValue(
    node: ASTNode | TemplateNode,
    generator: CodeGenerator,
    target: Name,
    options: RuntimeValueCompileOptions,
  ): void {
    generator.comment('RuntimeValueCompiler.compileConditionalValue')
    const properties = this.getProperties(node)
    const predicate = generator.let('conditionalPredicate')

    this.compileExpressionWithCatch(this.expr.compileOperandCode(properties.predicate), generator, predicate, {
      ...options,
      expressionErrorFallback: literal(false),
    })

    generator.if(
      predicate,
      () => this.compileValue(properties.thenValue, generator, target, options),
      () => this.compileValue(properties.elseValue, generator, target, options),
    )
  }

  private compileMatchValue(
    node: ASTNode | TemplateNode,
    generator: CodeGenerator,
    target: Name,
    options: RuntimeValueCompileOptions,
  ): void {
    generator.comment('RuntimeValueCompiler.compileMatchValue')
    const properties = this.getProperties(node)
    const branches = this.getMatchBranches(properties.branches)
    const compiledBranches = branches.map(branch => {
      const predicate = generator.let('matchPredicate')

      this.compileExpressionWithCatch(this.expr.compileOperandCode(branch.predicate), generator, predicate, {
        ...options,
        expressionErrorFallback: literal(false),
      })

      return {
        condition: predicate,
        body: () => this.compileValue(branch.value, generator, target, options),
      }
    })

    generator.ifChain(
      compiledBranches,
      properties.otherwise === undefined
        ? undefined
        : () => this.compileValue(properties.otherwise, generator, target, options),
    )
  }

  private compileIterateValue(
    node: ASTNode | TemplateNode,
    generator: CodeGenerator,
    target: Name,
    options: RuntimeValueCompileOptions,
  ): void {
    const iterator = this.getIteratorProperties(node)

    this.noteInlineIterator(node)

    if (iterator?.type === IteratorType.MAP) {
      this.compileMapValue(node, generator, target, options)

      return
    }

    if (iterator?.type === IteratorType.FILTER) {
      this.compileFilterValue(node, generator, target)

      return
    }

    if (iterator?.type === IteratorType.FIND) {
      this.compileFindValue(node, generator, target)

      return
    }

    generator.assign(target, literal(undefined))
  }

  private compileMapValue(
    node: ASTNode | TemplateNode,
    generator: CodeGenerator,
    target: Name,
    options: RuntimeValueCompileOptions,
  ): void {
    const properties = this.getProperties(node)
    const iterator = this.getIteratorProperties(node)

    generator.comment('RuntimeValueCompiler.compileMapValue')
    generator.scope(() => {
      const mapValue = generator.const('mapValue', code`[]`)

      this.compileIteratorLoop(properties.input, generator, () => {
        const mapItem = generator.let('mapItem')

        this.compileValue(iterator?.yieldTemplate, generator, mapItem, options)
        generator.if(code`${mapItem} !== undefined`, () => {
          generator.statement(code`${mapValue}.push(${mapItem})`)
        })
      })

      generator.assign(target, mapValue)
    })
  }

  private compileFilterValue(node: ASTNode | TemplateNode, generator: CodeGenerator, target: Name): void {
    const properties = this.getProperties(node)
    const iterator = this.getIteratorProperties(node)

    generator.comment('RuntimeValueCompiler.compileFilterValue')
    generator.scope(() => {
      const filterValue = generator.const('filterValue', code`[]`)

      this.compileIteratorLoop(properties.input, generator, scope => {
        const predicate = generator.let('filterPredicate')

        this.compileExpressionWithCatch(
          this.expr.compileOperandCode(iterator?.predicateTemplate),
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

  private compileFindValue(node: ASTNode | TemplateNode, generator: CodeGenerator, target: Name): void {
    const properties = this.getProperties(node)
    const iterator = this.getIteratorProperties(node)

    generator.comment('RuntimeValueCompiler.compileFindValue')
    this.compileIteratorLoop(properties.input, generator, scope => {
      const predicate = generator.let('findPredicate')

      this.compileExpressionWithCatch(this.expr.compileOperandCode(iterator?.predicateTemplate), generator, predicate, {
        expressionErrorFallback: literal(false),
      })
      generator.if(predicate, () => {
        generator.assign(target, scope.rawItem)
        generator.break()
      })
    })
  }

  private compileIteratorLoop(
    input: unknown,
    generator: CodeGenerator,
    compileItem: (scope: IteratorValueScope) => void,
  ): void {
    const inputName = generator.let('iteratorInput', this.expr.compileOperandCode(input))

    this.compileNormalizeIteratorInput(inputName, generator)

    generator.if(code`Array.isArray(${inputName})`, () => {
      const indexName = generator.let('iteratorIndex', literal(0))

      generator.while(code`${indexName} < ${inputName}.length`, () => {
        const currentIndex = generator.const('currentIteratorIndex', indexName)
        const rawItem = generator.const('rawIteratorItem', code`${inputName}[${currentIndex}]`)

        generator.assign(indexName, code`${indexName} + 1`)
        generator.if(code`${rawItem} == null`, () => generator.continue())

        const item = generator.const('iteratorItem', this.compileIteratorItemScope(rawItem))
        const inputLength = code`${inputName}.length`
        const scope: IteratorValueScope = { input: inputName, index: currentIndex, item, rawItem, inputLength }
        const frame: IteratorScopeFrame = {
          itemVar: item,
          indexVar: currentIndex,
          inputLengthExpr: inputLength,
          rawItemExpr: rawItem,
        }

        this.expr.withIteratorFrame(frame, () => {
          compileItem(scope)
        })
      })
    })
  }

  private compileNormalizeIteratorInput(input: Name, generator: CodeGenerator): void {
    generator.if(code`${input} != null && !Array.isArray(${input}) && typeof ${input} === "object"`, () => {
      const normalizeEntry = generator.functionExpression('normalizeIteratorEntry', ['entry'], (body, [entry]) => {
        body.return(
          code`typeof ${entry}[1] === "object" && ${entry}[1] !== null ? Object.assign(${objectCode([
            { key: '@key', value: code`${entry}[0]` },
          ])}, ${entry}[1]) : ${objectCode([
            { key: '@key', value: code`${entry}[0]` },
            { key: '@value', value: code`${entry}[1]` },
          ])}`,
        )
      })

      generator.assign(input, code`Object.entries(${input}).map(${normalizeEntry})`)
    })
    generator.if(code`Array.isArray(${input})`, () => {
      const removeEmptyItems = generator.functionExpression('removeEmptyIteratorItems', ['item'], (body, [item]) => {
        body.return(code`${item} != null`)
      })

      generator.assign(input, code`${input}.filter(${removeEmptyItems})`)
    })
  }

  private compileIteratorItemScope(rawItem: Name): Code {
    return code`typeof ${rawItem} === "object" && ${rawItem} !== null ? Object.assign({}, ${rawItem}) : ${objectCode([
      { key: '@value', value: rawItem },
    ])}`
  }

  private noteInlineIterator(node: ASTNode | TemplateNode): void {
    this.policy.noteInlineIterator?.(node.id)
  }

  private getExpressionType(node: ASTNode | TemplateNode): string | undefined {
    if (this.expr.isTemplateNode(node)) {
      return node.originalType === ASTNodeType.EXPRESSION && typeof node.expressionType === 'string'
        ? node.expressionType
        : undefined
    }

    const expressionType = (node as { expressionType?: unknown }).expressionType

    return node.type === ASTNodeType.EXPRESSION && typeof expressionType === 'string' ? expressionType : undefined
  }

  private getIteratorProperties(node: ASTNode | TemplateNode): Record<string, unknown> | undefined {
    const iterator = this.getProperties(node).iterator

    return this.isRecord(iterator) ? iterator : undefined
  }

  private getProperties(node: ASTNode | TemplateNode): Record<string, unknown> {
    return (node.properties ?? {}) as Record<string, unknown>
  }

  private getMatchBranches(value: unknown): MatchBranch[] {
    if (!Array.isArray(value)) {
      return []
    }

    return value
      .filter(item => this.isRecord(item))
      .map(branch => ({
        predicate: branch.predicate,
        value: branch.value,
      }))
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

  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)
  }
}
