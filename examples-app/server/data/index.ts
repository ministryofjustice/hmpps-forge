import applicationInfoSupplier from '../applicationInfo'

const applicationInfo = applicationInfoSupplier()

export const dataAccess = () => {
  return {
    applicationInfo,
  }
}

export type DataAccess = ReturnType<typeof dataAccess>
