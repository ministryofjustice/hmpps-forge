import * as path from 'node:path'

export interface BundleAssetsOptions {
  jsEntry: string
  outputDir: string
  sassLoadPaths?: string[]
  minify?: boolean
}

export interface BundleAssetsResult {
  cssPath: string
  jsPath: string
}

export async function bundleAssets(options: BundleAssetsOptions): Promise<BundleAssetsResult> {
  const { rolldown } = await import('rolldown')
  const sassPlugin = (await import('rollup-plugin-sass')).default
  const sass = (await import('sass-embedded')).default

  const cssOutputPath = path.join(options.outputDir, 'css/index.css')

  const bundle = await rolldown({
    input: options.jsEntry,
    platform: 'browser',
    plugins: [
      sassPlugin({
        runtime: sass,
        api: 'modern',
        output: cssOutputPath,
        options: {
          style: options.minify ? 'compressed' : 'expanded',
          loadPaths: options.sassLoadPaths ?? [],
          silenceDeprecations: ['import'],
          quietDeps: true,
        },
      }),
    ],
  })

  await bundle.write({
    dir: options.outputDir,
    format: 'iife',
    minify: options.minify,
    entryFileNames: 'js/[name].js',
  })

  await bundle.close()

  return {
    cssPath: cssOutputPath,
    jsPath: path.join(options.outputDir, 'js/index.js'),
  }
}
