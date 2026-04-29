import { submit, redirect, Condition, Post } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { requireAuth } from '../guards'
import { heading, welcomeMessage, viewerWarning, adminLink, logoutButton } from './blocks'

export const dashboardStep = patternStep({
  code: 'dashboard',
  path: '/dashboard',
  title: 'Dashboard',
  reachability: { entryWhen: true },
  onAccess: [requireAuth()],
  blocks: [heading, welcomeMessage, viewerWarning, adminLink, logoutButton],
  onSubmission: [
    submit({
      when: Post('action').match(Condition.Equals('logout')),
      validate: false,
      onAlways: {
        effects: [PatternEffects.SimulateLogout()],
        next: [redirect({ goto: 'login' })],
      },
    }),
  ],
  sourceBase: 'auth-role/demo/dashboard',
  codeFiles: ['step.ts', 'blocks.ts'],
})
