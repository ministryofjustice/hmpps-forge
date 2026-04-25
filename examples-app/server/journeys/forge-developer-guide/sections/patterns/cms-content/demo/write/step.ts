import { submit, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { heading, titleInput, bodyEditor, publishButton } from './blocks'

export const writeStep = patternStep({
  code: 'write',
  path: '/write',
  title: 'Write a post',
  reachability: { entryWhen: true },
  blocks: [heading, titleInput, bodyEditor, publishButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [PatternEffects.SaveBlogPost()],
        next: [redirect({ goto: 'posts' })],
      },
    }),
  ],
  sourceBase: 'cms-content/demo/write',
  codeFiles: ['step.ts', 'blocks.ts'],
})
