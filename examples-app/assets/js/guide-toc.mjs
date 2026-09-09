export function initGuideToc() {
  const links = [...document.querySelectorAll('.guide-toc__link')]

  const targets = links
    .map(link => document.getElementById(decodeURIComponent(link.hash.slice(1))))
    .filter(Boolean)

  if (!targets.length) {
    return
  }

  // The active heading is the last one at or above the scroll-padding line,
  // so it matches where an anchor jump would land.
  const activeOffset = 100

  const setActiveLink = () => {
    let activeIndex = 0

    targets.forEach((target, index) => {
      if (target.getBoundingClientRect().top <= activeOffset) {
        activeIndex = index
      }
    })

    links.forEach((link, index) => {
      link.classList.toggle('guide-toc__link--active', index === activeIndex)
    })
  }

  window.addEventListener('scroll', setActiveLink, { passive: true })
  setActiveLink()
}
