import type { WorkHandler, WorkTask } from '../../contracts/work/work.type'
import { createWorkTask } from '../../work/workTask'

export interface CompilationPipelineWorkProps {
  readonly phases: readonly WorkTask[]
}

/**
 * The whole compilation as one work handler. `begin` runs the ordered phases as a
 * single sequential group - each phase assumes the previous one's recordings on the
 * shared `CompilationState`, so a phase that throws stops the pipeline with its span
 * left incomplete. There is no `complete` fold: phases record onto the state, and
 * the pipeline assembles the package from it afterwards.
 */
export const COMPILATION_PIPELINE_WORK_HANDLER: WorkHandler<'compilation.pipeline', CompilationPipelineWorkProps> = {
  kind: 'compilation.pipeline',

  begin(ctx) {
    return {
      groups: [
        {
          mode: 'sequential',
          children: [...ctx.props.phases],
        },
      ],
    }
  },
}

export function createCompilationPipelineTask(props: CompilationPipelineWorkProps) {
  return createWorkTask('compilation', COMPILATION_PIPELINE_WORK_HANDLER, props)
}
