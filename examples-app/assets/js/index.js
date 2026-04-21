import '../scss/index.scss'
import * as govukFrontend from 'govuk-frontend'
import * as mojFrontend from '@ministryofjustice/frontend'
import { initScrollRestore } from './scroll-restore.mjs'
import './embedding-debug.js'
import { initPatternCodeTabs } from './pattern-code-tabs.mjs'

govukFrontend.initAll()
mojFrontend.initAll()
initScrollRestore()
initPatternCodeTabs()

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

const searchToggle = document.querySelector('.guide-search-toggle')
const searchPanel = document.getElementById('guide-search-panel')

if (searchToggle && searchPanel) {
  const searchInput = searchPanel.querySelector('input')

  searchToggle.addEventListener('click', () => {
    const expanded = searchToggle.getAttribute('aria-expanded') === 'true'

    searchToggle.setAttribute('aria-expanded', String(!expanded))
    searchPanel.hidden = expanded

    if (!expanded && searchInput) {
      searchInput.focus()
    }
  })
}

const backToTop = document.querySelector('.guide-back-to-top')

if (backToTop) {
  const footer = document.querySelector('.govuk-footer')
  const threshold = window.innerHeight * 1.3

  window.addEventListener('scroll', () => {
    const pastThreshold = window.scrollY > threshold
    const footerVisible = footer && footer.getBoundingClientRect().top < window.innerHeight

    backToTop.classList.toggle('guide-back-to-top--visible', pastThreshold && !footerVisible)
  })
}
