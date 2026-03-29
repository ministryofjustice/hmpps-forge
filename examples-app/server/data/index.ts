import config from '../config'
import HmppsAuditClient from './hmppsAuditClient'
import applicationInfoSupplier from '../applicationInfo'

const applicationInfo = applicationInfoSupplier()

export const dataAccess = () => {
  return {
    applicationInfo,
    hmppsAuditClient: new HmppsAuditClient(config.sqs.audit),
  }
}

export type DataAccess = ReturnType<typeof dataAccess>

export { HmppsAuditClient }
