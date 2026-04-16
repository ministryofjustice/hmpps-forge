import { join } from 'node:path'
import { dataAccess } from '../data'
import FormDataStore from '../data/formDataStore'
import AppointmentApi from '../data/appointmentApi'
import EmbeddingIndex from '../data/embeddings/embeddingIndex'
import GuideContentStore from '../data/guideContentStore'
import GuideSearch from '../data/guideSearch'
import logger from '../logger'

export const services = () => {
  const { applicationInfo } = dataAccess()
  const formDataStore = new FormDataStore()
  const appointmentApi = new AppointmentApi()
  const embeddingIndex = new EmbeddingIndex()
  const guideContentStore = new GuideContentStore(
    join(__dirname, 'journeys', 'forge-developer-guide', 'content'),
  )
  const guideSearch = new GuideSearch(guideContentStore, embeddingIndex)

  guideSearch.load().catch(err => logger.error({ err }, 'Failed to preload guide content'))

  return {
    applicationInfo,
    formDataStore,
    appointmentApi,
    guideContentStore,
    guideSearch,
  }
}

export type Services = ReturnType<typeof services>
