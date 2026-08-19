import { expectTypeOf, vi } from 'vitest'
import { z } from 'zod'
import { Answer, block, field } from '../authoring/builders'
import { getComponentStamp } from '../authoring/builders/utils/stampEntry'
import { BlockType, StructureType } from '../authoring/types/enums'
import { component } from './component'
import type {
  ComponentOptions,
  ComponentRegistryEntry,
  ForgeComponent,
  PropsOf,
  ResolvedPropsOf,
} from './types/components.type'
import type { BlockDefinition, EvaluatedBlock, FieldBlockDefinition, ResolvableBoolean } from './types/structures.type'

interface TestCard extends BlockDefinition {
  /** Text shown as the card's title */
  title: string

  /** Optional supporting text */
  hint?: string
}

const TestCard = component<TestCard>('testCard', { render: card => `<h2>${card.title}</h2>` })

interface TestField extends FieldBlockDefinition {
  /** Label shown above the input */
  label: string
}

const TestField = component<TestField>('testField', {
  field: true,
  render: input => `<label>${input.label}</label>`,
  inputSchema: z.string(),
})

interface TestDivider extends BlockDefinition {
  /** Optional modifier class */
  classes?: string
}

const TestDivider = component<TestDivider>('testDivider', {
  render: divider => `<hr class="${divider.classes ?? 'divider'}">`,
})

const evaluatedCard = {
  type: StructureType.BLOCK,
  variant: 'testCard',
  blockType: BlockType.BASIC,
  title: 'Card title',
} as EvaluatedBlock<TestCard>

describe('component()', () => {
  describe('block building', () => {
    it('should stamp the block envelope onto the props when called', () => {
      // Arrange & Act
      const built = TestCard({ title: 'Card title' })

      // Assert
      expect(built).toEqual({
        type: StructureType.BLOCK,
        blockType: BlockType.BASIC,
        variant: 'testCard',
        title: 'Card title',
      })
    })

    it('should build with no arguments when every prop is optional', () => {
      // Arrange & Act
      const built = TestDivider()

      // Assert
      expect(built).toEqual({
        type: StructureType.BLOCK,
        blockType: BlockType.BASIC,
        variant: 'testDivider',
      })
    })

    it('should still run prepare on a bare call', () => {
      // Arrange
      const prepare = vi.fn((props: PropsOf<TestDivider>) => ({ ...props, classes: 'prepared' }))
      const PreparedDivider = component<TestDivider>('preparedDivider', {
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
      expect(built.blockType).toBe(BlockType.FIELD)
      expect(built.variant).toBe('testField')
    })

    it('should match block() output when given the same props', () => {
      // Arrange
      const props = { title: 'Card title', visibleWhen: Answer('show_card') }

      // Act
      const built = TestCard(props)

      // Assert
      expect(built).toEqual(block<TestCard>({ ...props, variant: 'testCard' }))
      expect(built.visibleWhen).not.toHaveProperty('build')
    })

    it('should match field() output when given the same props', () => {
      // Arrange
      const props = { code: 'first_name', label: 'First name', defaultValue: Answer('previous_first_name') }

      // Act
      const built = TestField(props)

      // Assert
      expect(built).toEqual(field<TestField>({ ...props, variant: 'testField' }))
      expect(built.defaultValue).not.toHaveProperty('build')
    })

    it('should build the block from the props prepare returns', () => {
      // Arrange
      const prepared = component<TestCard>('testCard', {
        render: card => `<h2>${card.title}</h2>`,
        prepare: props => ({ ...props, title: props.title.toUpperCase(), hint: 'Prepared hint' }),
      })

      // Act
      const built = prepared({ title: 'Card title' })

      // Assert
      expect(built).toEqual({
        type: StructureType.BLOCK,
        blockType: BlockType.BASIC,
        variant: 'testCard',
        title: 'CARD TITLE',
        hint: 'Prepared hint',
      })
    })

    it('should apply prepare when the component builds a field block', () => {
      // Arrange
      const preparedField = component<TestField>('testField', {
        field: true,
        render: input => `<label>${input.label}</label>`,
        prepare: props => ({ ...props, label: props.label.toUpperCase(), defaultValue: 'Prepared default' }),
      })

      // Act
      const built = preparedField({ code: 'first_name', label: 'First name' })

      // Assert
      expect(built).toEqual({
        type: StructureType.BLOCK,
        blockType: BlockType.FIELD,
        variant: 'testField',
        code: 'first_name',
        label: 'FIRST NAME',
        defaultValue: 'Prepared default',
      })
    })
  })

  describe('rendering', () => {
    it('should call the supplied render function with the evaluated block and the renderer', () => {
      // Arrange
      const renderer = { render: vi.fn().mockReturnValue('<div></div>') }
      const render = vi.fn().mockReturnValue('<h2>Card title</h2>')
      const rendered = component<TestCard>('testCard', { render })

      // Act
      const html = rendered.render(evaluatedCard, renderer)

      // Assert
      expect(render).toHaveBeenCalledWith(evaluatedCard, renderer)
      expect(html).toBe('<h2>Card title</h2>')
    })

    it('should render through the renderer the adapter supplies', () => {
      // Arrange
      const renderer = { render: vi.fn().mockReturnValue('<div>Card title</div>') }
      const templated = component<TestCard>('testCard', {
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
      const multiSelect = component<TestField>('testField', {
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
      expectTypeOf<keyof PropsOf<TestCard>>().toEqualTypeOf<'visibleWhen' | 'metadata' | 'title' | 'hint'>()
      expectTypeOf<Parameters<typeof TestCard>[0]>().toEqualTypeOf<PropsOf<TestCard>>()
    })

    it('should require the props argument only when a prop is required', () => {
      expectTypeOf<Parameters<typeof TestDivider>[0]>().toEqualTypeOf<PropsOf<TestDivider> | undefined>()
      // @ts-expect-error - TestCard has a required title prop, so a bare call is rejected
      expectTypeOf<typeof TestCard>().toBeCallableWith()
    })

    it('should drop the engine-consumed keys from the props render receives', () => {
      expectTypeOf<keyof ResolvedPropsOf<TestField>>().toEqualTypeOf<
        'metadata' | 'code' | 'label' | 'value' | 'errors'
      >()
      expectTypeOf<keyof ResolvedPropsOf<TestCard>>().toEqualTypeOf<'metadata' | 'title' | 'hint' | 'value'>()
      expectTypeOf<Parameters<ComponentOptions<TestField>['render']>[0]>().toEqualTypeOf<ResolvedPropsOf<TestField>>()
    })

    it('should preserve prop optionality and the props inherited from the block base', () => {
      expectTypeOf<PropsOf<TestCard>['hint']>().toEqualTypeOf<string | undefined>()
      expectTypeOf<PropsOf<TestCard>['title']>().toEqualTypeOf<string>()
      expectTypeOf<PropsOf<TestCard>['visibleWhen']>().toEqualTypeOf<ResolvableBoolean | undefined>()
      expectTypeOf<{ hint: string }>().not.toExtend<PropsOf<TestCard>>()
    })

    it('should build the exact block type', () => {
      // Arrange & Act
      const built = TestCard({ title: 'Card title' })

      // Assert
      expectTypeOf(built).toEqualTypeOf<TestCard>()
    })

    it('should build a field block definition for a field component', () => {
      // Arrange & Act
      const built = TestField({ code: 'first_name', label: 'First name' })

      // Assert
      expectTypeOf(built).toEqualTypeOf<TestField>()
      expectTypeOf(built).toExtend<FieldBlockDefinition>()
      expectTypeOf<PropsOf<TestField>['code']>().not.toBeUndefined()
    })

    it('should satisfy the component registry entry a forge package accepts', () => {
      expectTypeOf(TestCard).toExtend<ComponentRegistryEntry<BlockDefinition, unknown>>()
      expectTypeOf(TestField).toExtend<ComponentRegistryEntry<BlockDefinition, unknown>>()
      expectTypeOf<ForgeComponent<TestCard>>().toExtend<ComponentRegistryEntry<BlockDefinition, unknown>>()
    })

    it('should infer its block type when handed to a generic registry consumer', () => {
      // Arrange
      const registerComponent = <T extends BlockDefinition>(entry: ComponentRegistryEntry<T, string>) =>
        entry as unknown as T

      // Act
      const registered = registerComponent(TestCard)

      // Assert
      expectTypeOf(registered).toEqualTypeOf<TestCard>()
    })

    it('should require a field component to declare that it is a field', () => {
      expectTypeOf<ComponentOptions<TestField>>().toExtend<{ field: true }>()
      expectTypeOf<{ render: () => string }>().not.toExtend<ComponentOptions<TestField>>()
    })

    it('should offer a block component the render and prepare options alone', () => {
      expectTypeOf<keyof ComponentOptions<TestCard>>().toEqualTypeOf<'render' | 'prepare'>()

      // @ts-expect-error - `field` is a field component option
      component<TestCard>('testCard', { render: () => '', field: true })

      // @ts-expect-error - `inputSchema` describes a submitted value, and blocks submit nothing
      component<TestCard>('testCard', { render: () => '', inputSchema: z.string() })

      // @ts-expect-error - `multiple` describes a submitted value, and blocks submit nothing
      component<TestCard>('testCard', { render: () => '', multiple: true })
    })
  })
})
