import { dataAccess } from '../data'
import FormDataStore from '../data/formDataStore'
import AppointmentApi from '../data/appointmentApi'

export const services = () => {
  const { applicationInfo } = dataAccess()
  const formDataStore = new FormDataStore()
  const appointmentApi = new AppointmentApi()

  return {
    applicationInfo,
    formDataStore,
    appointmentApi,
  }
}

export type Services = ReturnType<typeof services>
