import { access, submit, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { requireAuth } from '../guards'
import {
  heading,
  roleMessage,
  viewerNotice,
  summaryList,
  editHeading,
  nameField,
  emailField,
  departmentField,
  saveButton,
  backButton,
} from './blocks'

const fieldCodes = ['recordName', 'recordEmail', 'recordDepartment']

export const recordStep = patternStep({
  code: 'record',
  path: '/record/:index',
  title: 'Contact record',
  reachability: { entryWhen: true },
  onAccess: [
    requireAuth(),
    access({
      effects: [PatternEffects.LoadItemForEdit('read-only-mode', 'contacts', fieldCodes)],
    }),
  ],
  blocks: [
    heading,
    roleMessage,
    viewerNotice,
    summaryList,
    editHeading,
    nameField,
    emailField,
    departmentField,
    saveButton,
    backButton,
  ],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [
          PatternEffects.EditItemInCollection('read-only-mode', 'contacts', fieldCodes),
          PatternEffects.SaveDraftAnswers('read-only-mode'),
        ],
        next: [redirect({ goto: '../contacts' })],
      },
    }),
  ],
  sourceBase: 'read-only-mode/demo/record',
  codeFiles: ['step.ts', 'blocks.ts'],
})
