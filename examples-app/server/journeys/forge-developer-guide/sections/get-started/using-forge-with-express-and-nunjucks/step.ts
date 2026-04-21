import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../../effects'
import { content } from '../blocks/blocks'

export const usingForgeWithExpressAndNunjucksStep = step({
  path: '/using-forge-with-express-and-nunjucks',
  title: 'Using Forge with Express and Nunjucks',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Setup guides' },
  onAccess: [
    access({
      effects: [GuideEffects.LoadContent('using-forge-with-express-and-nunjucks')],
    }),
  ],
  blocks: [content],
})
