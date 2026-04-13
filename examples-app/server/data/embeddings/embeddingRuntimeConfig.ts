const localModelPath = '/opt/models'

export interface TransformersRuntimeEnvironment {
  allowRemoteModels?: boolean
  localModelPath?: string
}

export function configureTransformersLocalModelSource(env: TransformersRuntimeEnvironment): void {
  const runtimeEnvironment = env

  runtimeEnvironment.localModelPath = localModelPath
  runtimeEnvironment.allowRemoteModels = false
}
