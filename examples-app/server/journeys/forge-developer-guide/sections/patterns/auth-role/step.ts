import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { loadContent } from '../../../effects'
import { content } from '../blocks/blocks'

export const authRolePatternStep = step({
  path: '/auth-role',
  title: 'Require authentication / role',
  reachability: { entryWhen: true },
  metadata: { navGroup: 'Access and permissions' },
  onAccess: [loadContent('patterns-auth-role')],
  blocks: [content],
})
