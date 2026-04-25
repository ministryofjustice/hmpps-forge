import { submit, redirect, Condition, Post } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { heading, intro, adminButton, viewerButton } from './blocks'

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
        effects: [PatternEffects.SimulateLogin('Demo Admin', 'admin')],
        next: [redirect({ goto: 'dashboard' })],
      },
    }),
    submit({
      when: Post('action').match(Condition.Equals('login-viewer')),
      validate: false,
      onAlways: {
        effects: [PatternEffects.SimulateLogin('Demo Viewer', 'viewer')],
        next: [redirect({ goto: 'dashboard' })],
      },
    }),
  ],
  sourceBase: 'auth-role/demo/login',
  codeFiles: ['step.ts', 'blocks.ts'],
})
