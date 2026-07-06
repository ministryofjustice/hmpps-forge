/**
 * Highlights a rendered block in the inspected page from the devtools panel,
 * drawing a Chrome-style box-model overlay: content / padding / border / margin
 * regions in the canonical DevTools colors, a dashed element-bounds outline, and
 * a compact tooltip showing the block's variant, nodeId and dimensions.
 *
 * The panel UI runs in its own document, so it reaches the page the same way the
 * rest of the panel does — `chrome.devtools.inspectedWindow.eval`. We serialise a
 * self-contained painter and run it in the page, where it locates the block's
 * paired `<!--forge:…-->` comment markers (emitted by the renderer's `markBlock`),
 * resolves the single element between them, reads its computed box metrics, and
 * paints the layered overlay. Blocks spanning multiple elements (no single box
 * model to read) fall back to a plain content-coloured box.
 */

interface HighlightTarget {
  readonly nodeId: string
  readonly label: string
}

/**
 * Runs in the inspected page via `inspectedWindow.eval`, so it must stay fully
 * self-contained: no module imports, no outer references, and no syntax a bundler
 * could lower into injected helpers (hence explicit null checks over `?.`/`??` and
 * inline arithmetic over shared helpers), since `.toString()` only carries the
 * function's own body. A null target hides the overlay.
 */
function paintHighlight(target: { nodeId: string; label: string } | null): void {
  const WRAP_ID = '__forgeDevtoolsHighlight'
  const existing = document.getElementById(WRAP_ID)

  if (target === null) {
    if (existing !== null) {
      existing.style.display = 'none'
    }

    return
  }

  const startValue = `forge:${target.nodeId}`
  const endValue = `/forge:${target.nodeId}`
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT)
  let start: Comment | null = null
  let end: Comment | null = null
  let node: Node | null = walker.nextNode()

  while (node !== null) {
    if (node.nodeValue === startValue) {
      start = node as Comment
    } else if (start !== null && node.nodeValue === endValue) {
      end = node as Comment

      break
    }

    node = walker.nextNode()
  }

  if (start === null || end === null) {
    if (existing !== null) {
      existing.style.display = 'none'
    }

    return
  }

  // The block's top-level elements are the element siblings between the markers.
  // A box model only makes sense for a single element; anything else degrades to
  // a plain box over the whole range.
  let element: Element | null = null
  let elementCount = 0
  let sibling: Node | null = start.nextSibling

  while (sibling !== null && sibling !== end) {
    if (sibling.nodeType === Node.ELEMENT_NODE) {
      element = sibling as Element
      elementCount += 1
    }

    sibling = sibling.nextSibling
  }

  const range = document.createRange()
  range.setStartAfter(start)
  range.setEndBefore(end)

  let rect = range.getBoundingClientRect()

  if (rect.bottom < 0 || rect.top > window.innerHeight) {
    let anchor: Element | null = element

    if (anchor === null) {
      anchor = start.parentElement
    }

    if (anchor !== null) {
      anchor.scrollIntoView({ block: 'center', inline: 'nearest' })
      rect = range.getBoundingClientRect()
    }
  }

  let wrap = existing

  if (wrap === null) {
    wrap = document.createElement('div')
    wrap.id = WRAP_ID
    wrap.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none'
    document.body.appendChild(wrap)
  }

  wrap.style.display = 'block'
  wrap.innerHTML = ''

  // Canonical Chrome DevTools box-model highlight colors.
  const contentColor = 'rgba(111,168,220,0.66)'
  const paddingColor = 'rgba(147,196,125,0.55)'
  const borderColor = 'rgba(255,229,153,0.66)'
  const marginColor = 'rgba(246,178,107,0.66)'
  const outlineStyle = 'outline:1px dashed rgba(75,124,213,0.9);outline-offset:-1px'

  let outerLeft = rect.left
  let outerTop = rect.top
  let outerBottom = rect.bottom

  if (elementCount === 1 && element !== null) {
    const cs = window.getComputedStyle(element)
    const borderBox = element.getBoundingClientRect()

    let mt = parseFloat(cs.marginTop) || 0
    let mr = parseFloat(cs.marginRight) || 0
    let mb = parseFloat(cs.marginBottom) || 0
    let ml = parseFloat(cs.marginLeft) || 0

    // Negative margins can't be drawn as border rings, so clamp them away.
    if (mt < 0) {
      mt = 0
    }

    if (mr < 0) {
      mr = 0
    }

    if (mb < 0) {
      mb = 0
    }

    if (ml < 0) {
      ml = 0
    }

    const bt = parseFloat(cs.borderTopWidth) || 0
    const br = parseFloat(cs.borderRightWidth) || 0
    const bb = parseFloat(cs.borderBottomWidth) || 0
    const bl = parseFloat(cs.borderLeftWidth) || 0

    const pt = parseFloat(cs.paddingTop) || 0
    const pr = parseFloat(cs.paddingRight) || 0
    const pb = parseFloat(cs.paddingBottom) || 0
    const pl = parseFloat(cs.paddingLeft) || 0

    outerLeft = borderBox.left - ml
    outerTop = borderBox.top - mt
    outerBottom = borderBox.bottom + mb

    // Each box-model ring is one div whose own border draws that ring; the next
    // inner div fills the previous one's content box (border-box + 100%/100%),
    // so the layers nest exactly onto the element's real content/padding/border.
    const marginDiv = document.createElement('div')
    marginDiv.style.cssText =
      `position:absolute;box-sizing:border-box;left:${borderBox.left - ml}px;top:${borderBox.top - mt}px;` +
      `width:${borderBox.width + ml + mr}px;height:${borderBox.height + mt + mb}px;` +
      `border-style:solid;border-color:${marginColor};border-width:${mt}px ${mr}px ${mb}px ${ml}px`

    const borderDiv = document.createElement('div')
    borderDiv.style.cssText =
      `box-sizing:border-box;width:100%;height:100%;border-style:solid;border-color:${borderColor};` +
      `border-width:${bt}px ${br}px ${bb}px ${bl}px;${outlineStyle}`

    const paddingDiv = document.createElement('div')
    paddingDiv.style.cssText =
      `box-sizing:border-box;width:100%;height:100%;border-style:solid;border-color:${paddingColor};` +
      `border-width:${pt}px ${pr}px ${pb}px ${pl}px`

    const contentDiv = document.createElement('div')
    contentDiv.style.cssText = `width:100%;height:100%;background:${contentColor}`

    paddingDiv.appendChild(contentDiv)
    borderDiv.appendChild(paddingDiv)
    marginDiv.appendChild(borderDiv)
    wrap.appendChild(marginDiv)
  } else {
    const box = document.createElement('div')
    box.style.cssText =
      `position:absolute;box-sizing:border-box;left:${rect.left}px;top:${rect.top}px;` +
      `width:${rect.width}px;height:${rect.height}px;background:${contentColor};${outlineStyle}`
    wrap.appendChild(box)
  }

  const tip = document.createElement('div')
  tip.style.cssText =
    'position:absolute;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#e8eaed;' +
    'background:rgba(32,33,36,0.95);padding:4px 8px;border-radius:3px;white-space:nowrap;' +
    'box-shadow:0 1px 4px rgba(0,0,0,0.4)'

  const variantEl = document.createElement('div')
  variantEl.style.cssText = 'color:#9bb7f0;font-weight:600'
  variantEl.textContent = target.label
  tip.appendChild(variantEl)

  if (target.nodeId !== target.label) {
    const idEl = document.createElement('div')
    idEl.style.cssText = 'color:#9aa0a6'
    idEl.textContent = target.nodeId
    tip.appendChild(idEl)
  }

  const dimsEl = document.createElement('div')
  dimsEl.style.cssText = 'color:#9aa0a6'
  dimsEl.textContent = `${Math.round(rect.width)}px × ${Math.round(rect.height)}px`
  tip.appendChild(dimsEl)

  wrap.appendChild(tip)

  let tipLeft = outerLeft

  if (tipLeft < 4) {
    tipLeft = 4
  }

  tip.style.left = `${tipLeft}px`

  // Prefer placing the tooltip below the box; flip above if it would overflow.
  const tipHeight = tip.offsetHeight
  let tipTop = outerBottom + 4

  if (tipTop + tipHeight > window.innerHeight) {
    tipTop = outerTop - tipHeight - 4
  }

  if (tipTop < 4) {
    tipTop = 4
  }

  tip.style.top = `${tipTop}px`
}

function runInPage(target: HighlightTarget | null): void {
  const expression = `(${paintHighlight.toString()})(${JSON.stringify(target)})`

  chrome.devtools.inspectedWindow.eval(expression)
}

export function highlightBlock(nodeId: string, label: string): void {
  runInPage({ nodeId, label })
}

export function clearBlockHighlight(): void {
  runInPage(null)
}
