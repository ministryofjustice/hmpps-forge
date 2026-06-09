import { ASTNodeType } from '../../contracts/ast/enums'
import { BlockType, ExpressionType, IteratorType } from '../../../authoring/types/enums'
import { IterateASTNode } from '../../contracts/ast/expressions.type'
import { TemplateNode, TemplateValue } from '../../contracts/ast/template.type'
import CodeEmitter from '../emitters/CodeEmitter'
import FieldCodeEmitter from '../emitters/FieldCodeEmitter'
import ExpressionDispatcher, { IteratorScopeFrame } from '../expressions/ExpressionDispatcher'

/**
 * The names of the generated-source variables/expressions in scope for one
 * iterated item: the normalized input array, the current index, the item scope
 * object, the raw (pre-scope) item, and the input length expression. Callers
 * splice these into the JS source they emit for each item.
 */
export interface IteratorCompileScope {
  readonly inputVar: string
  readonly indexVar: string
  readonly itemVar: string
  readonly rawItemExpr: string
  readonly inputLengthExpr: string
}

/** Selects which template nodes a traversal collects. */
type TemplateNodePredicate = (node: TemplateNode) => boolean

/** Tunes traversal: when `descendIntoMatches` is false, a matched branch is not searched deeper (defaults to true). */
interface TemplateSearchOptions {
  readonly descendIntoMatches?: boolean
}

/** Loosely-typed view of an iterate template node's properties, narrowed before reading the MAP input and yield template. */
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
  compileIteratorLoop(input: unknown, emitter: CodeEmitter, compileItem: (scope: IteratorCompileScope) => void): void {
    const inputVar = emitter.let('iteratorInput', this.expr.compileOperand(input))

    this.compileNormalizeIteratorInput(inputVar, emitter)

    emitter.if(`Array.isArray(${inputVar})`, () => {
      const indexVar = emitter.let('iteratorIndex', '0')

      emitter.while(`${indexVar} < ${inputVar}.length`, () => {
        const currentIndexVar = emitter.const('currentIteratorIndex', indexVar)
        const rawItemVar = emitter.const('rawIteratorItem', `${inputVar}[${currentIndexVar}]`)

        emitter.assign(indexVar, `${indexVar} + 1`)
        emitter.if(`${rawItemVar} == null`, () => emitter.continue())

        const itemVar = emitter.const('iteratorItem', this.compileIteratorItemScope(rawItemVar))
        const inputLengthExpr = `${inputVar}.length`
        const scope: IteratorCompileScope = {
          inputVar,
          indexVar: currentIndexVar,
          itemVar,
          rawItemExpr: rawItemVar,
          inputLengthExpr,
        }
        const frame: IteratorScopeFrame = {
          itemVar,
          indexVar: currentIndexVar,
          inputLengthExpr,
          rawItemExpr: rawItemVar,
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
    emitter: CodeEmitter,
    compileYield: (template: TemplateValue, scope: IteratorCompileScope) => void,
  ): void {
    const yieldTemplate = node.properties.iterator.yieldTemplate

    if (node.properties.iterator.type !== IteratorType.MAP || yieldTemplate === undefined) {
      return
    }

    this.compileIteratorLoop(node.properties.input, emitter, scope => {
      compileYield(yieldTemplate, scope)
    })
  }

  /**
   * Emits a template MAP iterator node and compiles its yield template under iterator scope.
   */
  compileTemplateMapIterator(
    node: TemplateNode,
    emitter: CodeEmitter,
    compileYield: (template: TemplateValue, scope: IteratorCompileScope) => void,
  ): void {
    const properties = (node.properties ?? {}) as TemplateMapIteratorProperties
    const iterator = properties.iterator

    if (iterator?.type !== IteratorType.MAP || iterator.yieldTemplate === undefined) {
      return
    }

    const yieldTemplate = iterator.yieldTemplate

    this.compileIteratorLoop(properties.input, emitter, scope => {
      compileYield(yieldTemplate, scope)
    })
  }

  /**
   * Resolves a template field code to generated source, including dynamic code expressions.
   */
  compileTemplateCodeExpression(node: TemplateNode, emitter: CodeEmitter): string | undefined {
    return this.fieldCodes.compileTemplateExpression(node, emitter)
  }

  /**
   * Collects every template node matching a predicate. With `descendIntoMatches`
   * false, a matched node is collected but its subtree is not searched, so only
   * the outermost match on each branch is returned (nested matches are skipped).
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
   * Extracts the yield template of a MAP iterate node so callers can descend into
   * it for recursive (nested-iterator) compilation. Returns undefined for any
   * non-MAP iterator or a MAP with no yield template.
   */
  getMapIterateYieldTemplate(node: TemplateNode): TemplateValue | undefined {
    const properties = (node.properties ?? {}) as TemplateMapIteratorProperties
    const iterator = properties.iterator

    if (iterator?.type !== IteratorType.MAP || iterator.yieldTemplate === undefined) {
      return undefined
    }

    return iterator.yieldTemplate
  }

  /**
   * Checks whether a template contains at least one node matching a predicate.
   */
  containsTemplateNode(template: TemplateValue, predicate: TemplateNodePredicate): boolean {
    return this.findTemplateNodes(template, predicate).length > 0
  }

  /**
   * Emits source that normalizes the iterator input variable in place before looping:
   * a plain object becomes an array of per-entry items (each carrying its `@key`, and
   * scalars wrapped under `@value`), and an array is filtered of null/undefined entries.
   * Non-array, non-object inputs are left untouched so the loop guard skips them.
   */
  compileNormalizeIteratorInput(inputVar: string, emitter: CodeEmitter): void {
    emitter.if(`${inputVar} != null && !Array.isArray(${inputVar}) && typeof ${inputVar} === "object"`, () => {
      emitter.assign(
        inputVar,
        `Object.entries(${inputVar}).map(function(entry) { return typeof entry[1] === "object" && entry[1] !== null ? Object.assign({"@key": entry[0]}, entry[1]) : {"@key": entry[0], "@value": entry[1]}; })`,
      )
    })
    emitter.if(`Array.isArray(${inputVar})`, () => {
      emitter.assign(inputVar, `${inputVar}.filter(function(item) { return item != null; })`)
    })
  }

  /**
   * Builds the source expression for one item's scope object: a shallow copy of an
   * object item, or a scalar wrapped under `@value`. The copy keeps the runtime item
   * scope isolated from the raw collection element.
   */
  compileIteratorItemScope(rawItemExpr: string): string {
    return `typeof ${rawItemExpr} === "object" && ${rawItemExpr} !== null ? Object.assign({}, ${rawItemExpr}) : { "@value": ${rawItemExpr} }`
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

/** Predicate matching a template node that wraps a field block. */
export function isTemplateFieldNode(node: TemplateNode): boolean {
  return node.originalType === ASTNodeType.BLOCK && node.blockType === BlockType.FIELD
}

/** Predicate matching any template node that wraps a block (field or otherwise). */
export function isTemplateBlockNode(node: TemplateNode): boolean {
  return node.originalType === ASTNodeType.BLOCK
}

/** Predicate matching a template node that wraps an iterate expression. */
export function isTemplateIterateNode(node: TemplateNode): boolean {
  return node.originalType === ASTNodeType.EXPRESSION && node.expressionType === ExpressionType.ITERATE
}
