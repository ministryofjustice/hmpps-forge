import { ASTTestFactory } from '../../../../../testing/ASTTestFactory'
import { ASTNodeType } from '../../../../types/enums'
import { BlockType, ExpressionType, FunctionType, IteratorType } from '../../../../../authoring/types/enums'
import { FieldBlockASTNode } from '../../../../types/structures.type'
import { FunctionASTNode, IterateASTNode, ReferenceASTNode } from '../../../../types/expressions.type'
import { TemplateValue } from '../../../../types/template.type'
import TemplateFactory from '../../../../nodes/template/TemplateFactory'
import { NodeIDGenerator } from '../../../id-generators/NodeIDGenerator'
import FunctionRegistry from '../../../../registries/FunctionRegistry'
import type { CompilationDependencies } from '../../CompilationDependencies'
import StepFieldInventoryCompiler, {
  FieldInventoryContext,
  FieldInventoryStepSource,
} from './StepFieldInventoryCompiler'

function createFieldBlock(code: string | FunctionASTNode): FieldBlockASTNode {
  return ASTTestFactory.block('text-input', BlockType.FIELD)
    .withProperty('code', code)
    .build() as FieldBlockASTNode
}

function createReference(path: (string | number)[]): ReferenceASTNode {
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
  const dependencies: CompilationDependencies = { functionRegistry: new FunctionRegistry() }

  beforeEach(() => {
    ASTTestFactory.resetIds()
    compiler = new StepFieldInventoryCompiler(dependencies)
  })

  describe('compile()', () => {
    it('should collect static field and cleardown codes for each step', async () => {
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
      const compiled = compiler.compile(steps)

      // Act
      const result = await compiled!(createContext(functionRegistry))

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

    it('should collect dynamic registered field codes', () => {
      // Arrange
      const functionRegistry = new FunctionRegistry()
      const dynamicCode = createGeneratorFunction('fieldCode')
      const steps: FieldInventoryStepSource[] = [
        {
          stepId: 'compile_ast:step-a',
          fieldBlocks: [createFieldBlock(dynamicCode)],
          iterateNodes: [],
          cleardownFieldCodes: [],
        },
      ]

      functionRegistry.register({
        fieldCode: {
          name: 'fieldCode',
          isAsync: false,
          evaluate: () => 'firstName',
        },
      })

      const localCompiler = new StepFieldInventoryCompiler({ functionRegistry })
      const compiled = localCompiler.compile(steps)

      // Act
      const result = compiled!(createContext(functionRegistry))

      // Assert
      expect(result).toEqual([
        {
          stepId: 'compile_ast:step-a',
          fieldCodes: ['firstName'],
          cleardownFieldCodes: [],
        },
      ])
    })

    it('should collect dynamic registered field codes', () => {
      // Arrange
      const functionRegistry = new FunctionRegistry()
      const dynamicCode = createGeneratorFunction('fieldCode')
      const steps: FieldInventoryStepSource[] = [
        {
          stepId: 'compile_ast:step-a',
          fieldBlocks: [createFieldBlock(dynamicCode)],
          iterateNodes: [],
          cleardownFieldCodes: [],
        },
      ]

      functionRegistry.register({
        fieldCode: {
          name: 'fieldCode',
          isAsync: false,
          evaluate: () => 'firstName',
        },
      })

      const localCompiler = new StepFieldInventoryCompiler({ functionRegistry })
      const compiled = localCompiler.compile(steps)

      // Act
      const result = compiled!(createContext(functionRegistry))

      // Assert
      expect(result).toEqual([
        {
          stepId: 'compile_ast:step-a',
          fieldCodes: ['firstName'],
          cleardownFieldCodes: [],
        },
      ])
    })

    it('should compile MAP iterator template field codes without runtime expansion', () => {
      // Arrange
      const functionRegistry = new FunctionRegistry()
      const dynamicCode = createGeneratorFunction('memberCode', [createReference(['@loop', '0', 'index0'])])
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

      const localCompiler = new StepFieldInventoryCompiler({ functionRegistry })
      const compiled = localCompiler.compile(steps)

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

    it('should collect field codes from nested iterator templates with parent and child loop scope', () => {
      // Arrange
      const functionRegistry = new FunctionRegistry()
      const dynamicCode = createGeneratorFunction('memberCode', [
        createReference(['@loop', 1, 'index0']),
        createReference(['@loop', 0, 'index0']),
      ])
      const memberField = createFieldBlock(dynamicCode)
      const innerIterator = createIterateNode(createReference(['@scope', 0, 'members']), createTemplate(memberField))
      const template = createTemplate([innerIterator])
      const iterateNode = createIterateNode(createReference(['data', 'teams']), template)
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
          isAsync: false,
          evaluate: (teamIndex: unknown, memberIndex: unknown) =>
            `team_${String(teamIndex)}_member_${String(memberIndex)}`,
        },
      })

      const localCompiler = new StepFieldInventoryCompiler({ functionRegistry })
      const compiled = localCompiler.compile(steps)

      // Act
      const result = compiled!(
        createContext(functionRegistry, {
          data: {
            teams: [
              { name: 'Alpha', members: [{ name: 'Ada' }, { name: 'Grace' }] },
              { name: 'Beta', members: [{ name: 'Linus' }] },
            ],
          },
        }),
      )

      // Assert
      expect(result).toEqual([
        {
          stepId: 'compile_ast:step-a',
          fieldCodes: ['team_0_member_0', 'team_0_member_1', 'team_1_member_0'],
          cleardownFieldCodes: [],
        },
      ])
    })

    it('should await async dynamic iterator field codes', async () => {
      // Arrange
      const functionRegistry = new FunctionRegistry()
      const dynamicCode = createGeneratorFunction('memberCode', [createReference(['@loop', '0', 'index0'])])
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

      const localCompiler = new StepFieldInventoryCompiler({ functionRegistry })

      // Act
      const source = localCompiler.generateSource(steps)
      const compiled = localCompiler.compile(steps)
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
