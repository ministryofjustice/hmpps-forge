import { StepValidityResult } from './validation/StepValidityAnalyzer'
import { NavigationEvaluation } from './navigation/NavigationEvaluation.type'
import { StepFieldInventory } from './validation/StepFieldInventory.type'

export default class RuntimeArtifacts {
  private navigation?: NavigationEvaluation

  private stepFieldInventory?: StepFieldInventory[]

  private stepValidity?: StepValidityResult

  getNavigation(): NavigationEvaluation | undefined {
    return this.navigation
  }

  requireNavigation(): NavigationEvaluation {
    if (!this.navigation) {
      throw new Error('Navigation has not been analyzed')
    }

    return this.navigation
  }

  setNavigation(navigation: NavigationEvaluation): void {
    this.navigation = navigation
  }

  getStepFieldInventory(): StepFieldInventory[] | undefined {
    return this.stepFieldInventory
  }

  requireStepFieldInventory(): StepFieldInventory[] {
    if (!this.stepFieldInventory) {
      throw new Error('Step field inventory has not been analyzed')
    }

    return this.stepFieldInventory
  }

  setStepFieldInventory(stepFieldInventory: StepFieldInventory[]): void {
    this.stepFieldInventory = stepFieldInventory
  }

  getStepValidity(): StepValidityResult | undefined {
    return this.stepValidity
  }

  setStepValidity(result: StepValidityResult): void {
    this.stepValidity = result
  }
}
