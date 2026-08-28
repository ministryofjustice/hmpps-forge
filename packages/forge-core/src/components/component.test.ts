import { expectTypeOf, vi } from 'vitest'
import { z } from 'zod'
import { Answer, block, field } from '../authoring/builders'
import { getComponentStamp } from '../authoring/builders/utils/stampEntry'
import { ComponentCallType } from '../shared/taxonomy'
import { component } from './component'
import type {
  ComponentOptions,
  ComponentRenderProps,
  ComponentRegistryEntry,
  FieldComponentRenderProps,
  FieldComponentOptions,
  ForgeComponent,
} from './types/components.type'
import type {
  BlockDefinition,
  FieldBlockDefinition,
  RenderedBlock,
  ResolvableBoolean,
  ResolvableProps,
  ResolvableString,
} from './types/structures.type'

interface TestCardProps {
  /** Text shown as the card's title */
  title: string

  /** Optional supporting text */
  hint?: string

  /** Optional rendered content */
  content?: BlockDefinition
}

const TestCard = component<TestCardProps>('testCard', { render: card => `<h2>${card.title}</h2>` })
type TestCardBlock = ReturnType<typeof TestCard>

interface TestFieldProps {
  /** Label shown above the input */
  label: string
}

const TestField = component<TestFieldProps>('testField', {
  field: true,
  render: input => `<label>${input.label}</label>`,
  inputSchema: z.string(),
})
type TestFieldBlock = ReturnType<typeof TestField>

interface TestDividerProps {
  /** Optional modifier class */
  classes?: string
}

const TestDivider = component<TestDividerProps>('testDivider', {
  render: divider => `<hr class="${divider.classes ?? 'divider'}">`,
})

const evaluatedCard = {
  title: 'Card title',
} satisfies ComponentRenderProps<TestCardProps>

describe('component()', () => {
  describe('block building', () => {
    it('should stamp the block envelope onto the props when called', () => {
      // Arrange & Act
      const built = TestCard({ title: 'Card title' })

      // Assert
      expect(built).toEqual({
        _forge: ComponentCallType.BASIC,
        variant: 'testCard',
        title: 'Card title',
      })
    })

    it('should build with no arguments when every prop is optional', () => {
      // Arrange & Act
      const built = TestDivider()

      // Assert
      expect(built).toEqual({
        _forge: ComponentCallType.BASIC,
        variant: 'testDivider',
      })
    })

    it('should still run prepare on a bare call', () => {
      // Arrange
      const prepare: NonNullable<ComponentOptions<TestDividerProps>['prepare']> = vi.fn(props => ({
        ...props,
        classes: 'prepared',
      }))
      const PreparedDivider = component<TestDividerProps>('preparedDivider', {
        render: divider => `<hr class="${divider.classes}">`,
        prepare,
      })

      // Act
      const built = PreparedDivider()

      // Assert
      expect(prepare).toHaveBeenCalledWith({})
      expect(built.classes).toBe('prepared')
    })

    it('should stamp a field block when the options declare a field component', () => {
      // Arrange & Act
      const built = TestField({ code: 'first_name', label: 'First name' })

      // Assert
      expect(built._forge).toBe(ComponentCallType.FIELD)
      expect(built.variant).toBe('testField')
    })

    it('should match block() output when given the same props', () => {
      // Arrange
      const props = { title: 'Card title', visibleWhen: Answer('show_card') }

      // Act
      const built = TestCard(props)

      // Assert
      expect(built).toEqual(block<TestCardBlock>({ ...props, variant: 'testCard' }))
      expect(built.visibleWhen).not.toHaveProperty('build')
    })

    it('should match field() output when given the same props', () => {
      // Arrange
      const props = { code: 'first_name', label: 'First name', defaultValue: Answer('previous_first_name') }

      // Act
      const built = TestField(props)

      // Assert
      expect(built).toEqual(field<TestFieldBlock>({ ...props, variant: 'testField' }))
      expect(built.defaultValue).not.toHaveProperty('build')
    })

    it('should build the block from the props prepare returns', () => {
      // Arrange
      const prepared = component<TestCardProps>('testCard', {
        render: card => `<h2>${card.title}</h2>`,
        prepare: props => ({ ...props, title: 'Prepared title', hint: 'Prepared hint' }),
      })

      // Act
      const built = prepared({ title: 'Card title' })

      // Assert
      expect(built).toEqual({
        _forge: ComponentCallType.BASIC,
        variant: 'testCard',
        title: 'Prepared title',
        hint: 'Prepared hint',
      })
    })

    it('should apply prepare when the component builds a field block', () => {
      // Arrange
      const preparedField = component<TestFieldProps>('testField', {
        field: true,
        render: input => `<label>${input.label}</label>`,
        prepare: props => ({ ...props, label: 'Prepared label', defaultValue: 'Prepared default' }),
      })

      // Act
      const built = preparedField({ code: 'first_name', label: 'First name' })

      // Assert
      expect(built).toEqual({
        _forge: ComponentCallType.FIELD,
        variant: 'testField',
        code: 'first_name',
        label: 'Prepared label',
        defaultValue: 'Prepared default',
      })
    })
  })

  describe('rendering', () => {
    it('should call the supplied render function with the evaluated block and the renderer', () => {
      // Arrange
      const renderer = { render: vi.fn().mockReturnValue('<div></div>') }
      const render = vi.fn().mockReturnValue('<h2>Card title</h2>')
      const rendered = component<TestCardProps>('testCard', { render })

      // Act
      const html = rendered.render(evaluatedCard, renderer)

      // Assert
      expect(render).toHaveBeenCalledWith(evaluatedCard, renderer)
      expect(html).toBe('<h2>Card title</h2>')
    })

    it('should render through the renderer the adapter supplies', () => {
      // Arrange
      const renderer = { render: vi.fn().mockReturnValue('<div>Card title</div>') }
      const templated = component<TestCardProps>('testCard', {
        render: (card, adapterRenderer) =>
          (adapterRenderer as typeof renderer).render('components/test-card.njk', { params: { text: card.title } }),
      })

      // Act
      const html = templated.render(evaluatedCard, renderer)

      // Assert
      expect(renderer.render).toHaveBeenCalledWith('components/test-card.njk', { params: { text: 'Card title' } })
      expect(html).toBe('<div>Card title</div>')
    })
  })

  describe('registry entry', () => {
    it('should expose the variant and the inputSchema when provided', () => {
      // Arrange & Act
      const scalar = TestField.inputSchema?.safeParse('hello')

      // Assert
      expect(TestField.variant).toBe('testField')
      expect(scalar?.success).toBe(true)
    })

    it('should set multiple on the entry when the field component declares it', () => {
      // Arrange
      const multiSelect = component<TestFieldProps>('testField', {
        field: true,
        multiple: true,
        render: input => `<label>${input.label}</label>`,
      })

      // Act & Assert
      expect(multiSelect.multiple).toBe(true)
    })

    it('should omit the inputSchema and multiple keys when not provided', () => {
      expect('inputSchema' in TestCard).toBe(false)
      expect('multiple' in TestCard).toBe(false)
      expect('multiple' in TestField).toBe(false)
    })
  })

  describe('stamping', () => {
    it('should stamp built blocks with the component by reference identity', () => {
      // Act
      const card = TestCard({ title: 'Hello' })
      const input = TestField({ code: 'firstName', label: 'First name' })

      // Assert
      expect(getComponentStamp(card)).toBe(TestCard)
      expect(getComponentStamp(input)).toBe(TestField)
    })

    it('should keep the stamp invisible to enumeration and JSON serialisation', () => {
      // Act
      const card = TestCard({ title: 'Hello' })

      // Assert
      expect(Object.getOwnPropertyDescriptor(card, '__component')?.enumerable).toBe(false)
      expect(JSON.stringify(card)).not.toContain('__component')
    })
  })

  describe('types', () => {
    it('should expose only the writable props on the builder parameter', () => {
      expectTypeOf<keyof Parameters<typeof TestCard>[0]>().toEqualTypeOf<
        'visibleWhen' | 'metadata' | 'title' | 'hint' | 'content'
      >()
    })

    it('should require the props argument only when a prop is required', () => {
      expectTypeOf<typeof TestDivider>().toBeCallableWith()
      // @ts-expect-error - TestCard has a required title prop, so a bare call is rejected
      expectTypeOf<typeof TestCard>().toBeCallableWith()
    })

    it('should drop the engine-consumed keys from the props render receives', () => {
      expectTypeOf<keyof FieldComponentRenderProps<TestFieldProps>>().toEqualTypeOf<
        'metadata' | 'code' | 'label' | 'value' | 'errors'
      >()
      expectTypeOf<keyof ComponentRenderProps<TestCardProps>>().toEqualTypeOf<
        'metadata' | 'title' | 'hint' | 'content' | 'value'
      >()
      expectTypeOf<Parameters<FieldComponentOptions<TestFieldProps, string, unknown>['render']>[0]>().toEqualTypeOf<
        FieldComponentRenderProps<TestFieldProps>
      >()
    })

    it('should pass retained plain props forward to render', () => {
      expectTypeOf<ComponentRenderProps<TestCardProps>['title']>().toEqualTypeOf<string>()
      expectTypeOf<ComponentRenderProps<TestCardProps>['hint']>().toEqualTypeOf<string | undefined>()
      expectTypeOf<ComponentRenderProps<TestCardProps>['content']>().toEqualTypeOf<RenderedBlock | undefined>()
      expectTypeOf<ComponentRenderProps<TestCardProps>['title']>().not.toEqualTypeOf<
        Parameters<typeof TestCard>[0]['title']
      >()
    })

    it('should preserve prop optionality and the props inherited from the block base', () => {
      expectTypeOf<Parameters<typeof TestCard>[0]['hint']>().toEqualTypeOf<ResolvableString | undefined>()
      expectTypeOf<Parameters<typeof TestCard>[0]['title']>().toEqualTypeOf<ResolvableString>()
      expectTypeOf<Parameters<typeof TestCard>[0]['visibleWhen']>().toEqualTypeOf<ResolvableBoolean | undefined>()
      expectTypeOf<{ hint: string }>().not.toExtend<Parameters<typeof TestCard>[0]>()
    })

    it('should build the exact block type', () => {
      // Arrange & Act
      const built = TestCard({ title: 'Card title' })

      // Assert
      expectTypeOf(built).toEqualTypeOf<BlockDefinition & ResolvableProps<TestCardProps>>()
    })

    it('should build a field block definition for a field component', () => {
      // Arrange & Act
      const built = TestField({ code: 'first_name', label: 'First name' })

      // Assert
      expectTypeOf(built).toEqualTypeOf<TestFieldBlock>()
      expectTypeOf(built).toExtend<FieldBlockDefinition>()
      expectTypeOf<Parameters<typeof TestField>[0]['code']>().not.toBeUndefined()
    })

    it('should satisfy the component registry entry a forge package accepts', () => {
      expectTypeOf(TestCard).toExtend<ComponentRegistryEntry<object, unknown>>()
      expectTypeOf(TestField).toExtend<ComponentRegistryEntry<object, unknown>>()
      expectTypeOf<ForgeComponent<TestCardProps>>().toExtend<ComponentRegistryEntry<object, unknown>>()
    })

    it('should infer its render props when handed to a generic registry consumer', () => {
      // Arrange
      const registerComponent = <TProps extends object>(entry: ComponentRegistryEntry<TProps, string>) => entry

      // Act
      const registered = registerComponent(TestCard)

      // Assert
      expect(registered.variant).toBe('testCard')
      expectTypeOf(registered.render).parameter(0).toEqualTypeOf<ComponentRenderProps<TestCardProps>>()
    })

    it('should select field render props when field is true', () => {
      expectTypeOf<FieldComponentOptions<TestFieldProps, string, unknown>>().toExtend<{ field: true }>()
      expectTypeOf<FieldComponentRenderProps<TestFieldProps>['code']>().toEqualTypeOf<string>()
    })

    it('should offer a block component the render and prepare options alone', () => {
      expectTypeOf<keyof ComponentOptions<TestCardProps, string, unknown>>().toEqualTypeOf<'render' | 'prepare'>()

      // @ts-expect-error - `inputSchema` describes a submitted value, and blocks submit nothing
      component<TestCardProps>('testCard', { render: () => '', inputSchema: z.string() })

      // @ts-expect-error - `multiple` describes a submitted value, and blocks submit nothing
      component<TestCardProps>('testCard', { render: () => '', multiple: true })
    })
  })
})
