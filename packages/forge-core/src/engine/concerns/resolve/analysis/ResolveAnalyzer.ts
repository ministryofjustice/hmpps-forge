import { BlockType, IteratorType } from '../../../../authoring/types/enums'
import type { ASTNode } from '../../../chassis/contracts/ast/ast.type'
import { ASTNodeType } from '../../../chassis/contracts/ast/enums'
import { isTemplateNode } from '../../../chassis/contracts/ast/nodes'
import type { BlockASTNode, JourneyASTNode } from '../../../chassis/contracts/ast/structures.type'
import type { TemplateNode, TemplateValue } from '../../../chassis/contracts/ast/template.type'
import { AuthoredValueKind, type AuthoredValue } from '../../../chassis/contracts/models/authoredValue.type'
import type {
  StepAnalysisContext,
  StepModelAnalyzer,
} from '../../../chassis/compilation/analysis/concernAnalyzers.type'
import type {
  ResolveAncestorModel,
  ResolveBlockModel,
  ResolveModel,
  ResolvePropertyModel,
  StandaloneIterateModel,
} from '../contracts/resolveModel.type'

/**
 * Builds the analysis model for the resolve concern (the stage that prepares
 * data for rendering). Decides which authored properties are render-facing,
 * how ancestor journey paths compose, which blocks the step renders, and which
 * MAP iterators stand alone as block producers rather than property values.
 * All decisions happen here so `StepResolveCompiler` only turns model fields
 * into generated code.
 */
export default class ResolveAnalyzer implements StepModelAnalyzer<ResolveModel> {
  /** Properties owned by other concerns (validation, hooks, etc.) — excluded from the render context. */
  private static readonly BLOCK_SKIP_PROPS = new Set(['formatters', 'parsers', 'validWhen', 'dependentWhen'])

  private static readonly STEP_SKIP_PROPS = new Set(['onAccess', 'onSubmission', 'blocks', 'reachability'])

  private static readonly JOURNEY_SKIP_PROPS = new Set(['onAccess', 'children', 'steps', 'reachability'])

  analyzeStep(context: StepAnalysisContext): ResolveModel {
    const step = this.classifyProperties(
      context,
      context.stepNode.properties as Record<string, unknown>,
      ResolveAnalyzer.STEP_SKIP_PROPS,
    )
    const ancestors = this.buildAncestors(context)
    const blocks = (context.stepNode.properties.blocks ?? []).map(block => this.buildRegisteredBlock(context, block))
    const inlineIterateIds = this.collectInlineIterateIds(step, ancestors, blocks)

    return {
      label: context.labels.labelFrom([context.stepNode]),
      step,
      ancestors,
      blocks,
      standaloneIterateBlocks: this.buildStandaloneIterateBlocks(context, inlineIterateIds),
    }
  }

  private buildAncestors(context: StepAnalysisContext): ResolveAncestorModel[] {
    const ancestorNodes = context.ancestry.ancestorsOfType(context.stepNode, isJourneyNode)
    let runningPath: string | undefined = ''

    return ancestorNodes.map(ancestorNode => {
      const properties = this.classifyProperties(
        context,
        ancestorNode.properties as Record<string, unknown>,
        ResolveAnalyzer.JOURNEY_SKIP_PROPS,
      )
      const ownPath = (ancestorNode.properties as Record<string, unknown>).path

      // One dynamic segment poisons the rest of the chain: the generated code
      // then composes every ancestor's path at request time, exactly as before.
      runningPath =
        runningPath !== undefined && typeof ownPath === 'string' ? composePath(runningPath, ownPath) : undefined

      return { properties, composedPath: runningPath }
    })
  }

  private buildRegisteredBlock(context: StepAnalysisContext, block: BlockASTNode): ResolveBlockModel {
    const rawProperties = block.properties as Record<string, unknown>

    return {
      source: block,
      id: block.id,
      variant: block.variant,
      blockType: block.blockType,
      label: this.deriveBlockLabel(block),
      properties: this.classifyProperties(context, rawProperties, ResolveAnalyzer.BLOCK_SKIP_PROPS),
      resolvesFieldValue: block.blockType === BlockType.FIELD && rawProperties.value === undefined,
    }
  }

  private buildTemplateBlock(context: StepAnalysisContext, block: TemplateNode): ResolveBlockModel {
    const rawProperties = (block.properties ?? {}) as Record<string, unknown>
    const blockType = String(block.blockType)

    return {
      source: block,
      id: undefined,
      variant: String(block.variant),
      blockType,
      label: String(block.variant),
      properties: this.classifyProperties(context, rawProperties, ResolveAnalyzer.BLOCK_SKIP_PROPS),
      resolvesFieldValue: blockType === BlockType.FIELD && rawProperties.value === undefined,
    }
  }

  private buildStandaloneIterateBlocks(
    context: StepAnalysisContext,
    inlineIterateIds: ReadonlySet<string>,
  ): StandaloneIterateModel[] {
    return (
      context.ownership
        .allIterateNodesOf(context.stepNode.id)
        .filter(iterateNode => !inlineIterateIds.has(iterateNode.id))
        .filter(iterateNode => iterateNode.properties.iterator.type === IteratorType.MAP)
        .flatMap(iterateNode => {
          const template = iterateNode.properties.iterator.yieldTemplate

          if (template === undefined) {
            return []
          }

          const templateBlocks = this.findTemplateBlocks(template)

          if (templateBlocks.length === 0) {
            return []
          }

          return [
            {
              node: iterateNode,
              templateBlocks: templateBlocks.map(templateBlock => this.buildTemplateBlock(context, templateBlock)),
            },
          ]
        })
    )
  }

  /**
   * Classifies authored properties (the raw values journey authors write) into
   * ordered render-facing entries. Drops the skipped properties (those owned by
   * other concerns) and recursively removes them from nested block values too.
   */
  private classifyProperties(
    context: StepAnalysisContext,
    properties: Record<string, unknown>,
    skipProps: ReadonlySet<string>,
  ): ResolvePropertyModel[] {
    return Object.entries(properties)
      .filter(([key]) => !skipProps.has(key))
      .map(([key, value]) => ({ key, value: this.pruneNestedBlockProps(context.classifier.classify(value)) }))
  }

  /** Recursively strips block-level skip properties from nested `BlockValue` branches. */
  private pruneNestedBlockProps(value: AuthoredValue): AuthoredValue {
    switch (value.kind) {
      case AuthoredValueKind.BLOCK:
        return {
          ...value,
          entries: value.entries
            .filter(entry => !ResolveAnalyzer.BLOCK_SKIP_PROPS.has(entry.key))
            .map(entry => ({ key: entry.key, value: this.pruneNestedBlockProps(entry.value) })),
        }
      case AuthoredValueKind.RECORD:
        return {
          ...value,
          entries: value.entries.map(entry => ({ key: entry.key, value: this.pruneNestedBlockProps(entry.value) })),
        }
      case AuthoredValueKind.LIST:
        return { ...value, items: value.items.map(item => this.pruneNestedBlockProps(item)) }
      case AuthoredValueKind.CONDITIONAL:
        return {
          ...value,
          predicate: this.pruneNestedBlockProps(value.predicate),
          thenValue: this.pruneNestedBlockProps(value.thenValue),
          elseValue: this.pruneNestedBlockProps(value.elseValue),
        }
      case AuthoredValueKind.MATCH:
        return {
          ...value,
          branches: value.branches.map(branch => ({
            predicate: this.pruneNestedBlockProps(branch.predicate),
            value: this.pruneNestedBlockProps(branch.value),
          })),
          otherwise: value.otherwise === undefined ? undefined : this.pruneNestedBlockProps(value.otherwise),
        }
      case AuthoredValueKind.ITERATION:
        return {
          ...value,
          input: this.pruneNestedBlockProps(value.input),
          yieldTemplate:
            value.yieldTemplate === undefined ? undefined : this.pruneNestedBlockProps(value.yieldTemplate),
          predicate: value.predicate === undefined ? undefined : this.pruneNestedBlockProps(value.predicate),
        }
      default:
        return value
    }
  }

  /**
   * Iterators that appear inside a property value are "inline" — their loops
   * are generated at the point the property is evaluated, so they must not
   * also appear as standalone block producers.
   */
  private collectInlineIterateIds(
    step: readonly ResolvePropertyModel[],
    ancestors: readonly ResolveAncestorModel[],
    blocks: readonly ResolveBlockModel[],
  ): Set<string> {
    const inlineIterateIds = new Set<string>()
    const collectFrom = (properties: readonly ResolvePropertyModel[]) => {
      properties.forEach(property => this.collectIterationIds(property.value, inlineIterateIds))
    }

    collectFrom(step)
    ancestors.forEach(ancestor => collectFrom(ancestor.properties))
    blocks.forEach(block => collectFrom(block.properties))

    return inlineIterateIds
  }

  private collectIterationIds(value: AuthoredValue, ids: Set<string>): void {
    switch (value.kind) {
      case AuthoredValueKind.ITERATION:
        ids.add(String((value.source as { id?: unknown }).id))
        this.collectIterationIds(value.input, ids)

        if (value.yieldTemplate !== undefined) {
          this.collectIterationIds(value.yieldTemplate, ids)
        }

        if (value.predicate !== undefined) {
          this.collectIterationIds(value.predicate, ids)
        }

        return
      case AuthoredValueKind.CONDITIONAL:
        this.collectIterationIds(value.predicate, ids)
        this.collectIterationIds(value.thenValue, ids)
        this.collectIterationIds(value.elseValue, ids)

        return
      case AuthoredValueKind.MATCH:
        value.branches.forEach(branch => {
          this.collectIterationIds(branch.predicate, ids)
          this.collectIterationIds(branch.value, ids)
        })

        if (value.otherwise !== undefined) {
          this.collectIterationIds(value.otherwise, ids)
        }

        return
      case AuthoredValueKind.RECORD:
      case AuthoredValueKind.BLOCK:
        value.entries.forEach(entry => this.collectIterationIds(entry.value, ids))

        return
      case AuthoredValueKind.LIST:
        value.items.forEach(item => this.collectIterationIds(item, ids))

        break
      default:
        break
    }
  }

  /** Finds block nodes inside a standalone iterator's yield template, collecting only the outermost matches. */
  private findTemplateBlocks(template: TemplateValue): TemplateNode[] {
    const results: TemplateNode[] = []

    this.walkTemplateForBlocks(template, results)

    return results
  }

  private walkTemplateForBlocks(value: TemplateValue, results: TemplateNode[]): void {
    if (value === null || value === undefined || typeof value !== 'object') {
      return
    }

    if (isTemplateNode(value)) {
      if (value.originalType === ASTNodeType.BLOCK) {
        results.push(value)

        return
      }

      Object.values(value.properties ?? {}).forEach(child => {
        this.walkTemplateForBlocks(child as TemplateValue, results)
      })

      return
    }

    if (Array.isArray(value)) {
      value.forEach(item => {
        this.walkTemplateForBlocks(item, results)
      })

      return
    }

    Object.values(value).forEach(item => {
      this.walkTemplateForBlocks(item as TemplateValue, results)
    })
  }

  private deriveBlockLabel(block: BlockASTNode): string {
    const pathTail = block.diagnostics?.source.formattedPath.split(' > ').at(-1)

    return pathTail?.replace(/ \(.*\)$/, '') ?? String(block.id)
  }
}

function isJourneyNode(node: ASTNode): node is JourneyASTNode {
  return node.type === ASTNodeType.JOURNEY
}

function composePath(runningPath: string, ownPath: string): string {
  return `/${`${runningPath}/${ownPath}`.split('/').filter(Boolean).join('/')}`
}
