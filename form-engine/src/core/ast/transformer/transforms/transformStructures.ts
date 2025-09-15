import {
  isCollectionBlockDefinition,
  isCompositeBlockDefinition,
  isFieldBlockDefinition,
} from '@form-engine/form/typeguards/structures'
import { transformProperties } from '@form-engine/core/ast/transformer/transformToAst'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { BlockASTNode, JourneyASTNode, StepASTNode } from '@form-engine/core/types/structures.type'

/**
 * Transform Block node: UI components that render in steps
 * Determines block category and preserves variant for rendering
 */
export function transformBlock(json: any, path: string[]): BlockASTNode {
  // Destructure to separate type from actual properties
  const { variant, type, ...dataProperties } = json
  // Convert all properties to Map, transforming nested nodes
  const properties = transformProperties(dataProperties, [...path, 'block', variant])

  // Classify block for AST traversal optimization
  let blockType: 'basic' | 'field' | 'collection' | 'composite'

  if (isFieldBlockDefinition(json)) {
    blockType = 'field'
  } else if (isCollectionBlockDefinition(json)) {
    blockType = 'collection'
  } else if (isCompositeBlockDefinition(json)) {
    blockType = 'composite'
  } else {
    blockType = 'basic'
  }

  return {
    type: ASTNodeType.BLOCK,
    variant,
    blockType,
    properties,
    raw: json,
  }
}

/**
 * Transform Step node: Single page within a journey
 * Contains blocks and transitions for user interaction
 */
export function transformStep(json: any, path: string[]): StepASTNode {
  // Destructure to separate type from actual properties
  const { type, ...dataProperties } = json
  // Properties include blocks[], onLoad, onAccess, onSubmission
  const properties = transformProperties(dataProperties, [...path, 'step'])

  return {
    type: ASTNodeType.STEP,
    properties,
    raw: json,
  }
}

/**
 * Transform Journey node: Top-level form container
 * Extracts properties and recursively transforms nested steps/children
 */
export function transformJourney(json: any, path: string[]): JourneyASTNode {
  // Destructure to separate type from actual properties
  const { type, ...dataProperties } = json
  // Convert all properties to Map, transforming nested nodes
  const properties = transformProperties(dataProperties, [...path, 'journey'])

  return {
    type: ASTNodeType.JOURNEY,
    properties,
    raw: json,
  }
}
