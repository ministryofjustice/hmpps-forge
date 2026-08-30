import { describe, expect, it } from 'vitest'
import { createForgePackage } from '../../../../src/authoring'
import { builtInComponents, component } from '../../../../src/components'
import { HtmlBlock } from '../../../../src/built-ins/components/html'
import { ForgeTestHarness } from '../../../../src/testing'
import type { ForgeRenderer } from '../../../../src/framework/types/rendering.type'
import ForgeRegistrationError from '../../../../src/engine/errors/ForgeRegistrationError'
import { journeyWithBlocks, TestCard, type TestCardBlock } from './componentRegistration.fixtures'

describe('component registration contracts', () => {
  describe('embedded components', () => {
    it('should register an embedded component with no components listing', async () => {
      // Arrange
      const client = new ForgeTestHarness()
        .registerPackage(createForgePackage({ journey: journeyWithBlocks([TestCard({ title: 'Hello' })]) }))
        .createClient()

      // Act
      const result = await client.get('/components/step-one')

      // Assert
      expect(result.type).toBe('render')
    })

    it('should collect a component once when it is both listed and embedded', () => {
      // Act
      const pkg = createForgePackage({
        journey: journeyWithBlocks([TestCard({ title: 'One' }), TestCard({ title: 'Two' })]),
        components: [TestCard],
      })

      // Assert
      const functionBuilders = Array.isArray(pkg.functions) ? pkg.functions : [pkg.functions]

      expect(functionBuilders[0]?.getDefinitions()).toHaveProperty('test-card')
    })

    it('should apply ordinary function-entry collision naming', () => {
      // Arrange
      const Duplicate = component<TestCardBlock>('test-card', {
        factory:
          () =>
          ({ props }) =>
            `<p>${props.title}</p>`,
      })

      // Act
      const pkg = createForgePackage({
        journey: journeyWithBlocks([TestCard({ title: 'One' }), Duplicate({ title: 'Two' })]),
      })

      // Assert
      expect(pkg.journey.steps?.[0].blocks?.map(block => block.variant)).toEqual(['test-card', 'test-card@2'])
    })
  })

  describe('name-only references', () => {
    it('should register a listed component for a JSON journey', async () => {
      // Arrange
      const jsonJourney = JSON.stringify(journeyWithBlocks([TestCard({ title: 'Hello' })]))

      const client = new ForgeTestHarness()
        .registerPackage(createForgePackage({ journey: jsonJourney, components: [TestCard] }))
        .createClient()

      // Act
      const result = await client.get('/components/step-one')

      // Assert
      expect(result.type).toBe('render')
    })

    it('should reject a JSON journey whose variant has no listed component', () => {
      // Arrange
      const jsonJourney = JSON.stringify(journeyWithBlocks([TestCard({ title: 'Hello' })]))

      // Act
      const act = () => new ForgeTestHarness().registerPackage(createForgePackage({ journey: jsonJourney }))

      // Assert
      expect(act).toThrow(ForgeRegistrationError)
      expect(act).toThrow('Component variant "test-card" is not registered')
    })
  })

  describe('built-in entries', () => {
    /** A JSON journey using the built-in `html` variant, so variant resolution is observable. */
    const htmlJourney = () => JSON.stringify(journeyWithBlocks([HtmlBlock({ content: '<b>built-in</b>' })]))

    const passThroughRenderer: ForgeRenderer<unknown> = {
      wrapNestedBlock: (_block, output) => output,
      assemblePage: (_context, renderedBlocks) => renderedBlocks.join(''),
    }

    it('should render an explicitly registered built-in component from a name-only journey', async () => {
      // Arrange
      const client = new ForgeTestHarness()
        .registerPackage(createForgePackage({ journey: htmlJourney(), components: [...builtInComponents] }))
        .createClient(passThroughRenderer)

      // Act
      const result = await client.get('/components/step-one')

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.output).toBe('<b>built-in</b>')
      }
    })
  })
})
