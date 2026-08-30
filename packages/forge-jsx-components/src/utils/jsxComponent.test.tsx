import { z } from 'zod'
import { ComponentCallType } from '@ministryofjustice/hmpps-forge/core/authoring'
import { FunctionRegistryTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'

import { jsxComponent } from './jsxComponent'
import { raw } from '../runtime/jsx-runtime'

interface TestBadgeProps {
  /** Text shown inside the badge */
  text: string
}

const TestBadge = jsxComponent<TestBadgeProps>('testBadge', {
  render: props => <strong class="badge">{props.text}</strong>,
})

interface TestTextInputProps {
  /** Label shown above the input */
  label: string
}

const TestTextInput = jsxComponent<TestTextInputProps>('testTextInput', {
  field: true,
  render: props => (
    <div class="form-group">
      <label for={props.code}>{props.label}</label>
      <input type="text" id={props.code} name={props.code} value={props.value as string} />
    </div>
  ),
  inputSchema: z.string(),
})

const badgeHarness = new FunctionRegistryTestHarness(TestBadge)
const textInputHarness = new FunctionRegistryTestHarness(TestTextInput)

describe('jsxComponent()', () => {
  describe('block building', () => {
    it('should stamp the block envelope onto the props when called as a builder', () => {
      // Arrange & Act
      const built = TestBadge({ text: 'New' })

      // Assert
      expect(built).toEqual({
        _forge: ComponentCallType.BASIC,
        variant: 'testBadge',
        text: 'New',
      })
    })

    it('should stamp a field block when the options declare a field component', () => {
      // Arrange & Act
      const built = TestTextInput({ code: 'first_name', label: 'First name' })

      // Assert
      expect(built._forge).toBe(ComponentCallType.FIELD)
      expect(built.variant).toBe('testTextInput')
    })
  })

  describe('registry entry', () => {
    it('should render to a plain string when the registry render is invoked', async () => {
      // Arrange & Act
      const output = await badgeHarness.render(TestBadge({ text: 'New' }))

      // Assert
      expect(typeof output).toBe('string')
      expect(output).toBe('<strong class="badge">New</strong>')
    })

    it('should escape evaluated prop values when they contain HTML', async () => {
      // Arrange & Act
      const output = await badgeHarness.render(TestBadge({ text: '<script>alert(1)</script>' }))

      // Assert
      expect(output).toBe('<strong class="badge">&lt;script&gt;alert(1)&lt;/script&gt;</strong>')
    })

    it('should render field props into the markup when rendering a field component', async () => {
      // Arrange & Act
      const output = await textInputHarness
        .render(TestTextInput({ code: 'first_name', label: 'First name' }))
        .withValue('Ada')

      // Assert
      expect(output).toBe(
        '<div class="form-group"><label for="first_name">First name</label>' +
          '<input type="text" id="first_name" name="first_name" value="Ada"></div>',
      )
    })

    it('should expose the variant and field options when registered', () => {
      // Arrange & Act & Assert
      expect(TestTextInput.variant).toBe('testTextInput')
      expect(TestTextInput.inputSchema?.safeParse('text').success).toBe(true)
      expect(TestBadge.inputSchema).toBeUndefined()
    })

    it('should embed pre-rendered child HTML verbatim when the render uses raw()', async () => {
      // Arrange
      interface TestCardProps {
        childHtml: string
      }

      const TestCard = jsxComponent<TestCardProps>('testCard', {
        render: props => <div class="card">{raw(props.childHtml)}</div>,
      })

      const harness = new FunctionRegistryTestHarness(TestCard)

      // Act
      const output = await harness.render(TestCard({ childHtml: '<p>Rendered elsewhere</p>' }))

      // Assert
      expect(output).toBe('<div class="card"><p>Rendered elsewhere</p></div>')
    })
  })
})
