import 'monaco-editor/editor/contrib/suggest/browser/suggestController.js'
import 'monaco-editor/editor/contrib/hover/browser/hoverContribution.js'
import 'monaco-editor/editor/contrib/parameterHints/browser/parameterHints.js'
import 'monaco-editor/editor/contrib/find/browser/findController.js'
import * as monaco from 'monaco-editor/editor/editor.api.js'
import 'monaco-editor/languages/definitions/typescript/register.js'
import * as typescript from 'monaco-editor/language/typescript/monaco.contribution.js'
import '../../scss/playground.scss'
import editorMarkup from './editor.html'

class PlaygroundEditor {
  static typeScriptReady = undefined

  models = new Map()
  viewStates = new Map()
  sources = {}
  lastRunSources = new Map()
  lastRun = undefined
  frame = undefined
  frameReady = false
  busy = false
  expanded = false
  inertElements = []

  constructor(root, instanceId, config) {
    this.sources = config.files
    this.entryFile = config.entryFile
    this.startPath = config.startPath
    root.setAttribute('aria-label', `${config.title} playground`)
    this.modelRoot = `file:///playground/${instanceId}/`
    this.root = root
    this.status = root.querySelector('[data-status]')
    this.runButton = root.querySelector('[data-run]')
    this.restartButton = root.querySelector('[data-restart]')
    this.expandButton = root.querySelector('[data-expand]')
  }

  async start() {
    window.addEventListener('message', (event) => this.receiveMessage(event))
    this.createPreview()
    await (PlaygroundEditor.typeScriptReady ??= this.configureTypeScript())
    this.createModels()
    this.createEditor()
    this.bindControls()
    await this.run()
  }

  async configureTypeScript() {
    globalThis.MonacoEnvironment = {
      getWorker: (_moduleId, label) =>
        new Worker(
          `/assets/playground/${label === 'typescript' || label === 'javascript' ? 'ts' : 'editor'}.worker.js`,
          { type: 'module' },
        ),
    }
    const response = await fetch('/assets/playground/declarations.json')
    if (!response.ok) {
      throw new Error('Could not load Forge types')
    }
    const declarations = await response.json()
    const defaults = typescript.typescriptDefaults
    defaults.setCompilerOptions({
      target: typescript.ScriptTarget.ES2020,
      module: typescript.ModuleKind.CommonJS,
      moduleResolution: typescript.ModuleResolutionKind.NodeJs,
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      baseUrl: 'file:///',
      types: [],
      paths: {
        '@ministryofjustice/hmpps-forge/core/authoring': [
          'node_modules/@ministryofjustice/hmpps-forge/core/authoring/index.d.ts',
        ],
        '@ministryofjustice/hmpps-forge/core/components': [
          'node_modules/@ministryofjustice/hmpps-forge/core/components/index.d.ts',
        ],
        '@ministryofjustice/hmpps-forge/govuk-components': [
          'node_modules/@ministryofjustice/hmpps-forge/govuk-components/index.d.ts',
        ],
        '@ministryofjustice/hmpps-forge/*': [
          'node_modules/@ministryofjustice/hmpps-forge/*/index.d.ts',
        ],
        zod: ['node_modules/zod/index.d.ts'],
        nunjucks: ['node_modules/@types/nunjucks/index.d.ts'],
      },
    })
    defaults.setExtraLibs(
      Object.entries(declarations).map(([filePath, content]) => ({ filePath, content })),
    )
    defaults.setEagerModelSync(true)
  }

  createModels() {
    Object.entries(this.sources).forEach(([name, source]) => this.createFile(name, source))
  }

  createFile(name, source) {
    const model = monaco.editor.createModel(
      source,
      'typescript',
      monaco.Uri.parse(`${this.modelRoot}${name}`),
    )

    model.onDidChangeContent(() => this.updateEditStatus())
    this.models.set(name, model)

    const button = document.createElement('button')
    const dot = document.createElement('span')

    button.className = 'playground__tab'
    button.type = 'button'
    button.dataset.file = name
    button.setAttribute('aria-pressed', String(name === this.entryFile))
    button.textContent = name
    dot.className = 'playground__file-dot'
    dot.setAttribute('aria-hidden', 'true')
    button.append(dot)
    button.addEventListener('click', () => this.selectFile(name))
    this.root.querySelector('[data-tabs]').append(button)
  }

  addFile(event) {
    event.preventDefault()

    const input = this.root.querySelector('[data-file-name]')
    const name = input.value.trim()
    const segments = name.split('/')
    let error = ''

    if (
      !segments.every((segment) => /^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(segment)) ||
      !name.endsWith('.ts') ||
      name.endsWith('.d.ts')
    ) {
      error = 'Enter a TypeScript file path, such as steps/address.ts.'
    } else if (
      Array.from(this.models.keys()).some((existing) => existing.toLowerCase() === name.toLowerCase())
    ) {
      error = 'A file with this name already exists.'
    }

    if (error) {
      input.setCustomValidity(error)
      input.reportValidity()

      return
    }

    this.createFile(name, 'export {}\n')
    this.root.querySelector('[data-new-file-dialog]').close()
    this.selectFile(name)
    this.updateEditStatus()
    this.updateTabScroll()
    this.root.querySelector('[data-tabs]').lastElementChild.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    })
  }

  reset() {
    this.selectFile(this.entryFile)
    this.models.forEach((model, name) => {
      if (Object.hasOwn(this.sources, name)) {
        model.setValue(this.sources[name])

        return
      }

      this.viewStates.delete(model.uri.toString())
      model.dispose()
      this.models.delete(name)
    })
    this.root.querySelectorAll('[data-file]').forEach((button) => {
      if (!this.models.has(button.dataset.file)) {
        button.remove()
      }
    })
    this.updateTabScroll()
    this.run()
  }

  createEditor() {
    monaco.editor.defineTheme('forge-playground', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: 'F97583' },
        { token: 'string', foreground: 'D4DEE5' },
        { token: 'type.identifier', foreground: 'B392F0' },
        { token: 'identifier', foreground: 'D4DEE5' },
        { token: 'delimiter', foreground: 'C9D1D9' },
      ],
      colors: {
        'editor.background': '#1D2226',
        'editor.foreground': '#E6EDF3',
        'editorLineNumber.foreground': '#6E7781',
        'editorLineNumber.activeForeground': '#A7B1B9',
        'editor.lineHighlightBackground': '#2A3036',
        'editor.lineHighlightBorder': '#2A3036',
        'editor.selectionBackground': '#364F65',
        'editorCursor.foreground': '#E6EDF3',
      },
    })
    this.editor = monaco.editor.create(this.root.querySelector('[data-editor]'), {
      model: this.models.get(this.entryFile),
      automaticLayout: true,
      minimap: { enabled: false },
      theme: 'forge-playground',
      fontSize: 14,
      fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
      lineHeight: 23.1,
      guides: { indentation: false, highlightActiveIndentation: false },
      overviewRulerLanes: 0,
      lineDecorationsWidth: 1,
      lineNumbersMinChars: 4,
      renderLineHighlight: 'all',
      scrollBeyondLastLine: false,
      padding: { top: 16 },
      tabSize: 2,
      ariaLabel: 'Example TypeScript editor',
    })
    monaco.languages.registerCompletionItemProvider('typescript', {
      provideCompletionItems: (model, position, _context, token) =>
        this.provideImportCompletions(model, position, token),
      resolveCompletionItem: item => this.resolveImportCompletion(item),
    })
  }

  async provideImportCompletions(model, position, token) {
    const uri = model.uri.toString()
    const word = model.getWordUntilPosition(position)

    if (!uri.startsWith(this.modelRoot) || !word.word) {
      return { suggestions: [] }
    }

    const version = model.getVersionId()
    const offset = model.getOffsetAt(position)
    const getWorker = await typescript.getTypeScriptWorker()
    const worker = await getWorker(...Array.from(this.models.values(), file => file.uri))
    const entries = await worker.getImportCompletions(uri, offset)

    if (token.isCancellationRequested || model.isDisposed() || model.getVersionId() !== version) {
      return { suggestions: [] }
    }

    return {
      suggestions: entries.map(entry => ({
        label: {
          label: entry.name,
          description: entry.data?.fileName?.startsWith(this.modelRoot)
            ? entry.data.fileName.slice(this.modelRoot.length)
            : entry.source,
        },
        kind: monaco.languages.CompletionItemKind.Reference,
        insertText: entry.insertText ?? entry.name,
        sortText: entry.sortText,
        range: entry.replacementSpan
          ? this.completionRange(model, entry.replacementSpan)
          : new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
        uri,
        offset,
        entry,
      })),
    }
  }

  async resolveImportCompletion(item) {
    const model = monaco.editor.getModel(monaco.Uri.parse(item.uri))

    if (!model) {
      return item
    }

    const getWorker = await typescript.getTypeScriptWorker()
    const worker = await getWorker(model.uri)
    const details = await worker.getImportCompletionDetails(item.uri, item.offset, item.entry)

    // Accepting a suggestion closes the widget, but Monaco still needs its pending import edits.
    if (!details || model.isDisposed()) {
      return item
    }

    return {
      ...item,
      detail: details.displayParts?.map(part => part.text).join(''),
      documentation: { value: details.documentation?.map(part => part.text).join('') ?? '' },
      additionalTextEdits: (details.codeActions ?? []).flatMap(action => action.changes
        .filter(change => change.fileName === item.uri)
        .flatMap(change => change.textChanges.map(edit => ({
          range: this.completionRange(model, edit.span),
          text: edit.newText,
        })))),
    }
  }

  completionRange(model, span) {
    const start = model.getPositionAt(span.start)
    const end = model.getPositionAt(span.start + span.length)

    return new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column)
  }

  bindControls() {
    const dialog = this.root.querySelector('[data-new-file-dialog]')
    const input = this.root.querySelector('[data-file-name]')

    this.root.querySelector('[data-add-file]').addEventListener('click', () => {
      input.value = ''
      input.setCustomValidity('')
      dialog.showModal()
    })
    input.addEventListener('input', () => input.setCustomValidity(''))
    dialog.querySelector('form').addEventListener('submit', (event) => this.addFile(event))
    this.root.querySelector('[data-cancel-file]').addEventListener('click', () => dialog.close())
    this.runButton.addEventListener('click', () => this.run())
    this.restartButton.addEventListener('click', () => this.restart())
    this.root.querySelector('[data-reset]').addEventListener('click', () => this.reset())
    this.expandButton.disabled = false
    this.expandButton.addEventListener('click', () => this.setExpanded(!this.expanded))
    this.root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !event.defaultPrevented && !dialog.open && this.expanded) {
        event.preventDefault()
        this.setExpanded(false)
      }
    })
    this.editor.addAction({
      id: 'run-example',
      label: 'Run example',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => this.run(),
    })
    const tabs = this.root.querySelector('[data-tabs]')
    this.root.querySelectorAll('[data-scroll-tabs]').forEach((button) => {
      button.addEventListener('click', () =>
        tabs.scrollBy({ left: Number(button.dataset.scrollTabs) * 220, behavior: 'smooth' }),
      )
    })
    tabs.addEventListener('scroll', () => this.updateTabScroll())
    new ResizeObserver(() => this.updateTabScroll()).observe(tabs)
    this.updateTabScroll()
  }

  setExpanded(expanded) {
    if (expanded) {
      this.scrollPosition = { left: window.scrollX, top: window.scrollY }
    }

    this.expanded = expanded
    this.setGuideInert(expanded)
    this.root.classList.toggle('playground--expanded', expanded)
    document.documentElement.classList.toggle('playground-expanded', expanded)
    const label = expanded ? 'Back to guide' : 'Expand playground'
    this.expandButton.setAttribute('aria-label', label)
    this.expandButton.setAttribute('aria-pressed', String(expanded))
    this.expandButton.title = label
    this.editor.layout()
    this.expandButton.focus({ preventScroll: true })

    if (!expanded) {
      window.scrollTo({ ...this.scrollPosition, behavior: 'instant' })
    }
  }

  setGuideInert(inert) {
    if (!inert) {
      this.inertElements.forEach(element => { element.inert = false })
      this.inertElements = []

      return
    }

    // Keep the iframe in place: moving it into an overlay would reload the journey.
    let element = this.root
    while (element.parentElement && element !== document.body) {
      Array.from(element.parentElement.children).forEach(sibling => {
        if (sibling instanceof HTMLElement && sibling !== element && !sibling.inert) {
          sibling.inert = true
          this.inertElements.push(sibling)
        }
      })
      element = element.parentElement
    }
  }

  updateTabScroll() {
    const tabs = this.root.querySelector('[data-tabs]')
    const overflow =
      Array.from(tabs.children).reduce(
        (width, tab) => width + tab.getBoundingClientRect().width,
        0,
      ) > tabs.parentElement.clientWidth - this.root.querySelector('[data-add-file]').offsetWidth
    tabs.parentElement.dataset.overflowing = String(overflow)
    this.root.querySelector('[data-scroll-tabs="-1"]').disabled = tabs.scrollLeft <= 0
    this.root.querySelector('[data-scroll-tabs="1"]').disabled =
      tabs.scrollLeft + tabs.clientWidth >= tabs.scrollWidth - 1
  }

  updateEditStatus() {
    const editedFiles = Array.from(this.models).filter(
      ([name, model]) => model.getValue() !== (this.lastRunSources.get(name) ?? this.sources[name]),
    )
    this.root.querySelectorAll('[data-file]').forEach((button) => {
      const edited = editedFiles.some(([name]) => name === button.dataset.file)
      button.dataset.edited = String(edited)
      button.setAttribute('aria-label', `${button.dataset.file}${edited ? ' (edited)' : ''}`)
    })
    this.status.dataset.edited = String(editedFiles.length > 0)
    if (!editedFiles.length) {
      this.status.textContent = 'Preview up to date'
      return
    }
    const count = document.createElement('strong')
    count.className = 'playground__status-count'
    count.textContent = `${editedFiles.length} ${editedFiles.length === 1 ? 'file' : 'files'} edited`
    this.status.replaceChildren(count, document.createTextNode(' · run to update'))
  }

  selectFile(name) {
    this.viewStates.set(this.editor.getModel().uri.toString(), this.editor.saveViewState())
    const model = this.models.get(name)
    this.editor.setModel(model)
    this.editor.restoreViewState(this.viewStates.get(model.uri.toString()))
    this.root
      .querySelectorAll('[data-file]')
      .forEach((button) =>
        button.setAttribute('aria-pressed', String(button.dataset.file === name)),
      )
    this.editor.focus()
  }

  async run() {
    if (this.busy) {
      return
    }
    const firstRun = !this.lastRun
    this.busy = true
    this.runButton.disabled = true
    this.status.textContent = 'Checking example…'
    try {
      const versions = new Map(
        Array.from(this.models, ([name, model]) => [name, model.getVersionId()]),
      )
      const getWorker = await typescript.getTypeScriptWorker()
      const worker = await getWorker(...Array.from(this.models.values(), (model) => model.uri))
      const results = await Promise.all(
        Array.from(this.models, async ([name, model]) => {
          const uri = model.uri.toString()
          const [syntax, semantic, output] = await Promise.all([
            worker.getSyntacticDiagnostics(uri),
            worker.getSemanticDiagnostics(uri),
            worker.getEmitOutput(uri),
          ])
          return {
            name,
            errors: [...syntax, ...semantic].filter((diagnostic) => diagnostic.category === 1),
            output,
          }
        }),
      )
      if (
        versions.size !== this.models.size ||
        Array.from(this.models).some(([name, model]) => versions.get(name) !== model.getVersionId())
      ) {
        this.status.textContent = 'Example changed while checking — run again'
        return
      }
      const invalid = results.find((result) => result.errors.length || result.output.emitSkipped)
      if (invalid) {
        this.status.textContent = `Fix the errors in ${invalid.name} before running`
        this.selectFile(invalid.name)
        return
      }
      this.lastRun = Object.fromEntries(
        results.map(({ name, output }) => [
          `./${name.slice(0, -3)}`,
          output.outputFiles.find((file) => file.name.endsWith('.js')).text,
        ]),
      )
      this.lastRunSources = new Map(
        Array.from(this.models, ([name, model]) => [name, model.getValue()]),
      )
      this.updateEditStatus()
      this.restartButton.disabled = false
      if (firstRun) {
        this.startPreview()
      } else {
        this.restart()
      }
    } catch (error) {
      this.status.textContent = error instanceof Error ? error.message : JSON.stringify(error)
    } finally {
      this.busy = false
      this.runButton.disabled = false
    }
  }

  restart() {
    if (!this.lastRun) {
      return
    }
    this.createPreview()
  }

  createPreview() {
    this.frameReady = false
    this.status.textContent = 'Starting preview…'
    const frame = document.createElement('iframe')
    frame.className = 'playground__preview-frame'
    frame.title = 'Journey preview'
    frame.referrerPolicy = 'origin'
    frame.setAttribute('sandbox', 'allow-scripts allow-forms')
    frame.src = '/forge-guide-v2/playground/preview'
    this.frame = frame
    this.root.querySelector('[data-preview]').replaceChildren(frame)
  }

  startPreview() {
    if (!this.frameReady || !this.lastRun) {
      return
    }
    this.frameReady = false
    this.frame.contentWindow.postMessage({ type: 'run', sources: this.lastRun, entryFile: this.entryFile, startPath: this.startPath }, '*')
  }

  receiveMessage(event) {
    if (event.source !== this.frame?.contentWindow || event.origin !== 'null') {
      return
    }
    const message = event.data
    if (message?.type === 'ready') {
      this.frameReady = true
      this.startPreview()
    } else if (message?.type === 'rendered') {
      this.updateEditStatus()
    } else if (message?.type === 'error' && typeof message.text === 'string') {
      this.status.textContent = `Preview error: ${message.text}`
    } else if (message?.type === 'collapse' && this.expanded) {
      this.setExpanded(false)
    }
  }
}

let nextInstanceId = 0

export async function mountPlayground(element, config) {
  const instanceId = nextInstanceId++
  element.innerHTML = editorMarkup.replaceAll('__PLAYGROUND_ID__', `playground-${instanceId}`)
  const root = element.querySelector('[data-playground]')
  await new PlaygroundEditor(root, instanceId, config).start()
}
