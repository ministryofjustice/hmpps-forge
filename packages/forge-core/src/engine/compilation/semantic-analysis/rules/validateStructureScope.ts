import { ExpressionType } from '../../../../authoring/types/enums'
import { ASTNodeType } from '../../../contracts/ast/enums'
import type { AstNodeId } from '../../../contracts/ast/engine.type'
import type { IterateASTNode } from '../../../contracts/ast/expressions.type'
import ForgeConfigurationReferenceScopeError from '../../../errors/ForgeConfigurationReferenceScopeError'
import type { DSLSourceLocation } from '../../../diagnostics/sourceLocation.type'
import type { ASTValidationContext, ASTValidationRule } from './types'
import { walkTemplateValue } from './templateWalker'

function buildStepError(source: DSLSourceLocation | undefined): ForgeConfigurationReferenceScopeError {
  return new ForgeConfigurationReferenceScopeError({
    path: source?.path ? [...source.path] : [],
    message: 'Steps can only be defined in a journey steps array',
    code: 'step_outside_journey_steps',
    formattedPath: source?.formattedPath ?? 'unknown',
  })
}

function buildJourneyError(source: DSLSourceLocation | undefined): ForgeConfigurationReferenceScopeError {
  return new ForgeConfigurationReferenceScopeError({
    path: source?.path ? [...source.path] : [],
    message: 'Journeys can only be defined at the root or in a journey children array',
    code: 'journey_outside_journey_children',
    formattedPath: source?.formattedPath ?? 'unknown',
  })
}

function containsNode(entries: unknown, nodeId: AstNodeId): boolean {
  return Array.isArray(entries) && entries.some(entry => entry?.id === nodeId)
}

export const validateStructureScope: ASTValidationRule = (context: ASTValidationContext): readonly Error[] => {
  const { nodeIndex } = context
  const errors: Error[] = []

  nodeIndex.findByType(ASTNodeType.STEP).forEach(node => {
    const parent = node.parent

    if (!parent || parent.type !== ASTNodeType.JOURNEY || !containsNode(parent.properties?.steps, node.id)) {
      errors.push(buildStepError(node.diagnostics?.source))
    }
  })

  nodeIndex.findByType(ASTNodeType.JOURNEY).forEach(node => {
    const parent = node.parent

    if (!parent) {
      return
    }

    if (parent.type !== ASTNodeType.JOURNEY || !containsNode(parent.properties?.children, node.id)) {
      errors.push(buildJourneyError(node.diagnostics?.source))
    }
  })

  const iterateNodes = nodeIndex.findByType<IterateASTNode>(ExpressionType.ITERATE)

  iterateNodes.forEach(iterateNode => {
    const { iterator } = iterateNode.properties

    const templates = [iterator.yieldTemplate, iterator.predicateTemplate].filter(
      (t): t is NonNullable<typeof t> => t !== undefined,
    )

    templates.forEach(template => {
      walkTemplateValue(template, {
        onTemplateNode(templateNode, templateMetadata) {
          if (templateNode.originalType === ASTNodeType.STEP) {
            errors.push(buildStepError(templateMetadata))

            return
          }

          if (templateNode.originalType === ASTNodeType.JOURNEY) {
            errors.push(buildJourneyError(templateMetadata))
          }
        },
      })
    })
  })

  return errors
}
