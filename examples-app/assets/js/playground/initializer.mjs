export class PlaygroundInitializer {
  static editorModule = undefined

  constructor(root = document) {
    this.root = root
  }

  start() {
    this.root.querySelectorAll('script[type="application/json"][data-playground]').forEach(script => {
      if (script.dataset.initialized) {
        return
      }
      script.dataset.initialized = 'true'
      this.mount(script)
    })
  }

  async mount(script) {
    const container = document.createElement('div')
    const status = document.createElement('p')
    status.setAttribute('role', 'status')
    status.textContent = 'Loading playground…'
    container.append(status)
    script.after(container)

    try {
      const config = JSON.parse(script.textContent)
      this.validate(config)
      const [files, { mountPlayground }] = await Promise.all([
        this.loadFiles(config),
        PlaygroundInitializer.editorModule ??= this.loadEditor(),
      ])
      await mountPlayground(container, {
        title: config.title,
        entryFile: config.entry,
        startPath: config.start,
        files,
      })
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Could not load playground'
      status.setAttribute('role', 'alert')
      container.replaceChildren(status)
    }
  }

  validate(config) {
    if (!config || typeof config.title !== 'string' || typeof config.base !== 'string' ||
      !/^\/assets\/playground\/(?:[a-zA-Z0-9_-]+\/)+$/.test(config.base) ||
      typeof config.entry !== 'string' || typeof config.start !== 'string' ||
      !/^\/(?!\/)[^\\\s]*$/.test(config.start) || !Array.isArray(config.files) ||
      !config.files.length || !config.files.includes(config.entry) ||
      new Set(config.files).size !== config.files.length ||
      !config.files.every(file => typeof file === 'string' && file.endsWith('.ts') &&
        !/\.(test|spec|d)\.ts$/.test(file) &&
        file.split('/').every(part => /^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(part)))) {
      throw new Error('Invalid playground configuration')
    }
  }

  async loadFiles(config) {
    const files = await Promise.all(config.files.map(async name => {
      const response = await fetch(`${config.base}${name}`)
      if (!response.ok) {
        throw new Error(`Could not load playground file: ${name}`)
      }
      return [name, await response.text()]
    }))
    return Object.fromEntries(files)
  }

  async loadEditor() {
    const stylesheet = document.createElement('link')
    stylesheet.rel = 'stylesheet'
    stylesheet.href = '/assets/playground/editor.css'
    const loaded = new Promise((resolve, reject) => {
      stylesheet.onload = resolve
      stylesheet.onerror = () => reject(new Error('Could not load playground styles'))
    })
    document.head.append(stylesheet)
    const [editor] = await Promise.all([
      import( '/assets/playground/editor.js'),
      loaded,
    ])
    return editor
  }
}
