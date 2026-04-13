import { join } from 'node:path'
import { dataAccess } from '../data'
import FormDataStore from '../data/formDataStore'
import AppointmentApi from '../data/appointmentApi'
import EmbeddingIndex from '../data/embeddings/embeddingIndex'
import GuideContentStore from '../data/guideContentStore'
import logger from '../logger'

export const services = () => {
  const { applicationInfo } = dataAccess()
  const formDataStore = new FormDataStore()
  const appointmentApi = new AppointmentApi()
  const embeddingIndex = new EmbeddingIndex()
  const guideContentStore = new GuideContentStore(
    join(__dirname, 'journeys', 'forge-developer-guide', 'content'),
    embeddingIndex,
  )

  guideContentStore.load().catch(err => logger.error({ err }, 'Failed to preload guide content'))

  return {
    applicationInfo,
    formDataStore,
    appointmentApi,
    guideContentStore,
  }
}

export type Services = ReturnType<typeof services>
