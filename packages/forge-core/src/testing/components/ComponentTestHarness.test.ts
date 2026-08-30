import { Data } from '../../authoring'
import { component } from '../../components/presentation'
import type { BlockDefinition } from '../../components/types/structures.type'
import { ComponentTestHarness } from './ComponentTestHarness'

describe('ComponentTestHarness', () => {
  describe('component()', () => {
    it('should render an author-facing component call through its registered entry', async () => {
      // Arrange
      const dependencies = { prefix: 'Rendered: ' }
      const Card = component<{ title: string }, typeof dependencies, string>('card', {
        factory:
          ({ prefix }) =>
          ({ props }) =>
            `${prefix}${props.title}`,
      })
      const harness = new ComponentTestHarness(Card, dependencies)

      // Act
      const output = await harness.render(Card({ title: 'Details' }))

      // Assert
      expect(output).toBe('Rendered: Details')
    })

    it('should inject a field value and errors through withValue()', async () => {
      // Arrange
      const TextInput = component<{ label: string }>('textInput', {
        field: true,
        factory:
          () =>
          ({ props }) =>
            `${props.code}:${props.label}:${String(props.value)}:${props.errors?.[0]?.message}`,
      })
      const harness = new ComponentTestHarness(TextInput)

      // Act
      const output = await harness
        .render(TextInput({ code: 'name', label: 'Name' }))
        .withValue('Ada', [{ message: 'Check name' }])

      // Assert
      expect(output).toBe('name:Name:Ada:Check name')
    })

    it('should render and wrap nested authored component calls before their parent', async () => {
      // Arrange
      const Child = component<{ text: string }>('child', {
        factory:
          () =>
          ({ props }) =>
            `<p>${props.text}</p>`,
      })
      const Parent = component<{ child: BlockDefinition }>('parent', {
        factory:
          () =>
          ({ props }) =>
            `<main>${props.child.html}</main>`,
      })
      const harness = new ComponentTestHarness([Parent, Child])

      // Act
      const output = await harness.render(Parent({ child: Child({ text: 'Hello' }) }))

      // Assert
      expect(output).toBe('<main><p>Hello</p></main>')
    })

    it('should reject an authored call whose component is not registered', async () => {
      // Arrange
      const Registered = component<object>('registered', { factory: () => () => 'registered' })
      const Missing = component<object>('missing', { factory: () => () => 'missing' })
      const harness = new ComponentTestHarness(Registered)

      // Act
      const output = harness.render(Missing())

      // Assert
      await expect(output).rejects.toThrow('Component variant "missing" is not registered')
    })

    it('should direct expression evaluation tests to ForgeTestHarness', async () => {
      // Arrange
      const Card = component<{ title: string }>('card', {
        factory:
          () =>
          ({ props }) =>
            props.title,
      })
      const harness = new ComponentTestHarness(Card)

      // Act
      const output = harness.render(Card({ title: Data('title') }))

      // Assert
      await expect(output).rejects.toThrow('requires concrete component props')
    })
  })
})
