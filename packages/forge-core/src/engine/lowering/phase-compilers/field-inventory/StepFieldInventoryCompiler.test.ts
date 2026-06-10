import { ASTTestFactory } from '../../../ast/testing-helpers/ASTTestFactory'
import { ASTNodeType } from '../../../contracts/ast/enums'
import { BlockType, ExpressionType, FunctionType, IteratorType } from '../../../../authoring/types/enums'
import { FieldBlockASTNode } from '../../../contracts/ast/structures.type'
import { FunctionASTNode, IterateASTNode, ReferenceASTNode } from '../../../contracts/ast/expressions.type'
import { TemplateValue } from '../../../contracts/ast/template.type'
import TemplateFactory from '../../../ast/nodes/template/TemplateFactory'
import { NodeIDGenerator } from '../../../ast/ast-state/NodeIDGenerator'
import FunctionRegistry from '../../../registries/FunctionRegistry'
import ComponentRegistry from '../../../registries/ComponentRegistry'
import type { CompilationDependencies } from '../../compilationDependencies.type'
import type { FieldInventoryStepSource } from '../../../contracts/plans/compilationPlan.type'
import type { ReachabilityContext } from '../../../contracts/compiled/phaseContexts.type'
import StepFieldInventoryCompiler from './StepFieldInventoryCompiler'

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

function createStepSource(overrides: Partial<FieldInventoryStepSource> = {}): FieldInventoryStepSource {
  return {
    stepId: 'compile_ast:1',
    fieldBlocks: [],
    iterateNodes: [],
    cleardownFieldCodes: [],
    ...overrides,
  }
}

function createContext(
  functionRegistry: FunctionRegistry,
  overrides: Record<string, unknown> = {},
): ReachabilityContext {
  return {
    answers: {},
    data: {},
    session: {},
    params: {},
    query: {},
    request: { method: 'GET' },
    conditions: functionRegistry,
    ...overrides,
  } as unknown as ReachabilityContext
}

describe('StepFieldInventoryCompiler', () => {
  let compiler: StepFieldInventoryCompiler
  const dependencies: CompilationDependencies = {
    functionRegistry: new FunctionRegistry(),
    componentRegistry: new ComponentRegistry(),
  }

  beforeEach(() => {
    ASTTestFactory.resetIds()
    compiler = new StepFieldInventoryCompiler(dependencies)
  })

  describe('compileStepFieldCodes()', () => {
    it('should return undefined when the step has no field blocks or iterators', () => {
      // Arrange
      const step = createStepSource()

      // Act
      const compiled = compiler.compileStepFieldCodes(step)

      // Assert
      expect(compiled).toBeUndefined()
    })

    it('should collect de-duplicated static field codes', async () => {
      // Arrange
      const functionRegistry = new FunctionRegistry()
      const step = createStepSource({
        fieldBlocks: [createFieldBlock('firstName'), createFieldBlock('lastName'), createFieldBlock('firstName')],
      })
      const compiled = compiler.compileStepFieldCodes(step)

      // Act
      const result = await compiled!(createContext(functionRegistry))

      // Assert
      expect(result).not.toBeInstanceOf(Promise)
      expect(result).toEqual(['firstName', 'lastName'])
    })

    it('should collect dynamic registered field codes', () => {
      // Arrange
      const functionRegistry = new FunctionRegistry()
      const dynamicCode = createGeneratorFunction('fieldCode')
      const step = createStepSource({ fieldBlocks: [createFieldBlock(dynamicCode)] })

      functionRegistry.register({
        fieldCode: {
          name: 'fieldCode',
          isAsync: false,
          evaluate: () => 'firstName',
        },
      })

      const localCompiler = new StepFieldInventoryCompiler({
        functionRegistry,
        componentRegistry: new ComponentRegistry(),
      })
      const compiled = localCompiler.compileStepFieldCodes(step)

      // Act
      const result = compiled!(createContext(functionRegistry))

      // Assert
      expect(result).toEqual(['firstName'])
    })

    it('should compile MAP iterator template field codes without runtime expansion', () => {
      // Arrange
      const functionRegistry = new FunctionRegistry()
      const dynamicCode = createGeneratorFunction('memberCode', [createReference(['@loop', '0', 'index0'])])
      const template = createTemplate([createFieldBlock(dynamicCode)])
      const iterateNode = createIterateNode(createReference(['data', 'members']), template)
      const step = createStepSource({
        fieldBlocks: [createFieldBlock('staticField')],
        iterateNodes: [iterateNode],
      })

      functionRegistry.register({
        memberCode: {
          name: 'memberCode',
          isAsync: false,
          evaluate: (index: unknown) => `member_${String(index)}`,
        },
      })

      const localCompiler = new StepFieldInventoryCompiler({
        functionRegistry,
        componentRegistry: new ComponentRegistry(),
      })
      const compiled = localCompiler.compileStepFieldCodes(step)

      // Act
      const result = compiled!(
        createContext(functionRegistry, {
          data: { members: [{ name: 'Ada' }, { name: 'Grace' }] },
        }),
      )

      // Assert
      expect(result).toEqual(['staticField', 'member_0', 'member_1'])
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
      const step = createStepSource({ iterateNodes: [iterateNode] })

      functionRegistry.register({
        memberCode: {
          name: 'memberCode',
          isAsync: false,
          evaluate: (teamIndex: unknown, memberIndex: unknown) =>
            `team_${String(teamIndex)}_member_${String(memberIndex)}`,
        },
      })

      const localCompiler = new StepFieldInventoryCompiler({
        functionRegistry,
        componentRegistry: new ComponentRegistry(),
      })
      const compiled = localCompiler.compileStepFieldCodes(step)

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
      expect(result).toEqual(['team_0_member_0', 'team_0_member_1', 'team_1_member_0'])
    })

    it('should await async dynamic iterator field codes', async () => {
      // Arrange
      const functionRegistry = new FunctionRegistry()
      const dynamicCode = createGeneratorFunction('memberCode', [createReference(['@loop', '0', 'index0'])])
      const template = createTemplate([createFieldBlock(dynamicCode)])
      const iterateNode = createIterateNode(createReference(['data', 'members']), template)
      const step = createStepSource({ iterateNodes: [iterateNode] })

      functionRegistry.register({
        memberCode: {
          name: 'memberCode',
          isAsync: true,
          evaluate: async (index: unknown) => `member_${String(index)}`,
        },
      })

      const localCompiler = new StepFieldInventoryCompiler({
        functionRegistry,
        componentRegistry: new ComponentRegistry(),
      })
      const compiled = localCompiler.compileStepFieldCodes(step)

      // Act
      const pending = compiled!(
        createContext(functionRegistry, {
          data: { members: [{ name: 'Ada' }] },
        }),
      )
      const result = await pending

      // Assert
      expect(pending).toBeInstanceOf(Promise)
      expect(result).toEqual(['member_0'])
    })
  })
})
