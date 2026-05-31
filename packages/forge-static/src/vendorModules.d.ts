declare module 'rollup-plugin-sass' {
  import type { RolldownPlugin } from 'rolldown'

  const sassPlugin: (options: Record<string, unknown>) => RolldownPlugin
  export default sassPlugin
}

declare module 'sass-embedded' {
  const sass: unknown
  export default sass
}
