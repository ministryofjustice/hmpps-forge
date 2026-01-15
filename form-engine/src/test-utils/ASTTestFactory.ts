// eslint-disable-next-line max-classes-per-file
import { BlockType, ExpressionType, FunctionType, PredicateType, TransitionType } from '@form-engine/form/types/enums'
import { AstNodeId, NodeId, PseudoNodeId } from '@form-engine/core/types/engine.type'
import {
  ExpressionASTNode,
  FunctionASTNode,
  PipelineASTNode,
  ReferenceASTNode,
  AccessTransitionASTNode,
  ActionTransitionASTNode,
  SubmitTransitionASTNode,
} from '@form-engine/core/types/expressions.type'
import { BlockASTNode, JourneyASTNode, StepASTNode } from '@form-engine/core/types/structures.type'
import { ASTNodeType } from '@form-engine/core/types/enums'
import {
  PseudoNodeType,
  PostPseudoNode,
  QueryPseudoNode,
  ParamsPseudoNode,
  DataPseudoNode,
  AnswerLocalPseudoNode,
  AnswerRemotePseudoNode,
} from '@form-engine/core/types/pseudoNodes.type'
import { PredicateASTNode } from '@form-engine/core/types/predicates.type'

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

  private static pseudoNodeNextId = 1

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

  /**
   * Get the next available pseudo node ID
   */
  static getPseudoId(category: string = 'compile_pseudo'): PseudoNodeId {
    const id = this.pseudoNodeNextId
    this.pseudoNodeNextId += 1

    return `${category}:${id}` as PseudoNodeId
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
   * Create a new TransitionBuilder for fluent transition construction
   */
  static transition(type: TransitionType): TransitionBuilder {
    return new TransitionBuilder(type)
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
   * Create a POST pseudo node
   */
  static postPseudoNode(baseFieldCode: string, fieldNodeId?: NodeId): PostPseudoNode {
    return {
      id: ASTTestFactory.getPseudoId(),
      type: PseudoNodeType.POST,
      properties: {
        baseFieldCode,
        fieldNodeId,
      },
    }
  }

  /**
   * Create a QUERY pseudo node
   */
  static queryPseudoNode(paramName: string): QueryPseudoNode {
    return {
      id: ASTTestFactory.getPseudoId(),
      type: PseudoNodeType.QUERY,
      properties: {
        paramName,
      },
    }
  }

  /**
   * Create a PARAMS pseudo node
   */
  static paramsPseudoNode(paramName: string): ParamsPseudoNode {
    return {
      id: ASTTestFactory.getPseudoId(),
      type: PseudoNodeType.PARAMS,
      properties: {
        paramName,
      },
    }
  }

  /**
   * Create a DATA pseudo node
   */
  static dataPseudoNode(baseProperty: string): DataPseudoNode {
    return {
      id: ASTTestFactory.getPseudoId(),
      type: PseudoNodeType.DATA,
      properties: {
        baseProperty,
      },
    }
  }

  /**
   * Create an ANSWER_LOCAL pseudo node
   */
  static answerLocalPseudoNode(baseFieldCode: string, fieldNodeId?: NodeId): AnswerLocalPseudoNode {
    return {
      id: ASTTestFactory.getPseudoId(),
      type: PseudoNodeType.ANSWER_LOCAL,
      properties: {
        baseFieldCode,
        fieldNodeId: fieldNodeId ?? ASTTestFactory.getId(),
      },
    }
  }

  /**
   * Create an ANSWER_REMOTE pseudo node
   */
  static answerRemotePseudoNode(baseFieldCode: string): AnswerRemotePseudoNode {
    return {
      id: ASTTestFactory.getPseudoId(),
      type: PseudoNodeType.ANSWER_REMOTE,
      properties: {
        baseFieldCode,
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
    this.properties.validate = validation
    return this
  }

  build(): BlockASTNode {
    const nodeId = this.id ?? ASTTestFactory.getId()

    return {
      type: ASTNodeType.BLOCK,
      id: nodeId,
      variant: this.variant,
      blockType: this.blockType,
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
        properties: this.properties,
      } as T
    }

    return {
      type: ASTNodeType.EXPRESSION,
      id: nodeId,
      expressionType: this.expressionType,
      properties: this.properties,
    } as T
  }
}

/**
 * Fluent builder for Transition nodes
 */
export class TransitionBuilder {
  private id?: string

  private properties: any = {}

  constructor(private transitionType: TransitionType) {}

  withId(id: string): this {
    this.id = id
    return this
  }

  withProperty(key: string, value: any): this {
    this.properties[key] = value
    return this
  }

  build(): AccessTransitionASTNode | ActionTransitionASTNode | SubmitTransitionASTNode {
    const nodeId = this.id ?? ASTTestFactory.getId()

    return {
      type: ASTNodeType.TRANSITION,
      id: nodeId,
      transitionType: this.transitionType,
      properties: this.properties,
    } as AccessTransitionASTNode | ActionTransitionASTNode | SubmitTransitionASTNode
  }
}
