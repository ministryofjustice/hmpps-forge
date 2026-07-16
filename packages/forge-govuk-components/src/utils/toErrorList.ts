interface ValidationError {
  message: string
  blockCode?: string
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
        const key = error.blockCode ?? error.message

        return !seen.has(key) && seen.add(key)
      })
      .map(error => ({
        text: error.message,
        href: error.blockCode ? `#${error.blockCode}` : undefined,
      }))
  )
}
