import { StepRuntimePlan } from '../../compilation/RuntimePlanBuilder'
import ThunkEvaluationContext from '../../compilation/thunks/ThunkEvaluationContext'
import { ThunkInvocationAdapter } from '../../compilation/thunks/types'
import { ASTNodeType } from '../../types/enums'
import { JourneyMetadata, RenderContext } from '../../../framework/rendering/types'
import MetadataExecutor from '../evaluation/MetadataExecutor'
import RenderExecutor from '../evaluation/RenderExecutor'
import RuntimeArtifacts from '../RuntimeArtifacts'
import ResolvedStepMetadataBuilder from './ResolvedStepMetadataBuilder'
import RenderContextFactory from './RenderContextFactory'

export interface RenderProjectorOptions {
  showValidationFailures?: boolean
}

/**
 * Evaluates render data (metadata + blocks) and assembles the final RenderContext.
 *
 * Owns the full render pipeline: evaluation → enrichment → assembly.
 * The controller calls build() and passes the result to the framework adapter.
 */
export default class RenderProjector<TRequest> {
  private readonly metadataExecutor = new MetadataExecutor()

  private readonly renderExecutor = new RenderExecutor()

  private readonly resolvedStepMetadataBuilder: ResolvedStepMetadataBuilder<TRequest>

  constructor(
    getBaseUrl: (req: TRequest) => string,
    private readonly navigationMetadata: JourneyMetadata[],
    private readonly currentStepPath: string,
  ) {
    this.resolvedStepMetadataBuilder = new ResolvedStepMetadataBuilder(getBaseUrl)
  }

  async build(
    plan: StepRuntimePlan,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
    artifacts: RuntimeArtifacts,
    req: TRequest,
    options?: RenderProjectorOptions,
  ): Promise<RenderContext> {
    const [metadata, blocks] = await Promise.all([
      this.metadataExecutor.execute(plan, invoker, context),
      this.renderExecutor.execute(plan, invoker, context),
    ])

    const validation = artifacts.getStepValidity()
    const step = this.resolvedStepMetadataBuilder.build(metadata.step, req, artifacts)

    return RenderContextFactory.build(
      {
        step,
        ancestors: metadata.ancestors,
        blocks,
        answers: context.global.answers,
        data: context.global.data,
        fieldValidationFailures: validation?.fieldFailures ?? [],
        domainValidationFailures: validation?.domainFailures ?? [],
        hasNestedBlocks: blockId => {
          if (context.astNodeTree.getNodeType(blockId) === undefined) {
            return true
          }

          return context.astNodeTree.hasDescendantOfType(blockId, ASTNodeType.BLOCK)
        },
      },
      {
        navigationMetadata: this.navigationMetadata,
        currentStepPath: this.currentStepPath,
        showValidationFailures: options?.showValidationFailures,
      },
    )
  }
}
