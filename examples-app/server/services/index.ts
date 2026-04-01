import { dataAccess } from '../data'

export const services = () => {
  const { applicationInfo } = dataAccess()

  return {
    applicationInfo,
  }
}

export type Services = ReturnType<typeof services>
