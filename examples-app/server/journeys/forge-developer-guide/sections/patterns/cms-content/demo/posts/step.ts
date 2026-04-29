import { access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { heading, postCount, writeButton, postsList, emptyState } from './blocks'

export const postsStep = patternStep({
  code: 'posts',
  path: '/posts',
  title: 'Blog posts',
  reachability: { entryWhen: true },
  onAccess: [
    access({
      effects: [PatternEffects.LoadBlogPosts()],
    }),
  ],
  blocks: [heading, postCount, writeButton, postsList, emptyState],
  sourceBase: 'cms-content/demo/posts',
  codeFiles: ['step.ts', 'blocks.ts'],
})
