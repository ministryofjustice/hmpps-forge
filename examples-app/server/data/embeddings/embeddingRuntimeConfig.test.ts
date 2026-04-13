import {
  configureTransformersLocalModelSource,
  type TransformersRuntimeEnvironment,
} from './embeddingRuntimeConfig'

describe('configureTransformersLocalModelSource()', () => {
  it('should force local-only model loading from the baked Docker path', () => {
    // Arrange
    const env: TransformersRuntimeEnvironment = {}

    // Act
    configureTransformersLocalModelSource(env)

    // Assert
    expect(env).toEqual({
      allowRemoteModels: false,
      localModelPath: '/opt/models',
    })
  })
})
