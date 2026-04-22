import { vi } from 'vitest'
import type { Mocked } from 'vitest'

import { CompilationDependencies } from '../../compilation/CompilationDependencies'
import ThunkEvaluationContext from '../../compilation/thunks/ThunkEvaluationContext'
import ThunkCacheManager from '../../compilation/thunks/ThunkCacheManager'
import { ThunkInvocationAdapter, ThunkResult } from '../../compilation/thunks/types'
import { ASTNodeType } from '../../types/enums'
import { IterateASTNode } from '../../types/expressions.type'
import { AnswerLocalPseudoNode, PostPseudoNode, PseudoNodeType } from '../../types/pseudoNodes.type'
import { FieldBlockASTNode } from '../../types/structures.type'
import { BlockType, ExpressionType, IteratorType } from '../../../authoring/types/enums'
import { ASTTestFactory } from '../../../testing/ASTTestFactory'
import { createMockInvoker } from '../../../testing/thunkTestHelpers'
import { NodeIDGenerator } from '../../compilation/id-generators/NodeIDGenerator'
import TemplateFactory from '../../nodes/template/TemplateFactory'
import { TemplateValue } from '../../types/template.type'
import type { StepRequest } from '../../../framework/types/request.type'
import type { StepResponse, CookieMutation, CookieOptions } from '../../../framework/types/response.type'
import RuntimeExpansionService from './RuntimeExpansionService'
import BlockHandler from '../../nodes/structures/block/BlockHandler'
import AnswerLocalHandler from '../../nodes/pseudo-nodes/answer-local/AnswerLocalHandler'
import PostHandler from '../../nodes/pseudo-nodes/post/PostHandler'

function createRequest(post: Record<string, string | string[]> = {}): StepRequest {
  return {
    method: Object.keys(post).length > 0 ? 'POST' : 'GET',
    url: 'http://localhost/test',
    baseUrl: '',
    location: {
      origin: 'http://localhost',
      href: 'http://localhost/test',
      pathname: '/test',
      basePath: '',
    },
    getHeader: () => undefined,
    getAllHeaders: () => ({}),
    getCookie: () => undefined,
    getAllCookies: () => ({}),
    getParam: () => undefined,
    getParams: () => ({}),
    getQuery: () => undefined,
    getAllQuery: () => ({}),
    getPost: (name: string) => post[name],
    getAllPost: () => post,
    getSession: () => undefined,
    getState: () => undefined,
    getAllState: () => ({}),
  }
}

function createResponse(): StepResponse {
  const responseHeaders = new Map<string, string>()
  const responseCookies = new Map<string, CookieMutation>()

  return {
    setHeader: (name: string, value: string) => {
      responseHeaders.set(name, value)
    },
    getHeader: (name: string) => responseHeaders.get(name),
    getAllHeaders: () => responseHeaders,
    setCookie: (name: string, value: string, options?: CookieOptions) => {
      responseCookies.set(name, { value, options })
    },
    getCookie: (name: string) => responseCookies.get(name),
    getAllCookies: () => responseCookies,
  }
}

function createSuccessResult<T>(value: T): ThunkResult<T> {
  return {
    value,
    metadata: {
      source: 'test',
      timestamp: Date.now(),
    },
  }
}

function createContext(post: Record<string, string | string[]> = {}): {
  compilationDependencies: CompilationDependencies
  context: ThunkEvaluationContext
} {
  const compilationDependencies = new CompilationDependencies()
  const context = new ThunkEvaluationContext(
    compilationDependencies,
    {
      componentRegistry: {} as any,
      frameworkAdapter: {} as any,
      functionRegistry: {
        get: vi.fn(),
        getAll: vi.fn().mockReturnValue(new Map()),
        has: vi.fn().mockReturnValue(false),
      } as any,
      logger: console,
    },
    new ThunkCacheManager(),
    createRequest(post),
    createResponse(),
  )

  return { compilationDependencies, context }
}

function createTemplateValue(value: unknown): TemplateValue {
  return new TemplateFactory(new NodeIDGenerator()).compile(value)
}

function createIterateNode(id: string, input: unknown, yieldTemplate: TemplateValue): IterateASTNode {
  return ASTTestFactory.expression<IterateASTNode>(ExpressionType.ITERATE)
    .withId(id)
    .withProperty('input', input)
    .withProperty('iterator', {
      type: IteratorType.MAP,
      yieldTemplate,
    })
    .build()
}

function registerRootIterate(
  iterateNode: IterateASTNode,
  compilationDependencies: CompilationDependencies,
  insideStep = true,
): void {
  compilationDependencies.nodeRegistry.register(iterateNode.id, iterateNode)
  compilationDependencies.astNodeTree.addNode(iterateNode.id, undefined, undefined, iterateNode.type)

  if (insideStep) {
    compilationDependencies.metadataRegistry.set(iterateNode.id, 'isDescendantOfStep', true)
  }
}

describe('RuntimeExpansionService', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('expandIteratorRoots()', () => {
    it('should register runtime nodes without evaluating render-only field properties', async () => {
      // Arrange
      const service = new RuntimeExpansionService()
      const { compilationDependencies, context } = createContext()
      const iterateNode = createIterateNode(
        'compile_ast:1',
        [{ id: 1 }],
        createTemplateValue({
          type: ASTNodeType.BLOCK,
          variant: 'text-input',
          blockType: BlockType.FIELD,
          properties: {
            code: 'fullName',
            defaultValue: {
              type: ASTNodeType.EXPRESSION,
              expressionType: ExpressionType.REFERENCE,
              properties: {
                path: ['data', 'user', 'name'],
              },
            },
          },
        }),
      )
      const invoker = {
        invoke: vi.fn(),
        invokeSync: vi.fn(),
      } as unknown as Mocked<ThunkInvocationAdapter>

      registerRootIterate(iterateNode, compilationDependencies)

      // Act
      await service.expandIteratorRoots([iterateNode.id], context, invoker)

      // Assert
      const fields = compilationDependencies.nodeRegistry.findByType<FieldBlockASTNode>(BlockType.FIELD)

      expect(fields).toHaveLength(1)
      expect(fields[0].properties.code).toBe('fullName')
      expect(invoker.invoke).not.toHaveBeenCalled()
      expect((fields[0].properties.defaultValue as { expressionType: string }).expressionType).toBe(
        ExpressionType.REFERENCE,
      )
    })

    it('should resolve dynamic field codes for fields nested inside array yields', async () => {
      // Arrange
      const service = new RuntimeExpansionService()
      const { compilationDependencies, context } = createContext()
      const iterateNode = createIterateNode(
        'compile_ast:2',
        [{ name: 'Alice' }, { name: 'Bob' }],
        createTemplateValue([
          {
            type: ASTNodeType.BLOCK,
            variant: 'text-input',
            blockType: BlockType.FIELD,
            properties: {
              code: {
                type: ASTNodeType.EXPRESSION,
                expressionType: ExpressionType.REFERENCE,
                properties: {
                  path: ['@scope', '0', '@index'],
                },
              },
            },
          },
        ]),
      )
      const invoker = {
        invoke: vi.fn(async (_nodeId: string, expansionContext: ThunkEvaluationContext) => {
          const currentScope = expansionContext.scope.at(-1)

          return createSuccessResult(`memberName_${String(currentScope?.['@index'])}`)
        }),
        invokeSync: vi.fn(),
      } as unknown as Mocked<ThunkInvocationAdapter>

      registerRootIterate(iterateNode, compilationDependencies)

      // Act
      await service.expandIteratorRoots([iterateNode.id], context, invoker)

      // Assert
      const fields = compilationDependencies.nodeRegistry.findByType<FieldBlockASTNode>(BlockType.FIELD)

      expect(fields).toHaveLength(2)
      expect(fields.map(field => field.properties.code)).toEqual(['memberName_0', 'memberName_1'])
    })

    it('should recursively expand nested iterators and remain idempotent per request', async () => {
      // Arrange
      const service = new RuntimeExpansionService()
      const { compilationDependencies, context } = createContext()
      const iterateNode = createIterateNode(
        'compile_ast:3',
        [{ id: 1 }],
        createTemplateValue({
          type: ASTNodeType.EXPRESSION,
          expressionType: ExpressionType.ITERATE,
          properties: {
            input: [{ child: true }],
            iterator: {
              type: IteratorType.MAP,
              yieldTemplate: {
                type: ASTNodeType.BLOCK,
                variant: 'text-input',
                blockType: BlockType.FIELD,
                properties: {
                  code: {
                    type: ASTNodeType.EXPRESSION,
                    expressionType: ExpressionType.REFERENCE,
                    properties: {
                      path: ['@scope', '0', '@index'],
                    },
                  },
                },
              },
            },
          },
        }),
      )
      const invoker = {
        invoke: vi.fn(async (_nodeId: string, expansionContext: ThunkEvaluationContext) => {
          const currentScope = expansionContext.scope.at(-1)

          return createSuccessResult(`nested_${String(currentScope?.['@index'])}`)
        }),
        invokeSync: vi.fn(),
      } as unknown as Mocked<ThunkInvocationAdapter>

      registerRootIterate(iterateNode, compilationDependencies)

      // Act
      const firstExpandedIds = await service.expandIteratorRoots([iterateNode.id], context, invoker)
      const firstCallCount = vi.mocked(invoker.invoke).mock.calls.length
      const secondExpandedIds = await service.expandIteratorRoots([iterateNode.id], context, invoker)

      // Assert
      const fields = compilationDependencies.nodeRegistry.findByType<FieldBlockASTNode>(BlockType.FIELD)

      expect(firstExpandedIds).toHaveLength(2)
      expect(secondExpandedIds).toEqual(firstExpandedIds)
      expect(vi.mocked(invoker.invoke)).toHaveBeenCalledTimes(firstCallCount)
      expect(fields.map(field => field.properties.code)).toEqual(['nested_0'])
    })

    it('should preserve raw POST values for iterator-generated fields after formatter processing', async () => {
      // Arrange
      const service = new RuntimeExpansionService()
      const { compilationDependencies, context } = createContext({ member_0: '  hello  ' })
      const iterateNode = createIterateNode(
        'compile_ast:4',
        [{ id: 1 }],
        createTemplateValue({
          type: ASTNodeType.BLOCK,
          variant: 'text-input',
          blockType: BlockType.FIELD,
          properties: {
            code: {
              type: ASTNodeType.EXPRESSION,
              expressionType: ExpressionType.REFERENCE,
              properties: {
                path: ['@scope', '0', '@index'],
              },
            },
            formatters: [
              {
                type: ASTNodeType.EXPRESSION,
                expressionType: ExpressionType.REFERENCE,
                properties: {
                  path: ['data', 'formatter'],
                },
              },
            ],
          },
        }),
      )
      const expansionInvoker = {
        invoke: vi.fn(async () => createSuccessResult('member_0')),
        invokeSync: vi.fn(),
      } as unknown as Mocked<ThunkInvocationAdapter>

      registerRootIterate(iterateNode, compilationDependencies)
      await service.expandIteratorRoots([iterateNode.id], context, expansionInvoker)

      const fieldNode = compilationDependencies.nodeRegistry.findByType<FieldBlockASTNode>(BlockType.FIELD)[0]
      const answerLocalPseudoNode = compilationDependencies.nodeRegistry.findByType<AnswerLocalPseudoNode>(
        PseudoNodeType.ANSWER_LOCAL,
      )[0]
      const postPseudoNode = compilationDependencies.nodeRegistry.findByType<PostPseudoNode>(PseudoNodeType.POST)[0]
      const formatterNodeId = (fieldNode.properties.formatters?.[0] as { id: string }).id
      const answerLocalHandler = new AnswerLocalHandler(answerLocalPseudoNode.id, answerLocalPseudoNode)
      const postHandler = new PostHandler(postPseudoNode.id, postPseudoNode)
      const blockHandler = new BlockHandler(fieldNode.id, fieldNode)
      const evaluationInvoker = createMockInvoker()

      evaluationInvoker.invoke.mockImplementation(async (nodeId, evaluationContext) => {
        if (nodeId === answerLocalPseudoNode.id) {
          return answerLocalHandler.evaluate(evaluationContext, evaluationInvoker)
        }

        if (nodeId === postPseudoNode.id) {
          return postHandler.evaluate(evaluationContext)
        }

        if (nodeId === formatterNodeId) {
          const currentValue = evaluationContext.scope.at(-1)?.['@value']

          return createSuccessResult(String(currentValue).trim())
        }

        if (nodeId === fieldNode.id) {
          return blockHandler.evaluate(evaluationContext, evaluationInvoker)
        }

        return createSuccessResult(undefined)
      })

      evaluationInvoker.invokeSync.mockImplementation((nodeId, evaluationContext) => {
        if (nodeId === postPseudoNode.id) {
          return postHandler.evaluateSync(evaluationContext)
        }

        if (nodeId === formatterNodeId) {
          const currentValue = evaluationContext.scope.at(-1)?.['@value']

          return createSuccessResult(String(currentValue).trim())
        }

        return createSuccessResult(undefined)
      })

      // Act
      const answerResult = await evaluationInvoker.invoke(answerLocalPseudoNode.id, context)
      const blockResult = await blockHandler.evaluate(context, evaluationInvoker)

      // Assert
      expect(answerResult.value).toBe('hello')
      expect(context.global.answers.member_0.mutations).toEqual([
        { value: '  hello  ', source: 'post' },
        { value: 'hello', source: 'processed' },
      ])
      expect((blockResult.value as FieldBlockASTNode).properties.value).toBe('  hello  ')
    })
  })
})
