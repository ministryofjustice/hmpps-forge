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
          this.addWatchFile(file)
        })
      })
    },
    writeBundle() {
      patterns.forEach(pattern => {
        globSync(pattern).forEach(file => {
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

function typecheckPlugin({ prefix, watch = false } = {}) {
  let started = false

  function forward(stream) {
    stream.on('data', data => {
      data
        .toString()
        .split('\n')
        .filter(Boolean)
        .forEach(line => process.stderr.write(`${prefix ?? '[TSC]'} ${line}\n`))
    })
  }

  return {
    name: 'typecheck',
    buildStart() {
      if (started) {
        return
      }

      started = true

      const args = watch
        ? ['tsgo', '--noEmit', '--pretty', '--watch', '--preserveWatchOutput']
        : ['tsgo', '--noEmit', '--pretty']

      const child = spawn('npx', args, {
        stdio: ['inherit', 'pipe', 'pipe'],
      })

      forward(child.stdout)
      forward(child.stderr)
    },
  }
}

module.exports = { cleanPlugin, copyPlugin, manifestPlugin, typecheckPlugin }
