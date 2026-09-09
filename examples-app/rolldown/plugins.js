const path = require('node:path')
const fs = require('node:fs')
const { globSync } = require('node:fs')
const { spawn } = require('node:child_process')

function cleanPlugin(dir, { exclude = [], excludeExtensions = [] } = {}) {
  function cleanDir(target) {
    if (!fs.existsSync(target)) {
      return
    }

    fs.readdirSync(target, { withFileTypes: true }).forEach(entry => {
      if (exclude.includes(entry.name)) {
        return
      }

      const fullPath = path.join(target, entry.name)

      if (entry.isDirectory()) {
        cleanDir(fullPath)
      } else if (excludeExtensions.some(ext => entry.name.endsWith(ext))) {
        return
      } else {
        fs.rmSync(fullPath, { force: true })
      }
    })
  }

  return {
    name: 'clean',
    buildStart() {
      cleanDir(dir)
    },
  }
}

function copyPlugin({ patterns, baseDir, outDir }) {
  return {
    name: 'copy-assets',
    buildStart() {
      patterns.forEach(pattern => {
        globSync(pattern).forEach(file => {
          if (!fs.statSync(file).isFile()) {
            return
          }

          this.addWatchFile(file)
        })
      })
    },
    writeBundle() {
      patterns.forEach(pattern => {
        globSync(pattern).forEach(file => {
          if (!fs.statSync(file).isFile()) {
            return
          }

          const dest = path.join(outDir, path.relative(baseDir, file))

          fs.mkdirSync(path.dirname(dest), { recursive: true })
          fs.copyFileSync(file, dest)
        })
      })
    },
  }
}

function manifestPlugin(outDir) {
  function collectFiles(dir, base = '') {
    const entries = []

    fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
      const relative = path.join(base, entry.name)

      if (entry.isDirectory()) {
        entries.push(...collectFiles(path.join(dir, entry.name), relative))
      } else if (!entry.name.endsWith('.map') && entry.name !== 'manifest.json') {
        entries.push(relative)
      }
    })

    return entries
  }

  return {
    name: 'manifest',
    writeBundle() {
      const manifest = {}

      collectFiles(outDir).forEach(file => {
        const key = `/assets/${file}`
        manifest[key] = key
        const mapFile = `${file}.map`

        if (fs.existsSync(path.join(outDir, mapFile))) {
          manifest[`/assets/${mapFile}`] = `/assets/${mapFile}`
        }
      })

      fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
    },
  }
}

function typecheckPlugin({ prefix, debounceMs = 300 } = {}) {
  const label = prefix ?? '[TSC]'
  let child = null
  let pending = null

  function run() {
    if (pending) {
      clearTimeout(pending)
    }

    pending = setTimeout(() => {
      pending = null

      if (child) {
        child.kill()
        child = null
      }

      const startTime = Date.now()
      process.stderr.write(`${label} Typechecking...\n`)

      child = spawn('npx', ['tsgo', '--noEmit', '--pretty'], {
        stdio: ['inherit', 'pipe', 'pipe'],
      })

      let hasErrors = false

      child.stdout?.on('data', data => {
        hasErrors = true
        data
          .toString()
          .split('\n')
          .filter(Boolean)
          .forEach(line => process.stderr.write(`${label} ${line}\n`))
      })

      child.stderr?.on('data', data => {
        hasErrors = true
        data
          .toString()
          .split('\n')
          .filter(Boolean)
          .forEach(line => process.stderr.write(`${label} ${line}\n`))
      })

      child.on('error', err => {
        process.stderr.write(`${label} Failed to start: ${err.message}\n`)
        child = null
      })

      child.on('exit', code => {
        const duration = Date.now() - startTime

        if (code === 0) {
          process.stderr.write(`${label} ${hasErrors ? 'Done' : 'No errors'} (${duration}ms)\n`)
        } else {
          process.stderr.write(`${label} Exited with code ${code} (${duration}ms)\n`)
        }

        child = null
      })
    }, debounceMs)
  }

  return {
    name: 'typecheck',
    buildStart() {
      run()
    },
  }
}

function liveReloadPlugin({ port }) {
  return {
    name: 'live-reload-client',
    intro() {
      return `
const liveReloadKey = Symbol.for('hmpps-forge.live-reload')

if (!globalThis[liveReloadKey]) {
  const liveReloadUrl = new URL('http://localhost:${port}/events')
  liveReloadUrl.hostname = window.location.hostname

  const liveReloadSource = new EventSource(liveReloadUrl)
  liveReloadSource.addEventListener('reload', () => window.location.reload())
  globalThis[liveReloadKey] = liveReloadSource
}
`
    },
  }
}

/**
 * Serves a virtual module that registers precompiled Nunjucks templates into
 * `window.nunjucksPrecompiled`, where nunjucks-slim's PrecompiledLoader reads
 * them. `templates` entries are paths relative to `root` - a single `.njk`
 * file precompiles just that template, a folder precompiles every `.njk`
 * inside it. Either way names come out root-relative (so under govuk-frontend's
 * dist they are exactly the names components render, e.g.
 * 'govuk/components/input/template.njk'); named files precompile under their
 * given name. A template a component renders but the list misses fails loudly
 * at runtime - the demo env has no fallback loader.
 */
function nunjucksPrecompilePlugin({ virtualId, root, templates = [], files = [] }) {
  const resolvedId = `\0${virtualId}`

  function collectTemplateFiles(entry) {
    const fullPath = path.join(root, entry)

    if (!fs.statSync(fullPath).isDirectory()) {
      return [entry]
    }

    return fs
      .readdirSync(fullPath, { recursive: true, withFileTypes: true })
      .filter(dirent => dirent.isFile() && dirent.name.endsWith('.njk'))
      .map(dirent => path.relative(root, path.join(dirent.parentPath, dirent.name)))
  }

  return {
    name: 'nunjucks-precompile',
    resolveId(id) {
      return id === virtualId ? resolvedId : null
    },
    load(id) {
      if (id !== resolvedId) {
        return null
      }

      const nunjucks = require('nunjucks')
      const templateSources = templates.flatMap(collectTemplateFiles).map(name => {
        const file = path.join(root, name)

        this.addWatchFile(file)

        return nunjucks.precompileString(fs.readFileSync(file, 'utf8'), { name })
      })
      const fileSources = files.map(({ file, name }) => {
        this.addWatchFile(file)

        return nunjucks.precompileString(fs.readFileSync(file, 'utf8'), { name })
      })

      return [...templateSources, ...fileSources].join('\n')
    },
  }
}

module.exports = { cleanPlugin, copyPlugin, liveReloadPlugin, manifestPlugin, typecheckPlugin, nunjucksPrecompilePlugin }
