interface ValidationError {
  message: string
  blockCode?: string
  /** Document anchor of the failing block instance; falls back to blockCode when absent. */
  anchor?: string
}

interface ErrorListItem {
  text: string
  href?: string
}

interface NunjucksGlobalContext {
  ctx: {
    fieldValidationErrors?: ValidationError[]
    domainValidationErrors?: ValidationError[]
  }
}

export function getErrorSummaryList(this: NunjucksGlobalContext): ErrorListItem[] {
  const fieldErrors = this.ctx.fieldValidationErrors ?? []
  const domainErrors = this.ctx.domainValidationErrors ?? []
  const seen = new Set<string>()

  return (
    [...domainErrors, ...fieldErrors]
      .filter(error => {
        const key = error.anchor ?? error.blockCode ?? error.message

        return !seen.has(key) && seen.add(key)
      })
      .map(error => {
        const anchor = error.anchor ?? error.blockCode

        return {
          text: error.message,
          href: anchor ? `#${anchor}` : undefined,
        }
      })
  )
}
