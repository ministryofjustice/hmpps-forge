// eslint-disable-next-line max-classes-per-file
import {
  BlockType,
  ExpressionType,
  FunctionType,
  OutcomeType,
  PredicateType,
  HookType,
} from '../../../../../authoring/types/enums'
import { AstNodeId } from '../../../contracts/ast/engine.type'
import {
  ExpressionASTNode,
  FunctionASTNode,
  PipelineASTNode,
  ReferenceASTNode,
  AccessHookASTNode,
  SubmitHookASTNode,
  RedirectOutcomeASTNode,
  ThrowErrorOutcomeASTNode,
} from '../../../contracts/ast/expressions.type'
import { BlockASTNode, JourneyASTNode, StepASTNode } from '../../../contracts/ast/structures.type'
import { ASTNodeType } from '../../../contracts/ast/enums'
import { PredicateASTNode } from '../../../contracts/ast/predicates.type'
import { FORMAT_STRING_GENERATOR_NAME } from '../../../../../built-ins/functions/generators/formatGenerators'
import type { ASTNodeDiagnostics, DSLPathSegment } from '../../../../../shared/diagnostics/sourceLocation.type'

type PredicateBuilderConfig = {
  subject?: ExpressionASTNode
  condition?: ExpressionASTNode
  negate?: boolean
  operands?: (ExpressionASTNode | PredicateASTNode)[]
  operand?: ExpressionASTNode | PredicateASTNode
}

/**
 * Test data factory for creating AST nodes with fluent builders and automatic ID generation.
 *
 * @example
 * // Using fluent builders
 * const form = ASTTestFactory.journey()
 *   .withStep(step => step
 *     .withBlock('TextInput', 'field', block => block
 *       .withCode('firstName')
 *       .withLabel('First Name')
 *     )
 *   )
 *   .build()
 *
 * // Using preset scenarios
 * const form = ASTTestFactory.scenarios.withValidation()
 *
 * // Using test utilities
 * const nodeCount = ASTTestFactory.utils.countNodes(form)
 * const node = ASTTestFactory.utils.findNodeById(form, 5)
 */
export class ASTTestFactory {
  private static astNodeNextId = 1

  /**
   * Reset the ID counter (useful between tests)
   */
  static resetIds(): void {
    this.astNodeNextId = 1
  }

  /**
   * Get the next available ID in NodeIDGenerator format
   * @param category - The ID category (defaults to 'compile_ast' for tests)
   */
  static getId(category: string = 'compile_ast'): AstNodeId {
    const id = this.astNodeNextId
    this.astNodeNextId += 1

    return `${category}:${id}` as AstNodeId
  }

  static diagnostics(path: readonly DSLPathSegment[] = []): ASTNodeDiagnostics {
    return {
      source: {
        path,
        formattedPath: path.length > 0 ? path.map(segment => String(segment)).join('.') : 'root',
      },
    }
  }

  /**
   * Create a new JourneyBuilder for fluent journey construction
   */
  static journey(): JourneyBuilder {
    return new JourneyBuilder()
  }

  /**
   * Create a new StepBuilder for fluent step construction
   */
  static step(): StepBuilder {
    return new StepBuilder()
  }

  /**
   * Create a new BlockBuilder for fluent block construction
   */
  static block(variant: string, blockType: BlockType): BlockBuilder {
    return new BlockBuilder(variant, blockType)
  }

  /**
   * Create a new ExpressionBuilder for fluent expression construction
   */
  static expression<T = ExpressionASTNode>(type: ExpressionType | FunctionType | PredicateType): ExpressionBuilder<T> {
    return new ExpressionBuilder<T>(type)
  }

  /**
   * Create a new HookBuilder for fluent hook construction
   */
  static hook(type: HookType): HookBuilder {
    return new HookBuilder(type)
  }

  static reference(path: string[]): ReferenceASTNode {
    return ASTTestFactory.expression(ExpressionType.REFERENCE).withPath(path).build() as ReferenceASTNode
  }

  static functionExpression(type: FunctionType, name: string, args: unknown[] = []): FunctionASTNode {
    return ASTTestFactory.expression<FunctionASTNode>(type)
      .withProperty('name', name)
      .withProperty('arguments', args)
      .build()
  }

  static formatExpression(template: string, args: unknown[] = []): FunctionASTNode {
    return ASTTestFactory.functionExpression(FunctionType.GENERATOR, FORMAT_STRING_GENERATOR_NAME, [template, ...args])
  }

  static pipelineExpression(config: { input: unknown; steps: unknown[] }): PipelineASTNode {
    return ASTTestFactory.expression<PipelineASTNode>(ExpressionType.PIPELINE)
      .withProperty('input', config.input)
      .withProperty('steps', config.steps)
      .build()
  }

  static predicate(type: PredicateType, config: PredicateBuilderConfig = {}): PredicateASTNode {
    const builder = ASTTestFactory.expression<PredicateASTNode>(type)

    if (config.subject) {
      builder.withSubject(config.subject)
    }

    if (config.condition) {
      builder.withProperty('condition', config.condition)
    }

    if (config.negate !== undefined) {
      builder.withProperty('negate', config.negate)
    }

    if (config.operands) {
      builder.withProperty('operands', config.operands)
    }

    if (config.operand) {
      builder.withProperty('operand', config.operand)
    }

    return builder.build()
  }

  /**
   * Create a redirect outcome AST node
   */
  static redirectOutcome(config: {
    when?: ExpressionASTNode | PredicateASTNode
    goto: string | ExpressionASTNode
  }): RedirectOutcomeASTNode {
    return {
      id: ASTTestFactory.getId(),
      type: ASTNodeType.OUTCOME,
      outcomeType: OutcomeType.REDIRECT,
      diagnostics: ASTTestFactory.diagnostics(),
      properties: {
        when: config.when,
        goto: config.goto,
      },
    }
  }

  /**
   * Create a throw error outcome AST node
   */
  static throwErrorOutcome(config: {
    when?: ExpressionASTNode | PredicateASTNode
    status: number
    message: string | ExpressionASTNode
  }): ThrowErrorOutcomeASTNode {
    return {
      id: ASTTestFactory.getId(),
      type: ASTNodeType.OUTCOME,
      outcomeType: OutcomeType.THROW_ERROR,
      diagnostics: ASTTestFactory.diagnostics(),
      properties: {
        when: config.when,
        status: config.status,
        message: config.message,
      },
    }
  }
}

/**
 * Fluent builder for Journey nodes
 */
export class JourneyBuilder {
  private id?: string

  private properties: any = {}

  withId(id: string): this {
    this.id = id
    return this
  }

  withProperty(key: string, value: any): this {
    this.properties[key] = value
    return this
  }

  withCode(code: string): this {
    this.properties.code = code
    return this
  }

  withTitle(title: string): this {
    this.properties.title = title
    return this
  }

  withStep(configFn?: (builder: StepBuilder) => StepBuilder): this {
    const stepBuilder = new StepBuilder()
    const step = configFn ? configFn(stepBuilder).build() : stepBuilder.build()

    if (!this.properties.steps) {
      this.properties.steps = []
    }

    this.properties.steps.push(step)

    return this
  }

  withMetadata(metadata: Record<string, any>): this {
    this.properties.metadata = metadata
    return this
  }

  build(): JourneyASTNode {
    const nodeId = this.id ?? ASTTestFactory.getId()

    return {
      type: ASTNodeType.JOURNEY,
      id: nodeId,
      diagnostics: ASTTestFactory.diagnostics(),
      properties: this.properties,
    } as JourneyASTNode
  }
}

/**
 * Fluent builder for Step nodes
 */
export class StepBuilder {
  private id?: string

  private properties: any = {}

  withId(id: string): this {
    this.id = id
    return this
  }

  withProperty(key: string, value: any): this {
    this.properties[key] = value
    return this
  }

  withPath(path: string): this {
    this.properties.path = path
    return this
  }

  withCode(code: string): this {
    this.properties.code = code
    return this
  }

  withBlock(variant: string, blockType: BlockType, configFn?: (builder: BlockBuilder) => BlockBuilder): this {
    const blockBuilder = new BlockBuilder(variant, blockType)
    const block = configFn ? configFn(blockBuilder).build() : blockBuilder.build()

    if (!this.properties.blocks) {
      this.properties.blocks = []
    }

    this.properties.blocks.push(block)

    return this
  }

  withTitle(title: string): this {
    this.properties.title = title
    return this
  }

  withDescription(description: string): this {
    this.properties.description = description
    return this
  }

  build(): StepASTNode {
    const nodeId = this.id ?? ASTTestFactory.getId()

    return {
      type: ASTNodeType.STEP,
      id: nodeId,
      diagnostics: ASTTestFactory.diagnostics(),
      properties: this.properties,
    } as StepASTNode
  }
}

/**
 * Fluent builder for Block nodes
 */
export class BlockBuilder {
  private id?: string

  private properties: any = {}

  constructor(
    private variant: string,
    private blockType: BlockType,
  ) {}

  withId(id: string): this {
    this.id = id
    return this
  }

  withProperty(key: string, value: any): this {
    this.properties[key] = value
    return this
  }

  withCode(code: string | ExpressionASTNode): this {
    this.properties.code = code
    return this
  }

  withLabel(label: string): this {
    this.properties.label = label
    return this
  }

  withValue(value: any): this {
    this.properties.value = value
    return this
  }

  withValidation(validation: ExpressionASTNode): this {
    this.properties.validWhen = validation
    return this
  }

  build(): BlockASTNode {
    const nodeId = this.id ?? ASTTestFactory.getId()

    return {
      type: ASTNodeType.BLOCK,
      id: nodeId,
      variant: this.variant,
      blockType: this.blockType,
      diagnostics: ASTTestFactory.diagnostics(),
      properties: this.properties,
    } as BlockASTNode
  }
}

/**
 * Fluent builder for Expression nodes
 */
export class ExpressionBuilder<T = ExpressionASTNode> {
  private id?: string

  private properties: any = {}

  constructor(private expressionType: ExpressionType | FunctionType | PredicateType) {}

  withId(id: string): this {
    this.id = id
    return this
  }

  withProperty(key: string, value: any): this {
    this.properties[key] = value
    return this
  }

  withPath(path: any[]): this {
    this.properties.path = path
    return this
  }

  withSubject(subject: ExpressionASTNode): this {
    this.properties.subject = subject
    return this
  }

  withCondition(condition: any): this {
    this.properties.condition = condition
    return this
  }

  withPredicate(predicate: ExpressionASTNode | PredicateASTNode): this {
    this.properties.predicate = predicate
    return this
  }

  withThenValue(value: any): this {
    this.properties.thenValue = value
    return this
  }

  withElseValue(value: any): this {
    this.properties.elseValue = value
    return this
  }

  withSteps(steps: any[]): this {
    this.properties.steps = steps
    return this
  }

  build(): T {
    const nodeId = this.id ?? ASTTestFactory.getId()
    const isPredicate = Object.values(PredicateType).includes(this.expressionType as PredicateType)

    if (isPredicate) {
      return {
        type: ASTNodeType.PREDICATE,
        id: nodeId,
        predicateType: this.expressionType,
        diagnostics: ASTTestFactory.diagnostics(),
        properties: this.properties,
      } as T
    }

    return {
      type: ASTNodeType.EXPRESSION,
      id: nodeId,
      expressionType: this.expressionType,
      diagnostics: ASTTestFactory.diagnostics(),
      properties: this.properties,
    } as T
  }
}

/**
 * Fluent builder for Hook nodes
 */
export class HookBuilder {
  private id?: string

  private properties: any = {}

  constructor(private hookType: HookType) {}

  withId(id: string): this {
    this.id = id
    return this
  }

  withProperty(key: string, value: any): this {
    this.properties[key] = value
    return this
  }

  build(): AccessHookASTNode | SubmitHookASTNode {
    const nodeId = this.id ?? ASTTestFactory.getId()

    return {
      type: ASTNodeType.HOOK,
      id: nodeId,
      hookType: this.hookType,
      diagnostics: ASTTestFactory.diagnostics(),
      properties: this.properties,
    } as AccessHookASTNode | SubmitHookASTNode
  }
}
