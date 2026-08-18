import { BlockType, ExpressionType, IteratorType } from '../../../../authoring/types/enums'
import type { ASTNode } from '../../../chassis/contracts/ast/engine.type'
import type { IterateASTNode } from '../../../chassis/contracts/ast/expressions.type'
import type { TemplateValue } from '../../../chassis/contracts/ast/template.type'
import ASTNodeIndex from '../../../chassis/compilation/ast/ast-state/ASTNodeIndex'
import { NodeIDGenerator } from '../../../chassis/compilation/ast/ast-state/NodeIDGenerator'
import { ASTTestFactory } from '../../../chassis/compilation/ast/testing-helpers/ASTTestFactory'
import { compileTemplate } from '../../../chassis/compilation/ast/nodes/template'
import ComponentRegistry from '../../../chassis/registries/ComponentRegistry'
import FunctionRegistry from '../../../chassis/registries/FunctionRegistry'
import ForgeUnregisteredComponentError from '../../../errors/ForgeUnregisteredComponentError'
import { buildComponent } from '../../../../components/utils/buildComponent'
import { validateRegisteredComponents } from './validateRegisteredComponents'
import type { ASTValidationContext } from './types'

function buildContext(nodes: ASTNode[], registeredVariants: string[]): ASTValidationContext {
  const nodeIndex = new ASTNodeIndex()
  nodes.forEach(node => nodeIndex.register(node.id, node))

  const componentRegistry = new ComponentRegistry()

  if (registeredVariants.length > 0) {
    componentRegistry.registerMany(registeredVariants.map(variant => buildComponent(variant, () => `<${variant} />`)))
  }

  return {
    nodeIndex,
    functionRegistry: new FunctionRegistry(),
    componentRegistry,
  }
}

function compileBlockTemplate(variant: string): TemplateValue {
  const block = ASTTestFactory.block(variant, BlockType.FIELD).withCode('field').build()

  return compileTemplate(block, new NodeIDGenerator())
}

function iterateNodeWithYield(yieldTemplate: TemplateValue): IterateASTNode {
  return ASTTestFactory.expression<IterateASTNode>(ExpressionType.ITERATE)
    .withProperty('input', ASTTestFactory.reference(['answers', 'items']))
    .withProperty('iterator', { type: IteratorType.MAP, yieldTemplate })
    .build()
}

describe('validateRegisteredComponents', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  it('should return no errors when a registered block has a known variant', () => {
    // Arrange
    const block = ASTTestFactory.block('text', BlockType.FIELD).withCode('field1').build()
    const context = buildContext([block], ['text'])

    // Act
    const errors = validateRegisteredComponents(context)

    // Assert
    expect(errors).toHaveLength(0)
  })

  it('should return an error when a registered block has an unknown variant', () => {
    // Arrange
    const block = ASTTestFactory.block('missing', BlockType.FIELD).withCode('field1').build()
    const context = buildContext([block], [])

    // Act
    const errors = validateRegisteredComponents(context)

    // Assert
    expect(errors).toHaveLength(1)
    expect(errors[0]).toBeInstanceOf(ForgeUnregisteredComponentError)
    expect((errors[0] as ForgeUnregisteredComponentError).variant).toBe('missing')
  })

  it('should return no errors when an iterator yieldTemplate block has a registered variant', () => {
    // Arrange
    const iterateNode = iterateNodeWithYield(compileBlockTemplate('text'))
    const context = buildContext([iterateNode], ['text'])

    // Act
    const errors = validateRegisteredComponents(context)

    // Assert
    expect(errors).toHaveLength(0)
  })

  it('should return an error when an iterator yieldTemplate block has an unregistered variant', () => {
    // Arrange
    const iterateNode = iterateNodeWithYield(compileBlockTemplate('missing'))
    const context = buildContext([iterateNode], [])

    // Act
    const errors = validateRegisteredComponents(context)

    // Assert
    expect(errors).toHaveLength(1)
    expect(errors[0]).toBeInstanceOf(ForgeUnregisteredComponentError)
    expect((errors[0] as ForgeUnregisteredComponentError).variant).toBe('missing')
  })

  it('should return no errors when an iterator template contains no blocks', () => {
    // Arrange
    const templateWithoutBlocks = compileTemplate(
      ASTTestFactory.reference(['@scope', '0', 'name']),
      new NodeIDGenerator(),
    )
    const iterateNode = iterateNodeWithYield(templateWithoutBlocks)
    const context = buildContext([iterateNode], [])

    // Act
    const errors = validateRegisteredComponents(context)

    // Assert
    expect(errors).toHaveLength(0)
  })
})
