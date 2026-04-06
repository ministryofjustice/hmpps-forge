import { RenderContext } from '../../../framework/rendering/types'
import BacklinkResolver from '../resolution/BacklinkResolver'
import RuntimeArtifacts from '../RuntimeArtifacts'

export default class ResolvedStepMetadataBuilder<TRequest> {
  private readonly backlinkResolver = new BacklinkResolver()

  constructor(private readonly getBaseUrl: (req: TRequest) => string) {}

  build(step: RenderContext['step'], req: TRequest, artifacts: RuntimeArtifacts): RenderContext['step'] {
    if (step.backlink !== undefined) {
      return step
    }

    const backPath = this.backlinkResolver.resolve(artifacts.requireNavigation())

    if (!backPath) {
      return step
    }

    return {
      ...step,
      backlink: this.resolveJourneyRelativePath(req, backPath),
    }
  }

  private resolveJourneyRelativePath(req: TRequest, relativePath: string): string {
    const baseUrl = this.getBaseUrl(req)

    return `${baseUrl}/${relativePath}`
  }
}
