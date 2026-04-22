import { join } from 'node:path'
import { dataAccess } from '../data'
import FormDataStore from '../data/formDataStore'
import AppointmentApi from '../data/appointmentApi'
import EmbeddingIndex from '../data/embeddings/embeddingIndex'
import GuideContentStore from '../data/guideContentStore'
import GuideSearch from '../data/guideSearch'
import PatternSourceStore from '../data/patternSourceStore'
import MocksApi from '../data/mocksApi'
import logger from '../logger'

export const services = () => {
  const { applicationInfo } = dataAccess()
  const formDataStore = new FormDataStore()
  const appointmentApi = new AppointmentApi()
  const embeddingIndex = new EmbeddingIndex()
  const guideContentStore = new GuideContentStore(
    join(__dirname, 'journeys', 'forge-developer-guide', 'content'),
  )
  const patternSourceStore = new PatternSourceStore()
  const mocksApi = new MocksApi()
  const guideSearch = new GuideSearch(guideContentStore, embeddingIndex)

  guideSearch.load().catch(err => logger.error({ err }, 'Failed to preload guide content'))

  return {
    applicationInfo,
    formDataStore,
    appointmentApi,
    guideContentStore,
    guideSearch,
    patternSourceStore,
    mocksApi,
  }
}

export type Services = ReturnType<typeof services>
