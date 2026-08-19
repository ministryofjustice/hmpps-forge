import { describe, expect, it } from 'vitest'
import { createForgePackage } from '../../src/authoring'
import { component } from '../../src/components'
import { ForgeTestHarness } from '../../src/testing'
import ForgeRegistrationError from '../../src/engine/errors/ForgeRegistrationError'
import ForgeRegistryDuplicateError from '../../src/engine/errors/ForgeRegistryDuplicateError'
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
    })
  })
})
