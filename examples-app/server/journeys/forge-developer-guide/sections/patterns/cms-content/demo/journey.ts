import { journey, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { PatternEffects } from '../../effects'
import { overviewStep } from './overview/step'
import { writeStep } from './write/step'
import { postsStep } from './posts/step'

export const cmsContentDemoJourney = journey({
  code: 'cms-content-demo',
  title: 'CMS content',
  path: '/cms-content',
  onAccess: [
    access({
      effects: [PatternEffects.LoadBlogPosts()],
    }),
  ],
  steps: [overviewStep, writeStep, postsStep],
})
