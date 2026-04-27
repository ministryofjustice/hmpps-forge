import { ASTNodeType } from '../../types/enums'
import { BlockType, IteratorType } from '../../../authoring/types/enums'
import { IterateASTNode } from '../../types/expressions.type'
import { TemplateNode, TemplateValue } from '../../types/template.type'
import CodeEmitter from './CodeEmitter'
import NodeCompilationDispatcher, { IteratorScopeFrame } from './NodeCompilationDispatcher'
import { emitIteratorItemScope, emitNormalizeIteratorInput } from './iteratorCodegen'

export interface IteratorCompileScope {
  readonly inputVar: string
  readonly indexVar: string
  readonly itemVar: string
  readonly rawItemExpr: string
  readonly inputLengthExpr: string
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
  constructor(private readonly expr: NodeCompilationDispatcher) {}

  compileIteratorLoop(input: unknown, emitter: CodeEmitter, compileItem: (scope: IteratorCompileScope) => void): void {
    const inputExpr = this.expr.compileOperand(input)
    const inputVar = emitter.nextVar('_input')
    const indexVar = emitter.nextVar('_idx')
    const itemVar = emitter.nextVar('_item')
    const rawItemExpr = `${inputVar}[${indexVar}]`
    const scope: IteratorCompileScope = {
      inputVar,
      indexVar,
      itemVar,
      rawItemExpr,
      inputLengthExpr: `${inputVar}.length`,
    }
    const frame: IteratorScopeFrame = {
      itemVar,
      indexVar,
      inputLengthExpr: scope.inputLengthExpr,
      rawItemExpr,
    }

    emitter.emit(`var ${inputVar} = ${inputExpr};`)
    emitNormalizeIteratorInput(emitter, inputVar)

    emitter.emitBlock(`if (Array.isArray(${inputVar}))`, () => {
      emitter.emitBlock(`for (var ${indexVar} = 0; ${indexVar} < ${inputVar}.length; ${indexVar}++)`, () => {
        emitter.emitBlock(`if (${rawItemExpr} == null)`, () => {
          emitter.emit('continue;')
        })
        emitIteratorItemScope(emitter, inputVar, indexVar, itemVar)
        this.expr.withIteratorFrame(frame, () => {
          compileItem(scope)
        })
      })
    })
  }

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

  compileTemplateCodeExpression(node: TemplateNode, emitter: CodeEmitter): string | undefined {
    const code = node.properties?.code

    if (typeof code === 'string') {
      return JSON.stringify(code)
    }

    if (!this.expr.isTemplateNode(code)) {
      return undefined
    }

    const codeVar = emitter.nextVar('_code')
    const codeExpr = this.expr.compileTemplateExpression(code)

    emitter.emit(`var ${codeVar} = String(${codeExpr});`)

    return codeVar
  }

  findTemplateNodes(
    template: TemplateValue,
    predicate: TemplateNodePredicate,
    options: TemplateSearchOptions = {},
  ): TemplateNode[] {
    const results: TemplateNode[] = []

    this.walkTemplate(template, predicate, options.descendIntoMatches ?? true, results)

    return results
  }

  containsTemplateNode(template: TemplateValue, predicate: TemplateNodePredicate): boolean {
    return this.findTemplateNodes(template, predicate).length > 0
  }

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
