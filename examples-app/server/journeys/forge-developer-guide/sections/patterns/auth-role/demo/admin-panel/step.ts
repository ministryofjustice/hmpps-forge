import {
  access,
  throwError,
  Condition,
  Session,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { requireAuth } from '../guards'
import { heading, body, backLink } from './blocks'

export const adminPanelStep = patternStep({
  code: 'admin-panel',
  path: '/admin-panel',
  title: 'Admin panel',
  reachability: { entryWhen: true },
  onAccess: [
    requireAuth(),
    access({
      next: [
        throwError({
          when: Session('demoUser.role').not.match(Condition.Equals('admin')),
          status: 403,
          message: 'You do not have permission to access this page',
        }),
      ],
    }),
  ],
  blocks: [heading, body, backLink],
  sourceBase: 'auth-role/demo/admin-panel',
  codeFiles: ['step.ts', 'blocks.ts'],
})
