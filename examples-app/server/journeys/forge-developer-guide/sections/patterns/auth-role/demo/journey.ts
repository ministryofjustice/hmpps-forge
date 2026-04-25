import { journey } from '@ministryofjustice/hmpps-forge/core/authoring'
import { overviewStep } from './overview/step'
import { loginStep } from './login/step'
import { dashboardStep } from './dashboard/step'
import { adminPanelStep } from './admin-panel/step'

export const authRoleDemoJourney = journey({
  code: 'auth-role-demo',
  title: 'Require authentication / role',
  path: '/auth-role',
  steps: [overviewStep, loginStep, dashboardStep, adminPanelStep],
})
