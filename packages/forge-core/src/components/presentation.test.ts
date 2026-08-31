import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { z } from 'zod'
import { ComponentCallType, FunctionEntryType } from '../shared/taxonomy'
import { getEntryStamp } from '../authoring/builders/utils/stampEntry'
import type { NodeId } from '../engine/chassis/contracts/ast/ast.type'
import type { ComponentOptions } from './types/renderFunctions.type'
import type { BlockDefinition } from './types/structures.type'
import { component, renderer } from './presentation'

interface CardProps {
  title: string
}

interface Dependencies {
  readonly prefix: string
}

interface DividerProps {
  readonly classes?: string
}

describe('component()', () => {
  describe('component()', () => {
    it('should build a self-registering expression-aware block invocation', () => {
      // Arrange
      const Card = component<CardProps, Dependencies>('card', {
        factory: dependencies => input => `${dependencies.prefix}:${input.props.title}`,
      })
      const titleExpression = { _forge: 'expression.reference' } as never

      // Act
      const invocation = Card({ title: titleExpression })

      // Assert
      expect(Card._forge).toBe(FunctionEntryType.COMPONENT)
      expect(Card.factory).toEqual(expect.any(Function))
      expect(Card).not.toHaveProperty('render')
      expect(invocation).toMatchObject({
        _forge: ComponentCallType.BASIC,
        variant: 'card',
        title: titleExpression,
      })
      expect(getEntryStamp(invocation)).toBe(Card)
    })

    it('should expose the factory used to build one request evaluator', () => {
      // Arrange
      const factory = vi.fn((dependencies: Dependencies) => {
        return (input: { props: { title: string } }) => `${dependencies.prefix}:${input.props.title}`
      })
      const Card = component<CardProps, Dependencies>('card', { factory })

      // Act
      const evaluate = Card.factory({ prefix: 'bound' })
      const output = evaluate({
        props: { title: 'Hello' },
        context: {
          kind: 'block',
          block: {
            id: 'card' as NodeId,
            variant: 'card',
            blockType: ComponentCallType.BASIC,
            properties: { title: 'Hello' },
          },
        },
      })

      // Assert
      expect(factory).toHaveBeenCalledOnce()
      expect(output).toBe('bound:Hello')
    })

    it('should build with no arguments and run prepare when every prop is optional', () => {
      // Arrange
      const prepare: NonNullable<ComponentOptions<DividerProps, Record<string, never>>['prepare']> = vi.fn(props => ({
        ...props,
        classes: props.classes ?? 'prepared',
      }))
      const Divider = component<DividerProps>('divider', {
        prepare,
        factory:
          () =>
          ({ props }) =>
            `<hr class="${props.classes}">`,
      })

      // Act
      const invocation = Divider()

      // Assert
      expect(prepare).toHaveBeenCalledWith({})
      expect(invocation).toEqual({
        _forge: ComponentCallType.BASIC,
        variant: 'divider',
        classes: 'prepared',
      })
    })

    it('should apply prepare when building a field invocation', () => {
      // Arrange
      const TextInput = component<{ label: string }>('textInput', {
        field: true,
        prepare: props => ({ ...props, label: 'Prepared label', defaultValue: 'Prepared default' }),
        factory:
          () =>
          ({ props }) =>
            props.label,
      })

      // Act
      const invocation = TextInput({ code: 'name', label: 'Name' })

      // Assert
      expect(invocation).toEqual({
        _forge: ComponentCallType.FIELD,
        variant: 'textInput',
        code: 'name',
        label: 'Prepared label',
        defaultValue: 'Prepared default',
      })
    })

    it('should keep field metadata on the declaration', () => {
      // Arrange
      const errorAnchor = vi.fn(() => 'name-input')
      const TextInput = component<CardProps, Dependencies>('textInput', {
        field: true,
        inputSchema: z.string(),
        multiple: true,
        errorAnchor,
        factory: () => input => input.props.title,
      })

      // Act & Assert
      expect(TextInput._forge).toBe(FunctionEntryType.COMPONENT)
      expect(TextInput.inputSchema?.safeParse('Ada').success).toBe(true)
      expect(TextInput.multiple).toBe(true)
      expect(TextInput.errorAnchor).toBe(errorAnchor)
    })

    it('should omit field metadata from a basic component declaration', () => {
      // Arrange
      const Card = component<CardProps>('card', {
        factory:
          () =>
          ({ props }) =>
            props.title,
      })

      // Act & Assert
      expect('inputSchema' in Card).toBe(false)
      expect('multiple' in Card).toBe(false)
      expect('errorAnchor' in Card).toBe(false)
    })

    it('should keep the embedded entry stamp out of enumeration and serialisation', () => {
      // Arrange
      const Card = component<CardProps>('card', {
        factory:
          () =>
          ({ props }) =>
            props.title,
      })

      // Act
      const invocation = Card({ title: 'Hello' })

      // Assert
      expect(getEntryStamp(invocation)).toBe(Card)
      expect(Object.getOwnPropertyDescriptor(invocation, '__entry')?.enumerable).toBe(false)
      expect(JSON.stringify(invocation)).not.toContain('__entry')
    })
  })
})

describe('renderer()', () => {
  describe('renderer()', () => {
    it('should build a self-registering step renderer invocation', () => {
      // Arrange
      const Page = renderer<{ heading: string }>('page', {
        factory:
          () =>
          ({ props, blocks }) =>
            `<h1>${props.heading}</h1>${blocks.map(block => block.html).join('')}`,
      })

      // Act
      const invocation = Page({ heading: 'Details' })

      // Assert
      expect(Page._forge).toBe(FunctionEntryType.RENDERER)
      expect(invocation).toMatchObject({
        _forge: ComponentCallType.BASIC,
        variant: 'page',
        heading: 'Details',
      })
      expect(getEntryStamp(invocation)).toBe(Page)
    })

    it('should type a structured block layout and retain its schema', () => {
      // Arrange
      interface PageBlocks {
        readonly main: BlockDefinition[]
        readonly aside: {
          readonly featured: BlockDefinition
        }
      }

      const blocksSchema: z.ZodType<PageBlocks> = z.object({
        main: z.array(z.custom<BlockDefinition>()),
        aside: z.object({ featured: z.custom<BlockDefinition>() }),
      })
      const Page = renderer<{ heading: string }, PageBlocks>('structuredPage', {
        blocksSchema,
        factory:
          () =>
          ({ blocks }) => {
            expectTypeOf(blocks.main[0].html).toEqualTypeOf<string>()
            expectTypeOf(blocks.aside.featured.html).toEqualTypeOf<string>()

            return `${blocks.main[0].html}${blocks.aside.featured.html}`
          },
      })

      // Act & Assert
      expect(Page.blocksSchema).toBe(blocksSchema)
    })
  })
})
