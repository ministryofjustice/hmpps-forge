import { submit, redirect, Condition, Post } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { heading, intro, adminButton, viewerButton } from './blocks'

const seedContacts = PatternEffects.SeedDraftAnswers('read-only-mode', {
  contacts: [
    {
      recordName: 'Jane Smith',
      recordEmail: 'jane.smith@example.com',
      recordDepartment: 'Digital Services',
    },
    { recordName: 'John Doe', recordEmail: 'john.doe@example.com', recordDepartment: 'Policy' },
    {
      recordName: 'Sarah Wilson',
      recordEmail: 'sarah.wilson@example.com',
      recordDepartment: 'Operations',
    },
  ],
})

export const loginStep = patternStep({
  code: 'login',
  path: '/login',
  title: 'Log in',
  reachability: { entryWhen: true },
  blocks: [heading, intro, adminButton, viewerButton],
  onSubmission: [
    submit({
      when: Post('action').match(Condition.Equals('login-admin')),
      validate: false,
      onAlways: {
        effects: [PatternEffects.SimulateLogin('Demo Admin', 'admin'), seedContacts],
        next: [redirect({ goto: 'contacts' })],
      },
    }),
    submit({
      when: Post('action').match(Condition.Equals('login-viewer')),
      validate: false,
      onAlways: {
        effects: [PatternEffects.SimulateLogin('Demo Viewer', 'viewer'), seedContacts],
        next: [redirect({ goto: 'contacts' })],
      },
    }),
  ],
  sourceBase: 'read-only-mode/demo/login',
  codeFiles: ['step.ts', 'blocks.ts'],
})
