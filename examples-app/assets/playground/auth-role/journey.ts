import { journey, createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { overviewStep } from './overview'
import { loginStep } from './login'
import { dashboardStep } from './dashboard'
import { adminPanelStep } from './admin-panel'

export const authRoleDemoJourney = journey({
  code: 'auth-role-demo',
  title: 'Require authentication / role',
  path: '/auth-role',
  steps: [overviewStep, loginStep, dashboardStep, adminPanelStep],
})

export default createForgePackage({ journey: authRoleDemoJourney })
