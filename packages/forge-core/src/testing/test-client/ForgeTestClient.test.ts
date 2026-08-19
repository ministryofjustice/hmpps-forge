import { createForgePackage, journey, step } from '../../authoring/builders'
import { ForgeTestHarness } from './ForgeTestHarness'

const testJourney = journey({
  code: 'test',
  title: 'Test Journey',
  path: '/test',
  reachability: { disableReachabilityChecks: true },
  steps: [
    step({
      code: 'step-one',
      title: 'Step One',
      path: '/step-one',
      blocks: [],
    }),
  ],
})

function createClient() {
  return new ForgeTestHarness()
    .registerPackage(createForgePackage({ journey: testJourney }))
    .createClient()
}

describe('ForgeTestClient', () => {
  describe('get()', () => {
    it('should render when requesting a valid step', async () => {
      // Arrange
      const client = createClient()

      // Act
      const result = await client.get('/test/step-one', { session: {} })

      // Assert
      expect(result.type).toBe('render')
    })
  })

  describe('post()', () => {
    it('should render after submitting a step', async () => {
      // Arrange
      const client = createClient()

      // Act
      const result = await client.post('/test/step-one', { session: {} })

      // Assert
      expect(result.type).toBe('render')
    })
  })

  describe('dispatch()', () => {
    it('should throw when no route matches', async () => {
      // Arrange
      const client = createClient()

      // Act & Assert
      await expect(client.get('/nonexistent')).rejects.toThrow('No route matched')
    })
  })
})
