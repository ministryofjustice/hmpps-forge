import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PlaygroundInitializer } from './initializer.mjs'

describe('PlaygroundInitializer', () => {
  let initializer
  let config

  beforeEach(() => {
    initializer = new PlaygroundInitializer({})
    config = { title: 'Example', base: '/assets/playground/branching/', entry: 'journey.ts', start: '/start', files: ['journey.ts'] }
    vi.restoreAllMocks()
  })

  it('should skip editor loading when the page has no configuration blocks', () => {
    // Arrange
    initializer = new PlaygroundInitializer({ querySelectorAll: () => [] })
    const loadEditor = vi.spyOn(initializer, 'loadEditor')

    // Act
    initializer.start()

    // Assert
    expect(loadEditor).not.toHaveBeenCalled()
  })

  it('should initialize each block once when discovery runs again', () => {
    // Arrange
    const scripts = [{ dataset: {} }, { dataset: {} }]
    initializer = new PlaygroundInitializer({ querySelectorAll: () => scripts })
    const mount = vi.spyOn(initializer, 'mount').mockResolvedValue(undefined)

    // Act
    initializer.start()
    initializer.start()

    // Assert
    expect(mount).toHaveBeenCalledTimes(2)
    expect(mount).toHaveBeenCalledWith(scripts[0])
    expect(mount).toHaveBeenCalledWith(scripts[1])
  })

  it('should fetch source text when configuration lists files', async () => {
    // Arrange
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, text: async () => 'source text' })

    // Act
    const files = await initializer.loadFiles(config)

    // Assert
    expect(fetch).toHaveBeenCalledWith('/assets/playground/branching/journey.ts')
    expect(files).toEqual({ 'journey.ts': 'source text' })
  })

  it('should identify the missing file when a request fails', async () => {
    // Arrange
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false })

    // Act
    const result = initializer.loadFiles(config)

    // Assert
    await expect(result).rejects.toThrow('journey.ts')
  })

  it.each(['https://example.com/', '/assets/playground/../'])('should reject the base when it leaves example assets: %s', base => {
    // Arrange
    config.base = base

    // Act
    const validate = () => initializer.validate(config)

    // Assert
    expect(validate).toThrow('Invalid playground configuration')
  })
})
