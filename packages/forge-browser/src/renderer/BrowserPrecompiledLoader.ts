import nunjucks from 'nunjucks'

/** Loads precompiled templates using relative names within the supplied registry. */
export default class BrowserPrecompiledLoader extends nunjucks.PrecompiledLoader {
  constructor(templates: Record<string, object>) {
    // Nunjucks accepts a template map, but its community typings declare an array.
    super(templates as unknown as ConstructorParameters<typeof nunjucks.PrecompiledLoader>[0])
  }

  /** Nunjucks' inherited resolver uses Node's path module, which its browser build stubs out. */
  override resolve(from: string, to: string): string {
    const segments = from.split('/').slice(0, -1)

    to.split('/').forEach(segment => {
      if (segment === '..') {
        segments.pop()
      } else if (segment !== '.' && segment !== '') {
        segments.push(segment)
      }
    })

    return segments.join('/')
  }
}
