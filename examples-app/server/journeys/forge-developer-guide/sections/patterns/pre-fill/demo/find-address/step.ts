import {
  submit,
  action,
  redirect,
  Post,
  Condition,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import {
  heading,
  postcodeField,
  findAddressButton,
  addressLine1Field,
  addressLine2Field,
  addressTownField,
  addressCountyField,
  addressPostcodeField,
  buttonGroup,
} from './blocks'

export const findAddressStep = patternStep({
  code: 'find-address',
  path: '/find-address',
  title: 'Find an address',
  reachability: { entryWhen: true },
  blocks: [
    heading,
    postcodeField,
    findAddressButton,
    addressLine1Field,
    addressLine2Field,
    addressTownField,
    addressCountyField,
    addressPostcodeField,
    buttonGroup,
  ],
  onAction: [
    action({
      when: Post('action').match(Condition.Equals('find-address')),
      effects: [PatternEffects.LookupAddress()],
    }),
  ],
  onSubmission: [
    submit({
      when: Post('action').match(Condition.Equals('continue')),
      validate: true,
      onValid: {
        effects: [PatternEffects.SaveDraftAnswers('pre-fill')],
        next: [redirect({ goto: 'check-answers' })],
      },
    }),
  ],
  sourceBase: 'pre-fill/demo/find-address',
  codeFiles: [
    'step.ts',
    'blocks.ts',
    {
      path: '/effects.ts',
      lines: [
        [65, 66],
        [292, 306],
      ],
    },
  ],
})
