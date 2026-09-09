import { join } from 'node:path'
import { dataAccess } from '../data'
import FormDataStore from '../data/formDataStore'
import AppointmentApi from '../data/appointmentApi'
import GuideContentStore from '../data/guideContentStore'
import LlmsTextGenerator from '../data/llmsTextGenerator'
import PatternSourceStore from '../data/patternSourceStore'
import config from '../config'
import MocksApi from '../data/mocksApi'

export const services = () => {
  const { applicationInfo } = dataAccess()
  const formDataStore = new FormDataStore()
  const appointmentApi = new AppointmentApi()
  const guideV2ContentStore = new GuideContentStore(
    join(__dirname, 'journeys', 'forge-guide-v2', 'content'),
  )
  const patternSourceStore = new PatternSourceStore()
  const llmsTextGenerator = new LlmsTextGenerator(patternSourceStore, config.ingressUrl)
  const mocksApi = new MocksApi()

  return {
    applicationInfo,
    formDataStore,
    appointmentApi,
    guideV2ContentStore,
    patternSourceStore,
    llmsTextGenerator,
    mocksApi,
  }
}

export type Services = ReturnType<typeof services>
