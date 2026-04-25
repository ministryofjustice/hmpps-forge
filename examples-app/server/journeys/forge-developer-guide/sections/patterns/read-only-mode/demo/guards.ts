import { access, redirect, Condition, Session } from '@ministryofjustice/hmpps-forge/core/authoring'

export const requireAuth = () =>
  access({
    next: [
      redirect({
        when: Session('demoUser').not.match(Condition.IsRequired()),
        goto: 'login',
      }),
    ],
  })
