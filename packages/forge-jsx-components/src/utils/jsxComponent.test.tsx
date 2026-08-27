import { z } from 'zod'
import { ComponentCallType } from '@ministryofjustice/hmpps-forge/core/authoring'
import type { BlockDefinition, EvaluatedBlock, FieldBlockDefinition, ResolvableString } from '@ministryofjustice/hmpps-forge/core/components'

import { jsxComponent } from './jsxComponent'
import { raw } from '../runtime/jsx-runtime'

interface TestBadge extends BlockDefinition {
  /** Text shown inside the badge */
  text: ResolvableString
}

const TestBadge = jsxComponent<TestBadge>('testBadge', {
  render: props => <strong class="badge">{props.text}</strong>,
})

interface TestTextInput extends FieldBlockDefinition {
  /** Label shown above the input */
  label: ResolvableString
}

const TestTextInput = jsxComponent<TestTextInput>('testTextInput', {
  field: true,
  render: props => (
    <div class="form-group">
      <label for={props.code}>{props.label}</label>
      <input type="text" id={props.code} name={props.code} value={props.value as string} />
    </div>
  ),
  inputSchema: z.string(),
})

const evaluatedBadge = {
  variant: 'testBadge',
  _forge: ComponentCallType.BASIC,
  text: 'New',
} as EvaluatedBlock<TestBadge>

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
    it('should render to a plain string when the registry render is invoked', () => {
      // Arrange & Act
      const output = TestBadge.render(evaluatedBadge)

      // Assert
      expect(typeof output).toBe('string')
      expect(output).toBe('<strong class="badge">New</strong>')
    })

    it('should escape evaluated prop values when they contain HTML', () => {
      // Arrange
      const evaluatedWithHtml = { ...evaluatedBadge, text: '<script>alert(1)</script>' } as EvaluatedBlock<TestBadge>

      // Act
      const output = TestBadge.render(evaluatedWithHtml)

      // Assert
      expect(output).toBe('<strong class="badge">&lt;script&gt;alert(1)&lt;/script&gt;</strong>')
    })

    it('should render field props into the markup when rendering a field component', () => {
      // Arrange
      const evaluatedInput = {
        variant: 'testTextInput',
        _forge: ComponentCallType.FIELD,
        code: 'first_name',
        label: 'First name',
        value: 'Ada',
      } as unknown as EvaluatedBlock<TestTextInput>

      // Act
      const output = TestTextInput.render(evaluatedInput)

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

    it('should embed pre-rendered child HTML verbatim when the render uses raw()', () => {
      // Arrange
      interface TestCard extends BlockDefinition {
        childHtml: string
      }

      const TestCard = jsxComponent<TestCard>('testCard', {
        render: props => <div class="card">{raw(props.childHtml)}</div>,
      })

      const evaluatedCard = {
        variant: 'testCard',
        _forge: ComponentCallType.BASIC,
        childHtml: '<p>Rendered elsewhere</p>',
      } as EvaluatedBlock<TestCard>

      // Act
      const output = TestCard.render(evaluatedCard)

      // Assert
      expect(output).toBe('<div class="card"><p>Rendered elsewhere</p></div>')
    })
  })
})
