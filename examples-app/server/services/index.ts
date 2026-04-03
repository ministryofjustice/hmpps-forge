import { dataAccess } from '../data'
import FormDataStore from '../data/formDataStore'

export const services = () => {
  const { applicationInfo } = dataAccess()
  const formDataStore = new FormDataStore()

  return {
    applicationInfo,
    formDataStore,
  }
}

export type Services = ReturnType<typeof services>
