import { RenderContext } from '../../../framework/rendering/types'
import { resolvePathParams } from '../../../framework/path/routePath'
import { StepRequest } from '../../../framework/types/request.type'
import BacklinkResolver from '../resolution/BacklinkResolver'
import RuntimeArtifacts from '../RuntimeArtifacts'

export default class ResolvedStepMetadataBuilder {
  private readonly backlinkResolver = new BacklinkResolver()

  build(step: RenderContext['step'], req: StepRequest, artifacts: RuntimeArtifacts): RenderContext['step'] {
    if (step.backlink !== undefined) {
      return step
    }

    const backPath = this.backlinkResolver.resolve(artifacts.requireNavigation())

    if (!backPath) {
      return step
    }

    return {
      ...step,
      backlink: resolvePathParams(backPath, req.getParams()),
    }
  }
}
