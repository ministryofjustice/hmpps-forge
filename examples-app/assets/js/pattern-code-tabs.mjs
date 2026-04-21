// Keyboard- and click-driven tab switching for the pattern code panels.
// Each `[data-module="pattern-code-tabs"]` hosts a tablist + multiple tabpanels.

export function initPatternCodeTabs(root = document) {
  root.querySelectorAll('[data-module="pattern-code-tabs"]').forEach(module => {
    const tabs = Array.from(module.querySelectorAll('[role="tab"]'))
    const panels = Array.from(module.querySelectorAll('[role="tabpanel"]'))

    if (!tabs.length || !panels.length) return

    const activate = (index) => {
      tabs.forEach((tab, i) => {
        const isActive = i === index
        tab.setAttribute('aria-selected', String(isActive))
        tab.setAttribute('tabindex', isActive ? '0' : '-1')
        tab.classList.toggle('pattern-code-tabs__tab--active', isActive)
      })
      panels.forEach((panel, i) => {
        if (i === index) {
          panel.removeAttribute('hidden')
        } else {
          panel.setAttribute('hidden', '')
        }
      })
    }

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => {
        activate(index)
        tab.focus()
      })

      tab.addEventListener('keydown', event => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') {
          return
        }

        event.preventDefault()

        let next = index
        if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
        if (event.key === 'Home') next = 0
        if (event.key === 'End') next = tabs.length - 1

        activate(next)
        tabs[next].focus()
      })
    })
  })
}
