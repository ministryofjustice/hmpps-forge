import { ASTTestFactory } from '../../../testing/ASTTestFactory'
import { ASTNodeType } from '../../types/enums'
import { BlockType, ExpressionType, FunctionType, IteratorType } from '../../../authoring/types/enums'
import { FieldBlockASTNode } from '../../types/structures.type'
import { FunctionASTNode, IterateASTNode, ReferenceASTNode } from '../../types/expressions.type'
import { TemplateValue } from '../../types/template.type'
import TemplateFactory from '../../nodes/template/TemplateFactory'
import { NodeIDGenerator } from '../id-generators/NodeIDGenerator'
import FunctionRegistry from '../../registries/FunctionRegistry'
import StepFieldInventoryCompiler, {
  FieldInventoryContext,
  FieldInventoryStepSource,
} from './StepFieldInventoryCompiler'

function createFieldBlock(code: string | FunctionASTNode): FieldBlockASTNode {
  return ASTTestFactory.block('text-input', BlockType.FIELD)
    .withProperty('code', code)
    .build() as FieldBlockASTNode
}

function createReference(path: string[]): ReferenceASTNode {
  return {
    type: ASTNodeType.EXPRESSION,
    expressionType: ExpressionType.REFERENCE,
    id: ASTTestFactory.getId(),
    properties: { path },
  } as ReferenceASTNode
}

function createGeneratorFunction(name: string, args: unknown[] = []): FunctionASTNode {
  return {
    type: ASTNodeType.EXPRESSION,
    expressionType: FunctionType.GENERATOR,
    id: ASTTestFactory.getId(),
    properties: { name, arguments: args },
  } as FunctionASTNode
}

function createTemplate(value: unknown): TemplateValue {
  return new TemplateFactory(new NodeIDGenerator()).compile(value)
}

function createIterateNode(input: unknown, yieldTemplate: TemplateValue): IterateASTNode {
  return {
    type: ASTNodeType.EXPRESSION,
    expressionType: ExpressionType.ITERATE,
    id: ASTTestFactory.getId(),
    properties: {
      input,
      iterator: {
        type: IteratorType.MAP,
        yieldTemplate,
      },
    },
  } as IterateASTNode
}

function createContext(
  functionRegistry: FunctionRegistry,
  overrides: Partial<FieldInventoryContext> = {},
): FieldInventoryContext {
  return {
    answers: {},
    data: {},
    session: {},
    params: {},
    query: {},
    request: { method: 'GET' },
    conditions: functionRegistry,
    ...overrides,
  }
}

describe('StepFieldInventoryCompiler', () => {
  let compiler: StepFieldInventoryCompiler

  beforeEach(() => {
    ASTTestFactory.resetIds()
    compiler = new StepFieldInventoryCompiler()
  })

  describe('compile()', () => {
    it('should collect static field and cleardown codes for each step', () => {
      // Arrange
      const functionRegistry = new FunctionRegistry()
      const steps: FieldInventoryStepSource[] = [
        {
          stepId: 'compile_ast:step-a',
          fieldBlocks: [createFieldBlock('firstName'), createFieldBlock('lastName'), createFieldBlock('firstName')],
          iterateNodes: [],
          cleardownFieldCodes: ['^task_\\d+$'],
        },
      ]
      const compiled = compiler.compile(steps, functionRegistry)

      // Act
      const result = compiled!(createContext(functionRegistry))

      // Assert
      expect(result).not.toBeInstanceOf(Promise)
      expect(result).toEqual([
        {
          stepId: 'compile_ast:step-a',
          fieldCodes: ['firstName', 'lastName'],
          cleardownFieldCodes: ['^task_\\d+$'],
        },
      ])
    })

    it('should compile MAP iterator template field codes without runtime expansion', () => {
      // Arrange
      const functionRegistry = new FunctionRegistry()
      const dynamicCode = createGeneratorFunction('memberCode', [createReference(['@scope', '0', '@index'])])
      const template = createTemplate([createFieldBlock(dynamicCode)])
      const iterateNode = createIterateNode(createReference(['data', 'members']), template)
      const steps: FieldInventoryStepSource[] = [
        {
          stepId: 'compile_ast:step-a',
          fieldBlocks: [createFieldBlock('staticField')],
          iterateNodes: [iterateNode],
          cleardownFieldCodes: [],
        },
      ]

      functionRegistry.register({
        memberCode: {
          name: 'memberCode',
          isAsync: false,
          evaluate: (index: unknown) => `member_${String(index)}`,
        },
      })

      const compiled = compiler.compile(steps, functionRegistry)

      // Act
      const result = compiled!(
        createContext(functionRegistry, {
          data: { members: [{ name: 'Ada' }, { name: 'Grace' }] },
        }),
      )

      // Assert
      expect(result).toEqual([
        {
          stepId: 'compile_ast:step-a',
          fieldCodes: ['staticField', 'member_0', 'member_1'],
          cleardownFieldCodes: [],
        },
      ])
    })

    it('should await async dynamic iterator field codes', async () => {
      // Arrange
      const functionRegistry = new FunctionRegistry()
      const dynamicCode = createGeneratorFunction('memberCode', [createReference(['@scope', '0', '@index'])])
      const template = createTemplate([createFieldBlock(dynamicCode)])
      const iterateNode = createIterateNode(createReference(['data', 'members']), template)
      const steps: FieldInventoryStepSource[] = [
        {
          stepId: 'compile_ast:step-a',
          fieldBlocks: [],
          iterateNodes: [iterateNode],
          cleardownFieldCodes: [],
        },
      ]

      functionRegistry.register({
        memberCode: {
          name: 'memberCode',
          isAsync: true,
          evaluate: async (index: unknown) => `member_${String(index)}`,
        },
      })

      // Act
      const source = compiler.generateSource(steps, functionRegistry)
      const compiled = compiler.compile(steps, functionRegistry)
      const result = await compiled!(
        createContext(functionRegistry, {
          data: { members: [{ name: 'Ada' }] },
        }),
      )

      // Assert
      expect(source).toContain('await')
      expect(result[0].fieldCodes).toEqual(['member_0'])
    })
  })
})
