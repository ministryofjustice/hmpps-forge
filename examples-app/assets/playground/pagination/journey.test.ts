import { ForgeTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'
import { describe, expect, it } from 'vitest'
import patternPackage from './journey'

const createClient = () => new ForgeTestHarness().registerPackage(patternPackage).createClient()

describe('paginationDemoJourney', () => {
  it.each([
    { query: undefined, page: 1, firstStation: 'Baker Street', firstIndex: 0 },
    { query: '2', page: 2, firstStation: 'Canary Wharf', firstIndex: 5 },
    { query: '4', page: 4, firstStation: 'Kennington', firstIndex: 15 },
    { query: '-1', page: 1, firstStation: 'Baker Street', firstIndex: 0 },
    { query: '99', page: 4, firstStation: 'Kennington', firstIndex: 15 },
    { query: 'invalid', page: 1, firstStation: 'Baker Street', firstIndex: 0 },
  ])('should load page $page when the query is "$query"', async ({ query, page, firstStation, firstIndex }) => {
    // Arrange
    const client = createClient()

    // Act
    const result = await client.get('/pagination/list', { query: query === undefined ? {} : { page: query } })

    // Assert
    expect(result).toMatchObject({ type: 'render', context: { data: {
      currentPage: page,
      pages: [0, 0, 0, 0],
      stations: expect.arrayContaining([expect.objectContaining({ name: firstStation, href: `detail/${firstIndex}` })]),
    } } })

    if (result.type !== 'render') {
      throw new Error('Expected the station list to render')
    }

    expect(result.context.data.stations).toHaveLength(5)
  })

  it('should load station details and their list page when a detail route is opened', async () => {
    // Arrange
    const client = createClient()

    // Act
    const result = await client.get('/pagination/detail/15')

    // Assert
    expect(result).toMatchObject({ type: 'render', context: { data: {
      stationName: 'Kennington',
      stationLines: 'Northern',
      stationZone: '1/2',
      stationPage: 4,
    } } })
  })
})
