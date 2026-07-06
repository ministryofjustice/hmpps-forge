import { h } from 'preact'
import { useCallback, useRef } from 'preact/hooks'
import type { ComponentChildren } from 'preact'

interface ListPanelProps {
  readonly toolbar?: ComponentChildren
  readonly children: ComponentChildren
  readonly emptyState?: string
  readonly isEmpty?: boolean
  readonly itemCount?: number
  readonly selectedIndex?: number
  readonly onSelect?: (index: number) => void
}

export default function ListPanel({ toolbar, children, emptyState, isEmpty, itemCount = 0, selectedIndex = -1, onSelect }: ListPanelProps) {
  const listRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!onSelect || itemCount === 0) {
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      const next = Math.min(selectedIndex + 1, itemCount - 1)

      onSelect(next)
      scrollItemIntoView(listRef.current, next)
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      const prev = Math.max(selectedIndex - 1, 0)

      onSelect(prev)
      scrollItemIntoView(listRef.current, prev)
    }
  }, [onSelect, itemCount, selectedIndex])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {toolbar && <div class="toolbar">{toolbar}</div>}
      <div ref={listRef} class="list-panel" tabIndex={0} onKeyDown={handleKeyDown}>
        {isEmpty
          ? <div class="empty-state">{emptyState ?? 'No items'}</div>
          : children}
      </div>
    </div>
  )
}

function scrollItemIntoView(container: HTMLDivElement | null, index: number): void {
  if (!container) {
    return
  }

  const child = container.children[index] as HTMLElement | undefined

  child?.scrollIntoView({ block: 'nearest' })
}
