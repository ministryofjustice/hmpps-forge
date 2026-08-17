import { ASTNodeType } from '../../../contracts/ast/enums'
import { BlockType, IteratorType } from '../../../../authoring/types/enums'
import { IterateASTNode } from '../../../contracts/ast/expressions.type'
import { TemplateNode, TemplateValue } from '../../../contracts/ast/template.type'
import { arrayCode, Code, code, literal, objectCode } from '../../codegen/Code'
import CodeGenerator from '../../codegen/CodeGenerator'
import Name from '../../codegen/Name'
import FieldCodeEmitter from '../emitters/FieldCodeEmitter'
import ExpressionDispatcher, { IteratorScopeFrame } from '../expressions/ExpressionDispatcher'

export interface IteratorCompileScope {
  readonly input: Name
  readonly index: Name
  readonly item: Name
  readonly rawItem: Name
  readonly inputLength: Code
}

type TemplateNodePredicate = (node: TemplateNode) => boolean

interface TemplateSearchOptions {
  readonly descendIntoMatches?: boolean
}

interface TemplateMapIteratorProperties {
  readonly input?: unknown
  readonly iterator?: {
    readonly type?: unknown
    readonly yieldTemplate?: TemplateValue
  }
}

/**
 * Shared codegen for iterator/template traversal.
 *
 * Render, validation, answer prep, and field inventory all need the same MAP
 * expansion semantics: normalize input, enter Item/Loop scope, compile yielded
 * template values, and resolve dynamic field codes under that scope.
 */
export default class ScopedTemplateCompiler {
  private readonly fieldCodes: FieldCodeEmitter

  constructor(private readonly expr: ExpressionDispatcher) {
    this.fieldCodes = new FieldCodeEmitter(expr)
  }

  /**
   * Emits the shared MAP iterator loop with item, index, raw item, and input length in scope.
   */
  compileIteratorLoop(
    input: unknown,
    generator: CodeGenerator,
    compileItem: (scope: IteratorCompileScope) => void,
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
        const scope: IteratorCompileScope = {
          input: inputName,
          index: currentIndex,
          item,
          rawItem,
          inputLength,
        }
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

  /**
   * Emits a registered MAP iterator node and compiles its yield template under iterator scope.
   */
  compileMapIterator(
    node: IterateASTNode,
    generator: CodeGenerator,
    compileYield: (template: TemplateValue, scope: IteratorCompileScope) => void,
  ): void {
    const yieldTemplate = node.properties.iterator.yieldTemplate

    if (node.properties.iterator.type !== IteratorType.MAP || yieldTemplate === undefined) {
      return
    }

    this.compileIteratorLoop(node.properties.input, generator, scope => {
      compileYield(yieldTemplate, scope)
    })
  }

  /**
   * Emits a template MAP iterator node and compiles its yield template under iterator scope.
   */
  compileTemplateMapIterator(
    node: TemplateNode,
    generator: CodeGenerator,
    compileYield: (template: TemplateValue, scope: IteratorCompileScope) => void,
  ): void {
    const properties = (node.properties ?? {}) as TemplateMapIteratorProperties
    const iterator = properties.iterator

    if (iterator?.type !== IteratorType.MAP || iterator.yieldTemplate === undefined) {
      return
    }

    const yieldTemplate = iterator.yieldTemplate

    this.compileIteratorLoop(properties.input, generator, scope => {
      compileYield(yieldTemplate, scope)
    })
  }

  /**
   * Resolves a template field code to generated source, including dynamic code expressions.
   */
  compileTemplateCodeExpression(node: TemplateNode, generator: CodeGenerator): Code | Name | undefined {
    return this.fieldCodes.compileTemplateExpression(node, generator)
  }

  /**
   * Emits the runtime block ID for one template node under the current iterator scope.
   */
  compileTemplateInstanceIdExpression(node: TemplateNode): Code {
    const prefix = `compiled:${String(node.id)}`
    const iteratorIndexes = this.expr.iteratorStack.map(frame => frame.indexVar)

    if (iteratorIndexes.length === 0) {
      return literal(prefix)
    }

    return code`${`${prefix}:`} + ${arrayCode(iteratorIndexes.map(index => code`${index}`))}.join(":")`
  }

  /**
   * Finds template nodes matching a predicate, optionally stopping at the first matched branch.
   */
  findTemplateNodes(
    template: TemplateValue,
    predicate: TemplateNodePredicate,
    options: TemplateSearchOptions = {},
  ): TemplateNode[] {
    const results: TemplateNode[] = []

    this.walkTemplate(template, predicate, options.descendIntoMatches ?? true, results)

    return results
  }

  /**
   * Checks whether a template contains at least one node matching a predicate.
   */
  containsTemplateNode(template: TemplateValue, predicate: TemplateNodePredicate): boolean {
    return this.findTemplateNodes(template, predicate).length > 0
  }

  /**
   * Normalizes object and array iterator inputs before emitted template loops run.
   */
  private compileNormalizeIteratorInput(input: Name, generator: CodeGenerator): void {
    generator.if(code`${input} != null && !Array.isArray(${input}) && typeof ${input} === "object"`, () => {
      const mapEntry = generator.functionExpression('normalizeIteratorEntry', ['entry'], (body, [entry]) => {
        body.return(
          code`typeof ${entry}[1] === "object" && ${entry}[1] !== null ? Object.assign(${objectCode([
            { key: '@key', value: code`${entry}[0]` },
          ])}, ${entry}[1]) : ${objectCode([
            { key: '@key', value: code`${entry}[0]` },
            { key: '@value', value: code`${entry}[1]` },
          ])}`,
        )
      })

      generator.assign(input, code`Object.entries(${input}).map(${mapEntry})`)
    })
    generator.if(code`Array.isArray(${input})`, () => {
      const removeEmptyItems = generator.functionExpression('removeEmptyIteratorItems', ['item'], (body, [item]) => {
        body.return(code`${item} != null`)
      })

      generator.assign(input, code`${input}.filter(${removeEmptyItems})`)
    })
  }

  /**
   * Produces the scoped iterator item object exposed to @item references.
   */
  private compileIteratorItemScope(rawItem: Name): Code {
    return code`typeof ${rawItem} === "object" && ${rawItem} !== null ? Object.assign({}, ${rawItem}) : ${objectCode([
      { key: '@value', value: rawItem },
    ])}`
  }

  /**
   * Recursively walks template values while preserving caller-controlled descent semantics.
   */
  private walkTemplate(
    value: TemplateValue,
    predicate: TemplateNodePredicate,
    descendIntoMatches: boolean,
    results: TemplateNode[],
  ): void {
    if (value === null || value === undefined || typeof value !== 'object') {
      return
    }

    if (this.expr.isTemplateNode(value)) {
      const isMatch = predicate(value)

      if (isMatch) {
        results.push(value)
      }

      if (isMatch && !descendIntoMatches) {
        return
      }

      Object.values(value.properties ?? {}).forEach(child => {
        this.walkTemplate(child as TemplateValue, predicate, descendIntoMatches, results)
      })

      return
    }

    if (Array.isArray(value)) {
      value.forEach(item => {
        this.walkTemplate(item, predicate, descendIntoMatches, results)
      })

      return
    }

    Object.values(value).forEach(item => {
      this.walkTemplate(item, predicate, descendIntoMatches, results)
    })
  }
}

export function isTemplateFieldNode(node: TemplateNode): boolean {
  return node.originalType === ASTNodeType.BLOCK && node.blockType === BlockType.FIELD
}

export function isTemplateBlockNode(node: TemplateNode): boolean {
  return node.originalType === ASTNodeType.BLOCK
}
