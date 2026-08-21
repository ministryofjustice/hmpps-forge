import { ComponentEntryCollector } from './ComponentEntryCollector'
import { component } from './component'
import ForgeRegistryDuplicateError from '../engine/errors/ForgeRegistryDuplicateError'
import type { BlockDefinition } from './types/structures.type'

interface TestCard extends BlockDefinition {
  title: string
}

const TestCard = component<TestCard>('test-card', { render: card => `<h2>${card.title}</h2>` })

describe('ComponentEntryCollector', () => {
  describe('collectEmbedded()', () => {
    it('should collect the component behind a stamped block', () => {
      // Arrange
      const collector = new ComponentEntryCollector()

      // Act
      collector.collectEmbedded({ steps: [{ blocks: [TestCard({ title: 'Hello' })] }] })

      // Assert
      expect(collector.hasEmbedded()).toBe(true)
      expect(collector.entries()).toEqual([TestCard])
    })

    it('should collect a component once when several blocks use it', () => {
      // Arrange
      const collector = new ComponentEntryCollector()

      // Act
      collector.collectEmbedded({ blocks: [TestCard({ title: 'One' }), TestCard({ title: 'Two' })] })

      // Assert
      expect(collector.entries()).toEqual([TestCard])
    })

    it('should find nothing in a tree without stamped blocks', () => {
      // Arrange
      const collector = new ComponentEntryCollector()

      // Act
      collector.collectEmbedded({ steps: [{ blocks: [{ variant: 'test-card', title: 'Hello' }] }] })

      // Assert
      expect(collector.hasEmbedded()).toBe(false)
      expect(collector.entries()).toEqual([])
    })

    it('should throw when two different components claim one variant', () => {
      // Arrange
      const Duplicate = component<TestCard>('test-card', { render: card => `<p>${card.title}</p>` })
      const collector = new ComponentEntryCollector()

      // Act
      const act = () => collector.collectEmbedded({ blocks: [TestCard({ title: 'One' }), Duplicate({ title: 'Two' })] })

      // Assert
      expect(act).toThrow(ForgeRegistryDuplicateError)
    })
  })

  describe('collectListed()', () => {
    it('should keep listed components ahead of embedded ones', () => {
      // Arrange
      const listed = { variant: 'test-html', render: () => '<hr />' }
      const collector = new ComponentEntryCollector()

      // Act
      collector.collectListed(listed)
      collector.collectEmbedded({ blocks: [TestCard({ title: 'Hello' })] })

      // Assert
      expect(collector.entries()).toEqual([listed, TestCard])
    })

    it('should collect a component once when it is both listed and embedded', () => {
      // Arrange
      const collector = new ComponentEntryCollector()

      // Act
      collector.collectListed(TestCard)
      collector.collectEmbedded({ blocks: [TestCard({ title: 'Hello' })] })

      // Assert
      expect(collector.entries()).toEqual([TestCard])
    })

    it('should throw when a listed component clashes with an embedded variant', () => {
      // Arrange
      const listed = { variant: 'test-card', render: () => '<hr />' }
      const collector = new ComponentEntryCollector()

      collector.collectListed(listed)

      // Act
      const act = () => collector.collectEmbedded({ blocks: [TestCard({ title: 'Hello' })] })

      // Assert
      expect(act).toThrow(ForgeRegistryDuplicateError)
    })
  })
})
