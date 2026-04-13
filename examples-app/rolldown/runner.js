const { rolldown, watch } = require('rolldown')
const { spawn } = require('node:child_process')
const { styleText } = require('node:util')

const { getAppConfig, getAssetsConfig } = require('./configs')

const prefix = styleText(['bold', 'magenta'], '[Rolldown]')
const nodePrefix = styleText(['bold', 'green'], '[Node]')

// --- Server manager ---

class ServerManager {
  constructor() {
    this.serverProcess = null
  }

  async restart() {
    if (this.serverProcess) {
      const isAlive = this.serverProcess.exitCode === null && this.serverProcess.signalCode === null

      if (isAlive) {
        await new Promise(resolve => {
          this.serverProcess.once('exit', resolve)
          this.serverProcess.kill()
        })
      }

      this.serverProcess = null
    }

    this.serverProcess = spawn('node', ['--inspect=0.0.0.0', '--enable-source-maps', 'dist/server.js'], {
      stdio: ['inherit', 'pipe', 'pipe'],
    })

    this.serverProcess.stdout?.on('data', data => {
      data
        .toString()
        .split('\n')
        .filter(Boolean)
        .forEach(line => process.stdout.write(`${nodePrefix} ${line}\n`))
    })

    this.serverProcess.stderr?.on('data', data => {
      data
        .toString()
        .split('\n')
        .filter(Boolean)
        .forEach(line => process.stderr.write(`${nodePrefix} ${line}\n`))
    })
  }
}

// --- Main ---

async function main() {
  const isWatchMode = process.argv.includes('--watch')
  const appConfigs = getAppConfig()
  const assetsConfig = getAssetsConfig()

  if (isWatchMode) {
    process.stderr.write(`${prefix} 👀 Starting watchers...\n`)

    const serverManager = new ServerManager()

    // App watchers (server + worker as separate builds)
    appConfigs.forEach(config => {
      const watcher = watch(config)

      watcher.on('event', event => {
        switch (event.code) {
          case 'BUNDLE_START':
            process.stderr.write(`${prefix} 🌀 Building App...\n`)
            break

          case 'BUNDLE_END':
            process.stderr.write(`${prefix} 🚀 App build complete! (${event.duration}ms)\n`)
            serverManager.restart()
            break

          case 'ERROR':
            process.stderr.write(`${prefix} ❌ Build error: ${event.error.message}\n`)
            break
        }
      })
    })

    // Assets watcher
    const assetsWatcher = watch(assetsConfig)

    assetsWatcher.on('event', event => {
      switch (event.code) {
        case 'BUNDLE_START':
          process.stderr.write(`${prefix} 🌀 Building Assets...\n`)
          break

        case 'BUNDLE_END':
          process.stderr.write(`${prefix} 🚀 Assets build complete! (${event.duration}ms)\n`)
          break

        case 'ERROR':
          process.stderr.write(`${prefix} ❌ Assets error: ${event.error.message}\n`)
          break
      }
    })
  } else {
    process.stderr.write(`${prefix} ⚙️  Starting build...\n`)

    const bundles = await Promise.all([
      ...appConfigs.map(config => rolldown(config)),
      rolldown(assetsConfig),
    ])

    await Promise.all(
      bundles.map((bundle, i) => {
        const output = i < appConfigs.length ? appConfigs[i].output : assetsConfig.output

        return bundle.write(output).then(() => bundle.close())
      }),
    )

    process.stderr.write(`${prefix} 🚀 Build complete!\n`)
  }
}

main().catch(err => {
  process.stderr.write(`${err.stack || err}\n`)
  process.exit(1)
})
