import express from 'express'
import { JourneyDefinition } from '@form-engine/form/types/structures.type'
import type { FormEngineOptions } from '@form-engine/core/FormEngine'
import { FormInstanceDependencies } from '@form-engine/core/types/engine.type'
import CompiledAST from '@form-engine/core/ast/CompiledAST'

export default class FormInstance {
  private readonly router: express.Router

  private readonly compiledAst: CompiledAST

  constructor(
    formConfiguration: JourneyDefinition,
    private readonly dependencies: FormInstanceDependencies,
    private readonly options?: Partial<FormEngineOptions>,
  ) {
    this.compiledAst = this.compileFormAst(formConfiguration)
  }

  private compileFormAst(formConfiguration: JourneyDefinition) {
    return CompiledAST.createFrom(formConfiguration)
  }
}
