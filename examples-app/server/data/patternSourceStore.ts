import { getResolvedCodePanels } from '../journeys/forge-developer-guide/sections/patterns/shared/patternStep'

export interface PatternSourceFile {
  path: string
  source: string
}

export default class PatternSourceStore {
  getDemo(patternName: string): PatternSourceFile[] {
    const panels = getResolvedCodePanels().get(patternName)

    if (!panels) {
      return []
    }

    return panels.map(panel => ({ path: panel.label, source: panel.source }))
  }
}
