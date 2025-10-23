import { transformToAst } from '@form-engine/core/ast/transformer/transformToAst'
import { resolveSelfReferences } from '@form-engine/core/ast/normalizers/ResolveSelfReferences'
import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import RegistrationTraverser from '@form-engine/core/ast/registration/RegistrationTraverser'
import { JourneyASTNode } from '@form-engine/core/types/structures.type'
import { JourneyDefinition } from '@form-engine/form/types/structures.type'
import { addSelfValueToFields } from '@form-engine/core/ast/normalizers/AddSelfValueToFields'
import { attachParentNodes } from '@form-engine/core/ast/normalizers/AttachParentNodes'
import { convertFormattersToPipeline } from '@form-engine/core/ast/normalizers/ConvertFormattersToPipeline'
import { attachValidationBlockCode } from '@form-engine/core/ast/normalizers/AttachValidationBlockCode'

export default class CompiledAST {
  private constructor(
    private readonly root: JourneyASTNode,
    private readonly nodeRegistry: NodeRegistry,
  ) {}

  static createFrom(json: JourneyDefinition): CompiledAST {
    // Phase 1A: Transform JSON to AST
    const root = transformToAst(json) as JourneyASTNode

    // Phase 1B: Normalize AST
    attachParentNodes(root)
    addSelfValueToFields(root)
    resolveSelfReferences(root)
    attachValidationBlockCode(root)
    convertFormattersToPipeline(root)

    // Phase 2: Register nodes with IDs
    const nodeRegistry = RegistrationTraverser.buildRegistry(root)

    // TODO: Add all other compile stages

    return new CompiledAST(root as JourneyASTNode, nodeRegistry)
  }

  // Getters for accessing internal state
  getRoot(): JourneyASTNode {
    return this.root
  }

  getNodeRegistry(): NodeRegistry {
    return this.nodeRegistry
  }
}
