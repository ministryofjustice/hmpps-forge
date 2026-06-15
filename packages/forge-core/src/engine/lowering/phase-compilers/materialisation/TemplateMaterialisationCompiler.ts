import { IterateASTNode } from '../../../contracts/ast/expressions.type'
import { TemplateNode, TemplateValue } from '../../../contracts/ast/template.type'
import CodeEmitter from '../../emitters/CodeEmitter'
import ExpressionDispatcher from '../../expressions/ExpressionDispatcher'
import ScopedTemplateCompiler, {
  isTemplateBlockNode,
  isTemplateFieldNode,
  isTemplateIterateNode,
} from '../../structures/ScopedTemplateCompiler'
import { compileGeneratedFunction } from '../../function-construction/GeneratedFunctionCompiler'
import type { CompilationDependencies } from '../../compilationDependencies.type'
import type { CompiledTemplateMaterialiserFunction } from '../../../contracts/compiled/compiledFunctions.type'
import type { IteratorScopeFrame } from '../../expressions/ExpressionDispatcher'

import type { NodeId } from '../../../contracts/ast/ast.type'

/** Intermediate result from the materialisation compiler, before the orchestrator attaches templateFunctions. */
export interface CompiledMaterialisationRootIntermediate {
  readonly nodeId: NodeId
  readonly materialise: CompiledTemplateMaterialiserFunction
}

export default class TemplateMaterialisationCompiler {
  private readonly expr: ExpressionDispatcher

  private readonly templates: ScopedTemplateCompiler

  constructor(dependencies: CompilationDependencies) {
    this.expr = new ExpressionDispatcher(dependencies)
    this.templates = new ScopedTemplateCompiler(this.expr)
  }

  compileMaterialisationRoot(iterateNode: IterateASTNode): CompiledMaterialisationRootIntermediate | undefined {
    const template = iterateNode.properties.iterator.yieldTemplate

    if (template === undefined || !this.containsLeafNode(template)) {
      return undefined
    }

    const materialise = compileGeneratedFunction<CompiledTemplateMaterialiserFunction>(
      this.expr,
      ['ctx', 'templateFunctions'],
      () => this.buildMaterialiserSource(iterateNode),
      { phase: 'template-materialisation' },
    )

    return { nodeId: iterateNode.id, materialise }
  }

  private buildMaterialiserSource(iterateNode: IterateASTNode): string {
    const emitter = CodeEmitter.strict()
    const iteratorNodeIdLiteral = JSON.stringify(iterateNode.id)

    emitter.declareConst('nodes', '[]')

    const inputVar = emitter.let('iteratorInput', this.expr.compileOperand(iterateNode.properties.input))

    this.templates.compileNormalizeIteratorInput(inputVar, emitter)

    emitter.if(`Array.isArray(${inputVar})`, () => {
      const indexVar = emitter.let('i', '0')

      emitter.while(`${indexVar} < ${inputVar}.length`, () => {
        const rawItemVar = emitter.const('rawItem', `${inputVar}[${indexVar}]`)

        emitter.assign(indexVar, `${indexVar} + 1`)
        emitter.if(`${rawItemVar} == null`, () => emitter.continue())

        const itemVar = emitter.const('item', this.templates.compileIteratorItemScope(rawItemVar))
        const currentIndexVar = emitter.const('itemIndex', `${indexVar} - 1`)
        const instanceKeyPrefixVar = emitter.const(
          'instanceKeyPrefix',
          `${iteratorNodeIdLiteral} + "[" + ${currentIndexVar} + "]"`,
        )

        const frame: IteratorScopeFrame = {
          itemVar,
          indexVar: currentIndexVar,
          inputLengthExpr: `${inputVar}.length`,
          rawItemExpr: rawItemVar,
        }

        this.expr.withIteratorFrame(frame, () => {
          this.emitLeafNodes(
            iterateNode.properties.iterator.yieldTemplate!,
            emitter,
            instanceKeyPrefixVar,
            iteratorNodeIdLiteral,
            currentIndexVar,
            'undefined',
          )
        })
      })
    })

    emitter.emitBlank()
    emitter.return('nodes')

    return emitter.toString()
  }

  private emitLeafNodes(
    template: TemplateValue,
    emitter: CodeEmitter,
    instanceKeyPrefixVar: string,
    iteratorNodeIdExpr: string,
    itemIndexVar: string,
    parentInstanceKeyExpr: string,
  ): void {
    const directNodes = this.templates.findTemplateNodes(
      template,
      node => isTemplateFieldNode(node) || isTemplateBlockNode(node) || isTemplateIterateNode(node),
      { descendIntoMatches: false },
    )

    directNodes.forEach(node => {
      if (isTemplateIterateNode(node)) {
        this.emitNestedIterator(node, emitter, instanceKeyPrefixVar)

        return
      }

      this.emitMaterialisedNode(
        node,
        emitter,
        instanceKeyPrefixVar,
        iteratorNodeIdExpr,
        itemIndexVar,
        parentInstanceKeyExpr,
        nestedInstanceKeyVar => {
          if (!isTemplateFieldNode(node)) {
            this.emitNestedNodes(
              node.properties ?? {},
              emitter,
              nestedInstanceKeyVar,
              iteratorNodeIdExpr,
              itemIndexVar,
              nestedInstanceKeyVar,
            )
          }
        },
      )
    })
  }

  private emitNestedNodes(
    template: TemplateValue,
    emitter: CodeEmitter,
    instanceKeyPrefixVar: string,
    iteratorNodeIdExpr: string,
    itemIndexVar: string,
    parentInstanceKeyExpr: string,
  ): void {
    const directNodes = this.templates.findTemplateNodes(
      template,
      node => isTemplateFieldNode(node) || isTemplateBlockNode(node) || isTemplateIterateNode(node),
      { descendIntoMatches: false },
    )

    directNodes.forEach(node => {
      if (isTemplateIterateNode(node)) {
        this.emitNestedIterator(node, emitter, instanceKeyPrefixVar)

        return
      }

      if (!isTemplateFieldNode(node)) {
        this.emitNestedNodes(
          node.properties ?? {},
          emitter,
          instanceKeyPrefixVar,
          iteratorNodeIdExpr,
          itemIndexVar,
          parentInstanceKeyExpr,
        )

        return
      }

      this.emitMaterialisedNode(
        node,
        emitter,
        instanceKeyPrefixVar,
        iteratorNodeIdExpr,
        itemIndexVar,
        parentInstanceKeyExpr,
      )
    })
  }

  private emitMaterialisedNode(
    node: TemplateNode,
    emitter: CodeEmitter,
    instanceKeyPrefixVar: string,
    iteratorNodeIdExpr: string,
    itemIndexVar: string,
    parentInstanceKeyExpr: string,
    emitNested?: (instanceKeyVar: string) => void,
  ): void {
    emitter.scope(() => {
      const nodeIdLiteral = JSON.stringify(node.id)
      const instanceKeyVar = emitter.const('instanceKey', `${instanceKeyPrefixVar} + "/" + ${nodeIdLiteral}`)

      const scopeStackVar = this.emitScopeStack(emitter)
      const fnsVar = emitter.const('fns', `templateFunctions.get(${nodeIdLiteral})`)

      emitter.code(`nodes.push({
        sourceNodeId: ${nodeIdLiteral},
        instanceKey: ${instanceKeyVar},
        origin: {
          iteratorNodeId: ${iteratorNodeIdExpr},
          itemIndex: ${itemIndexVar},
          parentInstanceKey: ${parentInstanceKeyExpr}
        },
        render: ${fnsVar} && ${fnsVar}.render ? function(ctx, evaluateChild) { return ${fnsVar}.render(ctx, ${scopeStackVar}, evaluateChild); } : undefined,
        validate: ${fnsVar} && ${fnsVar}.validate ? function(ctx, isSub, groups) { return ${fnsVar}.validate(ctx, isSub, groups, ${scopeStackVar}); } : undefined,
        prepare: ${fnsVar} && ${fnsVar}.prepare ? function(ctx) { return ${fnsVar}.prepare(ctx, ${scopeStackVar}); } : undefined
      });`)
      emitNested?.(instanceKeyVar)
    })
  }

  private emitScopeStack(emitter: CodeEmitter): string {
    const frames = this.expr.iteratorStack
    const frameExprs = frames.map(
      frame =>
        `{ item: ${frame.itemVar}, index: ${frame.indexVar}, rawItem: ${frame.rawItemExpr}, inputLength: ${frame.inputLengthExpr} }`,
    )

    frameExprs.reverse()

    return emitter.const('scopeStack', `[${frameExprs.join(', ')}]`)
  }

  private emitNestedIterator(node: TemplateNode, emitter: CodeEmitter, parentInstanceKeyPrefixVar: string): void {
    const yieldTemplate = this.templates.getMapIterateYieldTemplate(node)

    if (yieldTemplate === undefined || !this.containsLeafNode(yieldTemplate)) {
      return
    }

    const nestedIteratorNodeIdLiteral = JSON.stringify(node.id)

    this.templates.compileTemplateMapIterator(node, emitter, (_template, scope) => {
      const nestedInstanceKeyPrefixVar = emitter.const(
        'nestedInstanceKeyPrefix',
        `${parentInstanceKeyPrefixVar} + "/" + ${nestedIteratorNodeIdLiteral} + "[" + ${scope.indexVar} + "]"`,
      )

      this.emitLeafNodes(
        yieldTemplate,
        emitter,
        nestedInstanceKeyPrefixVar,
        nestedIteratorNodeIdLiteral,
        scope.indexVar,
        parentInstanceKeyPrefixVar,
      )
    })
  }

  private containsLeafNode(template: TemplateValue): boolean {
    return this.templates.containsTemplateNode(template, node => isTemplateFieldNode(node) || isTemplateBlockNode(node))
  }
}
