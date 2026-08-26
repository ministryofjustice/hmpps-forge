import { describe, expect, it } from 'vitest'
import { createForgePackage } from '../../../../src/authoring'
import { component } from '../../../../src/components'
import { HtmlBlock } from '../../../../src/built-ins/components/html'
import { ForgeTestHarness } from '../../../../src/testing'
import type { ForgeRenderer } from '../../../../src/framework/types/rendering.type'
import ForgeRegistrationError from '../../../../src/engine/errors/ForgeRegistrationError'
import ForgeRegistryDuplicateError from '../../../../src/engine/errors/ForgeRegistryDuplicateError'
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
      expect(pkg.components).toEqual([TestCard])
    })

    it('should throw when two different components claim one variant', () => {
      // Arrange
      const Duplicate = component<TestCardBlock>('test-card', { render: card => `<p>${card.title}</p>` })

      // Act
      const act = () =>
        createForgePackage({
          journey: journeyWithBlocks([TestCard({ title: 'One' }), Duplicate({ title: 'Two' })]),
        })

      // Assert
      expect(act).toThrow(ForgeRegistryDuplicateError)
      expect(act).toThrow(/test-card/)
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

  describe('malformed listed entries', () => {
    it('should reject a listed component without a render function at registration', () => {
      // Act
      const act = () =>
        new ForgeTestHarness().registerPackage(
          createForgePackage({
            journey: journeyWithBlocks([]),
            components: [{ variant: 'broken-card' } as never],
          }),
        )

      // Assert
      expect(act).toThrow(ForgeRegistrationError)
      expect(act).toThrow('Component registration failed')
      expect(act).toThrow('Component "broken-card" must have a render function')
    })
  })

  describe('registry scoping', () => {
    /** A JSON journey using the built-in `html` variant, so variant resolution is observable. */
    const htmlJourney = () => JSON.stringify(journeyWithBlocks([HtmlBlock({ content: '<b>built-in</b>' })]))

    const passThroughRenderer: ForgeRenderer<unknown> = {
      renderBlock: (entry, block) => entry.render(block),
      wrapNestedBlock: (_block, output) => output,
      assemblePage: (_context, renderedBlocks) => renderedBlocks.join(''),
    }

    it('should prefer a journey component when it shares a variant with a built-in', async () => {
      // Arrange
      const ShadowHtml = component<HtmlBlock>('html', { render: () => 'SHADOWED' })
      const client = new ForgeTestHarness()
        .registerPackage(createForgePackage({ journey: htmlJourney(), components: [ShadowHtml] }))
        .createClient(passThroughRenderer)

      // Act
      const result = await client.get('/components/step-one')

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.output).toBe('SHADOWED')
      }
    })

    it('should reject a built-in component variant when built-in components are disabled', () => {
      // Act
      const act = () =>
        new ForgeTestHarness({ disableBuiltInComponents: true }).registerPackage(
          createForgePackage({ journey: htmlJourney() }),
        )

      // Assert
      expect(act).toThrow(ForgeRegistrationError)
      expect(act).toThrow('Component variant "html" is not registered')
      // Control: the same journey registers when built-ins stay enabled.
      expect(() => new ForgeTestHarness().registerPackage(createForgePackage({ journey: htmlJourney() }))).not.toThrow()
    })
  })
})
