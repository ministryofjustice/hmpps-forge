import { NodeId } from '../../../types/engine.type'
import { BlockASTNode } from '../../../types/structures.type'
import {
  ThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  MetadataComputationDependencies,
} from '../../../compilation/thunks/types'
import ThunkEvaluationContext from '../../../compilation/thunks/ThunkEvaluationContext'
import { evaluatePropertyValue } from '../../../utils/thunkEvaluatorsAsync'
import { evaluatePropertyValueSync } from '../../../utils/thunkEvaluatorsSync'

/**
 * Handler for Block structure nodes (both field and basic blocks)
 *
 * Evaluates block properties for rendering/data use.
 * Validation properties are skipped because validation runs via ValidationExecutor.
 * dependentWhen properties are skipped because answer processing and validation own that logic.
 * Formatters are also skipped here because they are applied during submission.
 *
 * Synchronous when all nested AST nodes in properties are sync.
 * Asynchronous when any nested AST node is async.
 */
export default class BlockHandler implements ThunkHandler {
  isAsync = false

  private propertiesWithNodes: ReadonlySet<string> | undefined

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: BlockASTNode,
  ) {}

  private static readonly SKIP_PROPS = new Set(['formatters', 'validWhen', 'dependentWhen'])

  computeIsAsync(deps: MetadataComputationDependencies): void {
    const propertiesWithNodes = new Set<string>()
    let hasAsync = false

    deps.astNodeTree.getChildren(this.nodeId).forEach(childId => {
      const property = deps.metadataRegistry.get<string>(childId, 'attachedToParentProperty')

      if (!property) {
        return
      }

      propertiesWithNodes.add(property)

      if (hasAsync || BlockHandler.SKIP_PROPS.has(property)) {
        return
      }

      const handler = deps.thunkHandlerRegistry.get(childId)

      if (handler?.isAsync ?? true) {
        hasAsync = true
      }
    })

    this.isAsync = hasAsync
    this.propertiesWithNodes = propertiesWithNodes
  }

  evaluateSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): HandlerResult {
    const propertiesToEvaluate = this.getPropertiesToEvaluate()
    const evaluatedProperties = this.evaluateBlockPropertiesSync(propertiesToEvaluate, context, invoker)

    return {
      value: {
        id: this.nodeId,
        type: this.node.type,
        variant: this.node.variant,
        blockType: this.node.blockType,
        properties: evaluatedProperties,
      },
    }
  }

  async evaluate(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): Promise<HandlerResult> {
    const propertiesToEvaluate = this.getPropertiesToEvaluate()
    const evaluatedProperties = await this.evaluateBlockProperties(propertiesToEvaluate, context, invoker)

    return {
      value: {
        id: this.nodeId,
        type: this.node.type,
        variant: this.node.variant,
        blockType: this.node.blockType,
        properties: evaluatedProperties,
      },
    }
  }

  private getPropertiesToEvaluate(): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(this.node.properties).filter(([key]) => key !== 'validWhen' && key !== 'dependentWhen'),
    )
  }

  private evaluateBlockPropertiesSync(
    properties: Record<string, unknown>,
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    Object.entries(properties).forEach(([key, value]) => {
      if (key === 'formatters' || (this.propertiesWithNodes && !this.propertiesWithNodes.has(key))) {
        result[key] = value
        return
      }

      result[key] = evaluatePropertyValueSync(value, context, invoker)
    })

    return result
  }

  /**
   * Evaluate block properties for render/data use.
   */
  private async evaluateBlockProperties(
    properties: Record<string, unknown>,
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {}

    await Promise.all(
      Object.entries(properties).map(async ([key, value]) => {
        if (key === 'formatters' || (this.propertiesWithNodes && !this.propertiesWithNodes.has(key))) {
          result[key] = value
          return
        }

        result[key] = await evaluatePropertyValue(value, context, invoker)
      }),
    )

    return result
  }
}
