import { z } from 'zod'
import { staticValue } from '../../../contracts/models/authoredValue.type'
import { BlockType, ExpressionType, FunctionType, IteratorType } from '../../../../../authoring/types/enums'
import { ASTNodeType } from '../../../contracts/ast/enums'
import type { IterateASTNode } from '../../../contracts/ast/expressions.type'
import type { FieldBlockASTNode } from '../../../contracts/ast/structures.type'
import type { TemplateNode, TemplateValue } from '../../../contracts/ast/template.type'
import { FieldCodeKind, ValidationRulesKind } from '../../../contracts/models/fieldModel.type'
import ForgeInternalError from '../../../../errors/ForgeInternalError'
import ComponentRegistry from '../../../registries/ComponentRegistry'
import { ASTTestFactory } from '../../ast/testing-helpers/ASTTestFactory'
import FieldModelBuilder from './FieldModelBuilder'

function createComponentRegistry(
  ...entries: { variant: string; multiple?: boolean; inputSchema?: z.ZodType }[]
): ComponentRegistry {
  const registry = new ComponentRegistry()

  registry.registerMany(entries.map(entry => ({ ...entry, render: () => '' })))

  return registry
}

function createFieldBlock(
  code: unknown,
  props: Record<string, unknown> = {},
  variant = 'text-input',
): FieldBlockASTNode {
  const builder = ASTTestFactory.block(variant, BlockType.FIELD).withProperty('code', code)

  Object.entries(props).forEach(([key, value]) => {
    builder.withProperty(key, value)
  })

  return builder.build() as FieldBlockASTNode
}

function createTemplateField(
  code: TemplateValue,
  props: Record<string, TemplateValue> = {},
  variant = 'text-input',
): TemplateNode {
  return {
    type: ASTNodeType.TEMPLATE,
    originalType: ASTNodeType.BLOCK,
    blockType: BlockType.FIELD,
    variant,
    id: ASTTestFactory.getId(),
    properties: { code, ...props },
  } as unknown as TemplateNode
}

function createTemplateIterate(input: TemplateValue, yieldTemplate: TemplateValue): TemplateNode {
  return {
    type: ASTNodeType.TEMPLATE,
    originalType: ASTNodeType.EXPRESSION,
    expressionType: ExpressionType.ITERATE,
    id: ASTTestFactory.getId(),
    properties: {
      input,
      iterator: { type: IteratorType.MAP, yieldTemplate },
    },
  } as unknown as TemplateNode
}

function createIterateNode(
  yieldTemplate: TemplateValue,
  iteratorType: IteratorType = IteratorType.MAP,
): IterateASTNode {
  return {
    type: ASTNodeType.EXPRESSION,
    expressionType: ExpressionType.ITERATE,
    id: ASTTestFactory.getId(),
    properties: {
      input: ASTTestFactory.reference(['answers', 'items']),
      iterator: { type: iteratorType, yieldTemplate },
    },
  } as unknown as IterateASTNode
}

function createTransformer(name: string, args: unknown[] = []): unknown {
  return {
    type: ASTNodeType.EXPRESSION,
    expressionType: FunctionType.TRANSFORMER,
    id: ASTTestFactory.getId(),
    diagnostics: ASTTestFactory.diagnostics(),
    properties: { name, arguments: args },
  }
}

describe('FieldModelBuilder', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('buildStepFields()', () => {
    it('should classify a registered field with component facts when the variant is registered', () => {
      // Arrange
      const registry = createComponentRegistry({ variant: 'multi-input', multiple: true, inputSchema: z.string() })
      const block = createFieldBlock('emails', {}, 'multi-input')
      const builder = new FieldModelBuilder(registry)

      // Act
      const fields = builder.buildStepFields([block], [])

      // Assert
      expect(fields).toHaveLength(1)
      expect(fields[0].code).toEqual({ kind: FieldCodeKind.STATIC, value: 'emails' })
      expect(fields[0].component).toEqual({ variant: 'multi-input', acceptsMultipleValues: true, validatesInput: true })
      expect(fields[0].iteratorPath).toEqual([])
      expect(fields[0].label).toBe('multi-input "emails"')
    })

    it('should classify a dynamic code as an expression leaf when the code is an AST node', () => {
      // Arrange
      const registry = createComponentRegistry({ variant: 'text-input' })
      const codeNode = ASTTestFactory.reference(['params', 'code'])
      const block = createFieldBlock(codeNode)
      const builder = new FieldModelBuilder(registry)

      // Act
      const fields = builder.buildStepFields([block], [])

      // Assert
      expect(fields[0].code?.kind).toBe(FieldCodeKind.DYNAMIC)
      expect(fields[0].label).toBe('text-input (dynamic code)')
    })

    it('should throw when a registered variant is missing from the component registry', () => {
      // Arrange
      const block = createFieldBlock('name', {}, 'unregistered')
      const builder = new FieldModelBuilder(new ComponentRegistry())

      // Act / Assert
      expect(() => builder.buildStepFields([block], [])).toThrow(ForgeInternalError)
    })

    it('should classify transformer pipelines and skip non-node entries when formatters mix shapes', () => {
      // Arrange
      const registry = createComponentRegistry({ variant: 'text-input' })
      const block = createFieldBlock('name', {
        formatters: [createTransformer('trim'), 'not-a-node', createTransformer('truncate', [5])],
      })
      const builder = new FieldModelBuilder(registry)

      // Act
      const fields = builder.buildStepFields([block], [])

      // Assert
      expect(fields[0].formatters?.map(call => call.name)).toEqual(['trim', 'truncate'])
      expect(fields[0].formatters?.[1].arguments).toEqual([staticValue(5)])
    })

    it('should throw when a formatter node is not a transformer call', () => {
      // Arrange
      const registry = createComponentRegistry({ variant: 'text-input' })
      const block = createFieldBlock('name', { formatters: [ASTTestFactory.reference(['answers', 'other'])] })
      const builder = new FieldModelBuilder(registry)

      // Act / Assert
      expect(() => builder.buildStepFields([block], [])).toThrow('Formatter entry is not a transformer function call')
    })

    it('should classify direct rules when validWhen is an array of validation expressions', () => {
      // Arrange
      const registry = createComponentRegistry({ variant: 'text-input' })
      const rule = ASTTestFactory.expression(ExpressionType.VALIDATION).build()
      const block = createFieldBlock('name', { validWhen: [rule] })
      const builder = new FieldModelBuilder(registry)

      // Act
      const fields = builder.buildStepFields([block], [])

      // Assert
      expect(fields[0].validation?.rules.kind).toBe(ValidationRulesKind.DIRECT)
    })

    it('should classify dynamic rules when validWhen is not an array of validation expressions', () => {
      // Arrange
      const registry = createComponentRegistry({ variant: 'text-input' })
      const block = createFieldBlock('name', { validWhen: { message: 'Broken' } })
      const builder = new FieldModelBuilder(registry)

      // Act
      const fields = builder.buildStepFields([block], [])

      // Assert
      expect(fields[0].validation?.rules.kind).toBe(ValidationRulesKind.DYNAMIC)
    })

    it('should omit validation when validWhen is an empty array', () => {
      // Arrange
      const registry = createComponentRegistry({ variant: 'text-input' })
      const block = createFieldBlock('name', { validWhen: [] })
      const builder = new FieldModelBuilder(registry)

      // Act
      const fields = builder.buildStepFields([block], [])

      // Assert
      expect(fields[0].validation).toBeUndefined()
    })

    it('should model template occurrences with nested iterator paths when MAP iterators nest', () => {
      // Arrange
      const registry = createComponentRegistry({ variant: 'text-input' })
      const innerField = createTemplateField('inner')
      const innerIterate = createTemplateIterate('items', { wrapper: innerField })
      const outerField = createTemplateField('outer')
      const outerIterate = createIterateNode({ first: outerField, second: innerIterate })
      const registeredBlock = createFieldBlock('registered')
      const builder = new FieldModelBuilder(registry)

      // Act
      const fields = builder.buildStepFields([registeredBlock], [outerIterate])

      // Assert
      expect(fields.map(field => field.source)).toEqual([registeredBlock, outerField, innerField])
      expect(fields[1].iteratorPath.map(ref => ref.node)).toEqual([outerIterate])
      expect(fields[2].iteratorPath.map(ref => ref.node)).toEqual([outerIterate, innerIterate])
    })

    it('should skip non-MAP iterators when collecting template occurrences', () => {
      // Arrange
      const registry = createComponentRegistry({ variant: 'text-input' })
      const templateField = createTemplateField('skipped')
      const filterIterate = createIterateNode(templateField, IteratorType.FILTER)
      const builder = new FieldModelBuilder(registry)

      // Act
      const fields = builder.buildStepFields([], [filterIterate])

      // Assert
      expect(fields).toEqual([])
    })

    it('should resolve a lenient component when a template variant is not a string', () => {
      // Arrange
      const templateField = {
        type: ASTNodeType.TEMPLATE,
        originalType: ASTNodeType.BLOCK,
        blockType: BlockType.FIELD,
        id: ASTTestFactory.getId(),
        properties: { code: 'dynamic' },
      } as unknown as TemplateNode
      const iterateNode = createIterateNode(templateField)
      const builder = new FieldModelBuilder(new ComponentRegistry())

      // Act
      const fields = builder.buildStepFields([], [iterateNode])

      // Assert
      expect(fields[0].component).toEqual({ variant: '', acceptsMultipleValues: false, validatesInput: false })
      expect(fields[0].label).toBe('unknown component "dynamic"')
    })
  })
})
