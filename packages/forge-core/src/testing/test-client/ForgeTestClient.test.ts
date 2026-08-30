import { createForgePackage, journey, step } from '../../authoring/builders'
import { condition } from '../../authoring/functions/condition'
import { component } from '../../components/presentation'
import type { ForgeRenderer } from '../../framework/types/rendering.type'
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
    it('should supply adapter and request dependencies when binding functions', async () => {
      // Arrange
      const factory = vi.fn(() => () => true)
      const HasDependencies = condition('HasDependencies', { factory })
      const adapterDependencies = { adapterValue: 'adapter' }
      const requestDependencies = { requestValue: 'request' }
      const client = new ForgeTestHarness()
        .registerPackage(createForgePackage({ journey: testJourney, functions: [HasDependencies] }))
        .createClient(undefined, adapterDependencies)

      // Act
      await client.get('/test/step-one', { session: {}, requestDependencies: () => requestDependencies })

      // Assert
      expect(factory).toHaveBeenCalledWith({ ...adapterDependencies, ...requestDependencies })
    })

    it('should supply client adapter dependencies when binding presentation functions', async () => {
      // Arrange
      const AdapterBlock = component<object, { adapterValue: string }>('adapterBlock', {
        factory:
          ({ adapterValue }) =>
          () =>
            adapterValue,
      })
      const adapterJourney = journey({
        code: 'adapter-test',
        title: 'Adapter Test Journey',
        path: '/adapter-test',
        reachability: { disableReachabilityChecks: true },
        steps: [
          step({
            code: 'step-one',
            title: 'Step One',
            path: '/step-one',
            blocks: [AdapterBlock({})],
          }),
        ],
      })
      const renderer: ForgeRenderer<unknown> = {
        wrapNestedBlock: (_block, output) => output,
        assemblePage: (_context, renderedBlocks) => renderedBlocks[0],
      }
      const client = new ForgeTestHarness()
        .registerPackage(createForgePackage({ journey: adapterJourney }))
        .createClient(renderer, { adapterValue: 'adapter-ready' })

      // Act
      const result = await client.get('/adapter-test/step-one', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.output).toBe('adapter-ready')
      }
    })

    it('should throw when no route matches', async () => {
      // Arrange
      const client = createClient()

      // Act & Assert
      await expect(client.get('/nonexistent')).rejects.toThrow('No route matched')
    })
  })
})
