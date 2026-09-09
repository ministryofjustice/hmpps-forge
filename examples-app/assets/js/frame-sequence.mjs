// Click- and keyboard-driven stepping for the frame sequence carousel.
// Every frame, caption, and dot is rendered server-side, so this only moves the
// track and toggles which of them is the active one - it never builds markup.

export function initFrameSequence(root = document) {
  root.querySelectorAll('[data-module="forge-frame-sequence"]').forEach(module => {
    const track = module.querySelector('.forge-frame-sequence__track')
    const frames = Array.from(module.querySelectorAll('.forge-frame-sequence__frame'))
    const captions = Array.from(module.querySelectorAll('.forge-frame-sequence__caption'))
    const dots = Array.from(module.querySelectorAll('.forge-frame-sequence__dot'))
    const previous = module.querySelector('.forge-frame-sequence__nav--prev')
    const next = module.querySelector('.forge-frame-sequence__nav--next')

    if (!track || !frames.length || !previous || !next) return

    let current = 0

    const activate = (index) => {
      current = Math.min(Math.max(index, 0), frames.length - 1)

      track.style.transform = `translateX(-${current * 100}%)`

      frames.forEach((frame, i) => {
        if (i === current) {
          frame.removeAttribute('aria-hidden')
        } else {
          frame.setAttribute('aria-hidden', 'true')
        }
      })
      captions.forEach((caption, i) => {
        if (i === current) {
          caption.removeAttribute('hidden')
        } else {
          caption.setAttribute('hidden', '')
        }
      })
      dots.forEach((dot, i) => {
        const isActive = i === current
        dot.classList.toggle('forge-frame-sequence__dot--active', isActive)
        if (isActive) {
          dot.setAttribute('aria-current', 'true')
        } else {
          dot.removeAttribute('aria-current')
        }
      })

      previous.disabled = current === 0
      next.disabled = current === frames.length - 1
    }

    previous.addEventListener('click', () => activate(current - 1))
    next.addEventListener('click', () => activate(current + 1))

    dots.forEach((dot, index) => {
      dot.addEventListener('click', () => activate(index))
    })

    module.addEventListener('keydown', event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return

      event.preventDefault()
      activate(event.key === 'ArrowLeft' ? current - 1 : current + 1)
    })

    activate(0)
  })
}
