const projectionEl = document.getElementById('embedding-projection')
let currentProjection = projectionEl ? projectionEl.value : 'umap'

function getPoint(row) {
  return row.projections?.[currentProjection] || { x: row.x ?? 0, y: row.y ?? 0 }
}

;(function () {
  const rows = window.embeddingRows || []
  const plotEl = document.getElementById('embedding-plot')
  const detailsEl = document.getElementById('embedding-details')
  const filterEl = document.getElementById('embedding-filter')

  if (!plotEl || !detailsEl || rows.length === 0) {
    return
  }

  const width = 900
  const height = 640
  const padding = 32
  const nearestCount = 10

  let currentRows = rows
  let selectedId = null
  let highlightedChunkIds = new Set()

  function getRowId(row) {
    return row.type === 'query' ? row.requestId : `chunk-${row.index}`
  }

  function getLabel(row) {
    return row.type === 'query' ? row.label : `${row.title} — ${row.heading}`
  }

  function getSearchText(row) {
    if (row.type === 'query') {
      return `${row.label} ${row.text}`.toLowerCase()
    }

    return `${row.title} ${row.heading} ${row.slug} ${row.tags.join(' ')} ${row.text}`.toLowerCase()
  }

  function escapeHtml(value) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function dot(a, b) {
    let sum = 0
    const length = Math.min(a.length, b.length)

    for (let i = 0; i < length; i += 1) {
      sum += a[i] * b[i]
    }

    return sum
  }

  function getNearestChunks(queryRow, count) {
    return rows
      .filter(row => row.type === 'chunk')
      .map(row => ({
        row,
        score: dot(queryRow.vector, row.vector),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
  }

  function renderChunkDetails(row) {
    detailsEl.innerHTML = `
      <h2 class="govuk-heading-m">${escapeHtml(row.title)}</h2>
      <p class="govuk-body"><strong>Heading:</strong> ${escapeHtml(row.heading)}</p>
      <p class="govuk-body"><strong>Slug:</strong> ${escapeHtml(row.slug)}</p>
      <p class="govuk-body"><strong>Path:</strong> <a href="${escapeHtml(row.path)}">${escapeHtml(row.path)}</a></p>
      <p class="govuk-body"><strong>Tags:</strong> ${escapeHtml(row.tags.join(', '))}</p>
      <h3 class="govuk-heading-s">Chunk text</h3>
      <pre class="app-embedding-pre">${escapeHtml(row.text)}</pre>
      <h3 class="govuk-heading-s">Embedding text</h3>
      <pre class="app-embedding-pre">${escapeHtml(row.embeddingText)}</pre>
    `
  }

  function renderQueryDetails(row, nearestChunks) {
    const items = nearestChunks
      .map(
        ({ row: chunk, score }, index) => `
          <li class="app-embedding-nearest__item">
            <div class="app-embedding-nearest__rank">${index + 1}</div>
            <div class="app-embedding-nearest__body">
              <div class="app-embedding-nearest__title">
                <a href="${escapeHtml(chunk.path)}">${escapeHtml(chunk.title)}</a>
              </div>
              <div class="app-embedding-nearest__meta">
                ${escapeHtml(chunk.heading)} · similarity ${score.toFixed(4)}
              </div>
              <div class="app-embedding-nearest__text">
                ${escapeHtml(chunk.text.slice(0, 220))}${chunk.text.length > 220 ? '…' : ''}
              </div>
            </div>
          </li>
        `,
      )
      .join('')

    detailsEl.innerHTML = `
      <h2 class="govuk-heading-m">Query</h2>
      <p class="govuk-body"><strong>${escapeHtml(row.label)}</strong></p>
      <p class="govuk-body"><code>${escapeHtml(row.requestId)}</code></p>
      <pre class="app-embedding-pre">${escapeHtml(row.text)}</pre>

      <h3 class="govuk-heading-s">Nearest chunks</h3>
      <ol class="app-embedding-nearest">
        ${items}
      </ol>
    `
  }

  function buildPlot(data) {
    plotEl.innerHTML = ''

    if (data.length === 0) {
      detailsEl.innerHTML = '<p class="govuk-body">No points match the current filter.</p>'
      return
    }

    const xs = data.map(row => getPoint(row).x)
    const ys = data.map(row => getPoint(row).y)

    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)

    const scaleX = x => padding + ((x - minX) / (maxX - minX || 1)) * (width - padding * 2)
    const scaleY = y => height - padding - ((y - minY) / (maxY - minY || 1)) * (height - padding * 2)

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
    svg.setAttribute('width', String(width))
    svg.setAttribute('height', String(height))
    svg.setAttribute('role', 'img')

    data.forEach(row => {
      const rowId = getRowId(row)
      const isSelected = selectedId === rowId
      const isHighlightedChunk = highlightedChunkIds.has(rowId)
      const isDimmed = selectedId !== null && !isSelected && !isHighlightedChunk

      const point = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      point.setAttribute('cx', String(scaleX(getPoint(row).x)))
      point.setAttribute('cy', String(scaleY(getPoint(row).y)))

      let radius = row.type === 'query' ? 6 : 3
      let fill = row.type === 'query' ? '#d4351c' : '#1d70b8'
      let stroke = 'none'
      let strokeWidth = '0'
      let opacity = isDimmed ? '0.2' : '0.9'

      if (isHighlightedChunk) {
        radius = 6
        fill = '#00703c'
        opacity = '1'
      }

      if (isSelected) {
        radius = row.type === 'query' ? 8 : 6
        stroke = '#ffdd00'
        strokeWidth = '3'
        opacity = '1'
      }

      point.setAttribute('r', String(radius))
      point.setAttribute('fill', fill)
      point.setAttribute('stroke', stroke)
      point.setAttribute('stroke-width', strokeWidth)
      point.setAttribute('opacity', opacity)
      point.setAttribute('tabindex', '0')
      point.setAttribute('style', 'cursor:pointer')

      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title')
      title.textContent = getLabel(row)
      point.appendChild(title)

      const selectPoint = () => {
        selectedId = rowId

        if (row.type === 'query') {
          const nearestChunks = getNearestChunks(row, nearestCount)
          highlightedChunkIds = new Set(nearestChunks.map(item => getRowId(item.row)))
          renderQueryDetails(row, nearestChunks)
        } else {
          highlightedChunkIds = new Set([rowId])
          renderChunkDetails(row)
        }

        buildPlot(data)
      }

      point.addEventListener('click', selectPoint)
      point.addEventListener('focus', selectPoint)

      svg.appendChild(point)
    })

    plotEl.appendChild(svg)
  }

  function applyFilter() {
    const term = (filterEl?.value || '').trim().toLowerCase()

    selectedId = null
    highlightedChunkIds = new Set()

    if (!term) {
      currentRows = rows
      detailsEl.innerHTML = '<p class="govuk-body">Select a point to inspect it.</p>'
      buildPlot(currentRows)
      return
    }

    currentRows = rows.filter(row => getSearchText(row).includes(term))
    detailsEl.innerHTML = `<p class="govuk-body">Showing ${currentRows.length} filtered points.</p>`
    buildPlot(currentRows)
  }

  if (filterEl) {
    filterEl.addEventListener('input', applyFilter)
  }

  if (projectionEl) {
    projectionEl.addEventListener('change', () => {
      currentProjection = projectionEl.value
      buildPlot(currentRows)
    })
  }

  buildPlot(currentRows)
})()
