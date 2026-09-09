const { rolldown, watch } = require('rolldown')
const { spawn } = require('node:child_process')
const { createServer } = require('node:http')
const { setTimeout: delay } = require('node:timers/promises')
const { styleText } = require('node:util')

const { getAppConfig, getAssetsConfig, liveReloadPort } = require('./configs')

const prefix = styleText(['bold', 'magenta'], '[Rolldown]')
const nodePrefix = styleText(['bold', 'green'], '[Node]')

class ServerManager {
  constructor(healthUrl) {
    this.healthUrl = healthUrl
    this.serverProcess = null
  }

  async restart() {
    await this.stopServer()
    const serverProcess = this.startServer()
    await this.waitUntilHealthy(serverProcess)
  }

  async stopServer() {
    if (!this.serverProcess) {
      return
    }

    const serverProcess = this.serverProcess
    const isAlive = serverProcess.exitCode === null && serverProcess.signalCode === null

    if (isAlive) {
      await new Promise(resolve => {
        serverProcess.once('exit', resolve)
        serverProcess.kill()
      })
    }

    if (this.serverProcess === serverProcess) {
      this.serverProcess = null
    }
  }

  startServer() {
    const serverProcess = spawn(
      'node',
      ['--inspect=0.0.0.0', '--enable-source-maps', 'dist/server.js'],
      { stdio: ['inherit', 'pipe', 'pipe'] },
    )

    this.serverProcess = serverProcess
    serverProcess.stdout?.on('data', data => {
      data
        .toString()
        .split('\n')
        .filter(Boolean)
        .forEach(line => process.stdout.write(`${nodePrefix} ${line}\n`))
    })

    serverProcess.stderr?.on('data', data => {
      data
        .toString()
        .split('\n')
        .filter(Boolean)
        .forEach(line => process.stderr.write(`${nodePrefix} ${line}\n`))
    })

    return serverProcess
  }

  async waitUntilHealthy(serverProcess) {
    const deadline = Date.now() + 15_000

    while (Date.now() < deadline) {
      if (serverProcess.exitCode !== null || serverProcess.signalCode !== null) {
        throw new Error('Server exited before becoming healthy')
      }

      try {
        const response = await fetch(this.healthUrl, { signal: AbortSignal.timeout(500) })

        if (response.ok) {
          return
        }
      } catch {
        // The server is still starting.
      }

      await delay(100)
    }

    throw new Error(`Server did not become healthy at ${this.healthUrl}`)
  }
}

class LiveReloadServer {
  constructor(port) {
    this.port = port
    this.clients = new Set()
    this.server = createServer((request, response) => this.handleRequest(request, response))
  }

  async start() {
    await new Promise((resolve, reject) => {
      this.server.once('error', reject)
      this.server.listen(this.port, '0.0.0.0', () => {
        this.server.off('error', reject)
        resolve()
      })
    })

    process.stderr.write(`${prefix} 🔄 Live reload listening on port ${this.port}\n`)
  }

  reload() {
    const message = `event: reload\ndata: ${Date.now()}\n\n`

    this.clients.forEach(client => client.write(message))
  }

  handleRequest(request, response) {
    const pathname = new URL(request.url, 'http://localhost').pathname

    if (request.method !== 'GET' || pathname !== '/events') {
      response.writeHead(404).end()

      return
    }

    response.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream',
    })
    response.write('retry: 250\n\n')
    this.clients.add(response)

    request.once('close', () => this.clients.delete(response))
  }
}

class DevelopmentRuntime {
  constructor(serverManager, liveReloadServer, debounceMs = 100) {
    this.serverManager = serverManager
    this.liveReloadServer = liveReloadServer
    this.debounceMs = debounceMs
    this.activeBuilds = 0
    this.canRestart = false
    this.hasBuildFailure = false
    this.restartRequested = false
    this.restartTimer = null
    this.restartPromise = Promise.resolve()
  }

  enableRestarts() {
    this.canRestart = true

    if (this.restartRequested && this.activeBuilds === 0) {
      this.scheduleRestart()
    }
  }

  buildStarted() {
    if (this.activeBuilds === 0) {
      this.hasBuildFailure = false
    }

    this.activeBuilds += 1

    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }
  }

  buildCompleted() {
    this.finishBuild()
    this.requestRestart()
  }

  buildFailed() {
    this.hasBuildFailure = true
    this.restartRequested = false
    this.finishBuild()
  }

  requestRestart() {
    this.restartRequested = true

    if (!this.canRestart || this.activeBuilds > 0 || this.hasBuildFailure) {
      return
    }

    this.scheduleRestart()
  }

  scheduleRestart() {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
    }

    this.restartTimer = setTimeout(() => {
      this.restartTimer = null
      this.restartRequested = false
      this.restartPromise = this.restartPromise
        .then(() => this.restartAndReload())
        .catch(error => process.stderr.write(`${prefix} ❌ Restart failed: ${error.message}\n`))
    }, this.debounceMs)
  }

  finishBuild() {
    this.activeBuilds = Math.max(0, this.activeBuilds - 1)

    if (
      this.activeBuilds === 0 &&
      this.restartRequested &&
      this.canRestart &&
      !this.hasBuildFailure
    ) {
      this.scheduleRestart()
    }
  }

  async restartAndReload() {
    if (this.activeBuilds > 0 || this.hasBuildFailure) {
      if (this.activeBuilds > 0) {
        this.restartRequested = true
      }

      return
    }

    process.stderr.write(`${prefix} 🔁 Restarting App...\n`)
    await this.serverManager.restart()

    if (this.activeBuilds > 0 || this.hasBuildFailure || this.restartRequested) {
      return
    }

    this.liveReloadServer.reload()
    process.stderr.write(`${prefix} ✅ App ready; browsers reloaded\n`)
  }
}

function startWatcher(config, buildName, developmentRuntime, onBuildComplete = () => {}) {
  const watcher = watch(config)

  watcher.on('event', event => {
    switch (event.code) {
      case 'BUNDLE_START':
        process.stderr.write(`${prefix} 🌀 Building ${buildName}...\n`)
        developmentRuntime.buildStarted()
        break

      case 'BUNDLE_END':
        process.stderr.write(`${prefix} 🚀 ${buildName} build complete! (${event.duration}ms)\n`)
        onBuildComplete()
        developmentRuntime.buildCompleted()
        break

      case 'ERROR':
        process.stderr.write(`${prefix} ❌ ${buildName} build error: ${event.error.message}\n`)
        developmentRuntime.buildFailed()
        break
    }
  })

  return watcher
}

async function main() {
  const isWatchMode = process.argv.includes('--watch')
  const appConfigs = getAppConfig()
  const assetsConfig = getAssetsConfig()

  if (isWatchMode) {
    process.stderr.write(`${prefix} 👀 Starting watchers...\n`)

    const appPort = process.env.PORT || 3000
    const liveReloadServer = new LiveReloadServer(liveReloadPort)
    const developmentRuntime = new DevelopmentRuntime(
      new ServerManager(`http://localhost:${appPort}/health`),
      liveReloadServer,
    )

    await liveReloadServer.start()
    appConfigs.forEach((config, index) => {
      startWatcher(config, 'App', developmentRuntime, () => {
        if (index === 0) {
          developmentRuntime.enableRestarts()
        }
      })
    })
    startWatcher(assetsConfig, 'Assets', developmentRuntime)
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
