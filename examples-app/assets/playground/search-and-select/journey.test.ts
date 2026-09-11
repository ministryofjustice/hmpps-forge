import { ForgeTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import patternPackage from './journey'

const stationService = { search: vi.fn(), get: vi.fn() }
const createClient = () => new ForgeTestHarness().registerPackage(patternPackage, { stationService }).createClient()

describe('search-and-select', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    stationService.search.mockResolvedValue([])
  })

  it('should avoid searching the directory when no query exists', async () => {
    // Arrange
    const client = createClient()

    // Act
    const result = await client.get('/search-and-select/search', { session: {} })

    // Assert
    expect(result).toMatchObject({ type: 'render' })
    expect(stationService.search).not.toHaveBeenCalled()
  })

  it('should preserve the submitted query when redirecting to results', async () => {
    // Arrange
    const client = createClient()
    const session = {}

    // Act
    const result = await client.post('/search-and-select/search', { session, body: { searchQuery: 'Brixton' } })
    await client.get('/search-and-select/search', { session })

    // Assert
    expect(result).toMatchObject({ type: 'redirect', url: '/search-and-select/search' })
    expect(session).toMatchObject({ draftAnswers: { searchQuery: 'Brixton' } })
    expect(stationService.search).toHaveBeenCalledWith('Brixton')
  })

  it('should load the selected station when its route index is valid', async () => {
    // Arrange
    const client = createClient()

    stationService.get.mockResolvedValue({ name: 'Brixton', lines: 'Victoria', zone: '2', opened: '1971', description: 'Station description' })

    // Act
    const result = await client.get('/search-and-select/station/4', { session: {} })

    // Assert
    expect(result).toMatchObject({ type: 'render' })
    expect(stationService.get).toHaveBeenCalledWith(4)
  })

  it('should avoid looking up a station when its route index is invalid', async () => {
    // Arrange
    const client = createClient()

    // Act
    await client.get('/search-and-select/station/invalid', { session: {} })

    // Assert
    expect(stationService.get).not.toHaveBeenCalled()
  })

  it('should return an error when the directory request fails', async () => {
    // Arrange
    const client = createClient()
    const session = { draftAnswers: { searchQuery: 'Brixton' } }

    stationService.search.mockRejectedValue(new Error('Directory unavailable'))

    // Act
    const result = await client.get('/search-and-select/search', { session })

    // Assert
    expect(result).toMatchObject({ type: 'error' })
    expect(session.draftAnswers.searchQuery).toBe('Brixton')
  })
})
