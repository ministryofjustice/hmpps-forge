import express from 'express'
import { JourneyDefinition } from '@form-engine/form/types/structures.type'
import type { FormEngineOptions } from '@form-engine/core/FormEngine'
import { CompiledAST, FormInstanceDependencies } from '@form-engine/core/types/engine.type'

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

  private compileFormAst(_formConfiguration: JourneyDefinition): CompiledAST {
    // TODO: Run through compilation stages
    return {}
  }
}
