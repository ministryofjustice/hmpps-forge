import { PlaygroundInitializer } from './playground/initializer.mjs'
import '../scss/index.scss'
import * as govukFrontend from 'govuk-frontend'
import * as mojFrontend from '@ministryofjustice/frontend'
import { initScrollRestore } from './scroll-restore.mjs'
import { initPatternCodeTabs } from './pattern-code-tabs.mjs'
import { initGuideSideNav } from './guide-side-nav.mjs'
import { initGuideToc } from './guide-toc.mjs'
import { initFrameSequence } from './frame-sequence.mjs'
import { initMermaid } from './mermaid.mjs'

govukFrontend.initAll()
mojFrontend.initAll()
initScrollRestore()
initPatternCodeTabs()
initGuideSideNav()
initGuideToc()
initFrameSequence()
initMermaid()
new PlaygroundInitializer().start()

document.querySelectorAll('#main h2[id], #main h3[id], #main h4[id]').forEach(heading => {
  const anchor = document.createElement('a')

  anchor.href = `#${heading.id}`
  anchor.className = 'guide-heading-anchor'
  anchor.setAttribute('aria-label', `Link to ${heading.textContent}`)
  anchor.textContent = '#'
  heading.classList.add('guide-heading-anchor__heading')
  heading.prepend(anchor)

  anchor.addEventListener('click', e => {
    e.preventDefault()
    navigator.clipboard.writeText(
      `${window.location.origin + window.location.pathname}#${heading.id}`,
    )
    anchor.classList.add('guide-heading-anchor--copied')
    history.replaceState(null, '', `#${heading.id}`)
    setTimeout(() => anchor.classList.remove('guide-heading-anchor--copied'), 1500)
  })
})

const searchToggle = document.querySelector('.guide-search-toggle, .guide-header__search')
const searchPanel = document.getElementById('guide-search-panel')

if (searchToggle && searchPanel) {
  const searchInput = searchPanel.querySelector('input')

  const toggleSearchPanel = () => {
    const expanded = searchToggle.getAttribute('aria-expanded') === 'true'

    searchToggle.setAttribute('aria-expanded', String(!expanded))
    searchPanel.hidden = expanded

    if (!expanded && searchInput) {
      searchInput.focus()
    }
  }

  searchToggle.addEventListener('click', toggleSearchPanel)

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      toggleSearchPanel()
    }
  })
}

const menuToggle = document.querySelector('.guide-header__menu-toggle')
const mobileMenu = document.getElementById('guide-mobile-menu')

if (menuToggle && mobileMenu) {
  menuToggle.addEventListener('click', () => {
    const expanded = menuToggle.getAttribute('aria-expanded') === 'true'

    menuToggle.setAttribute('aria-expanded', String(!expanded))
    mobileMenu.hidden = expanded
    document.documentElement.classList.toggle('guide-mobile-menu-open', !expanded)
  })
}

// const backToTop = document.querySelector('.guide-back-to-top')
//
// if (backToTop) {
//   const footer = document.querySelector('.govuk-footer')
//   const threshold = window.innerHeight * 1.3
//
//   window.addEventListener('scroll', () => {
//     const pastThreshold = window.scrollY > threshold
//     const footerVisible = footer && footer.getBoundingClientRect().top < window.innerHeight
//
//     backToTop.classList.toggle('guide-back-to-top--visible', pastThreshold && !footerVisible)
//   })
// }
