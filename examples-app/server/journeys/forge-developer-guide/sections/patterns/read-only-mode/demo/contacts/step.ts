import { submit, redirect, Condition, Post } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { requireAuth } from '../guards'
import { heading, roleMessage, contactsList, logoutButton } from './blocks'

export const contactsStep = patternStep({
  code: 'contacts',
  path: '/contacts',
  title: 'Contacts',
  reachability: { entryWhen: true },
  onAccess: [requireAuth()],
  blocks: [heading, roleMessage, contactsList, logoutButton],
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
  sourceBase: 'read-only-mode/demo/contacts',
  codeFiles: ['step.ts', 'blocks.ts'],
})
