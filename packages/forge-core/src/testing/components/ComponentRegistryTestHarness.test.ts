import { Data } from '../../authoring'
import { component } from '../../components/component'
import type { BlockDefinition } from '../../components/types/structures.type'
import { ComponentRegistryTestHarness } from './ComponentRegistryTestHarness'

describe('ComponentRegistryTestHarness', () => {
  describe('render()', () => {
    it('should render an author-facing component call through its registered entry', async () => {
      // Arrange
      const renderer = { prefix: 'Rendered: ' }
      const Card = component<{ title: string }, string, typeof renderer>('card', {
        render: (props, componentRenderer) => `${componentRenderer.prefix}${props.title}`,
      })
      const harness = new ComponentRegistryTestHarness(Card, renderer)

      // Act
      const output = await harness.render(Card({ title: 'Details' }))

      // Assert
      expect(output).toBe('Rendered: Details')
    })

    it('should inject a field value and errors through withValue()', async () => {
      // Arrange
      const TextInput = component<{ label: string }>('textInput', {
        field: true,
        render: props => `${props.code}:${props.label}:${String(props.value)}:${props.errors?.[0]?.message}`,
      })
      const harness = new ComponentRegistryTestHarness(TextInput)

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
        render: props => `<p>${props.text}</p>`,
      })
      const Parent = component<{ child: BlockDefinition }>('parent', {
        render: props => `<main>${props.child.html}</main>`,
      })
      const harness = new ComponentRegistryTestHarness([Parent, Child])

      // Act
      const output = await harness.render(Parent({ child: Child({ text: 'Hello' }) }))

      // Assert
      expect(output).toBe('<main><p>Hello</p></main>')
    })

    it('should reject an authored call whose component is not registered', async () => {
      // Arrange
      const Registered = component<object>('registered', { render: () => 'registered' })
      const Missing = component<object>('missing', { render: () => 'missing' })
      const harness = new ComponentRegistryTestHarness(Registered)

      // Act
      const output = harness.render(Missing())

      // Assert
      await expect(output).rejects.toThrow('Component variant "missing" is not registered')
    })

    it('should direct expression evaluation tests to ForgeTestHarness', async () => {
      // Arrange
      const Card = component<{ title: string }>('card', { render: props => props.title })
      const harness = new ComponentRegistryTestHarness(Card)

      // Act
      const output = harness.render(Card({ title: Data('title') }))

      // Assert
      await expect(output).rejects.toThrow('requires concrete component props')
    })
  })
})
