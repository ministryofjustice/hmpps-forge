const STORAGE_KEY = 'form-scroll-restore'
const MAX_AGE_MS = 5000

/**
 * Initialize scroll restoration for form submissions.
 * Only activates if the page has `data-scroll-restore` attribute on <body> or <html>.
 *
 * Enable in Nunjucks templates:
 * ```njk
 * <body data-scroll-restore>
 * ```
 */
export function initScrollRestore() {
  const isEnabled =
    document.body.hasAttribute('data-scroll-restore') ||
    document.documentElement.hasAttribute('data-scroll-restore')

  if (!isEnabled) {
    return
  }

  const currentUrl = window.location.pathname
  const saved = sessionStorage.getItem(STORAGE_KEY)
  let isFormSubmitting = false

  // Always clear saved data on page load
  if (saved) {
    sessionStorage.removeItem(STORAGE_KEY)

    const { url, scrollY, timestamp } = JSON.parse(saved)
    const isRecent = Date.now() - timestamp < MAX_AGE_MS
    const isSameUrl = url === currentUrl

    // Only restore scroll if same URL, data is fresh, and no anchor hash
    // (when a hash is present, let the browser handle native anchor scrolling)
    if (isSameUrl && isRecent && !window.location.hash) {
      window.scrollTo(0, scrollY)
    }
  }

  // Save scroll position before form submit
  document.querySelectorAll('form').forEach(form => {
    form.addEventListener('submit', () => {
      isFormSubmitting = true
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          url: currentUrl,
          scrollY: window.scrollY,
          timestamp: Date.now(),
        }),
      )
    })
  })

  // Clear data when navigating away (unless it's a form submission)
  window.addEventListener('pagehide', () => {
    if (!isFormSubmitting) {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  })
}
