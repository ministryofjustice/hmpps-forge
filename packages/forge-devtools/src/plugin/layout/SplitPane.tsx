import { h } from 'preact'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'

interface SplitPaneProps {
  readonly direction?: 'horizontal' | 'vertical'
  readonly storageKey?: string
  readonly initialRatio?: number
  readonly minSize?: number
  readonly first: ComponentChildren
  readonly second: ComponentChildren
}

export default function SplitPane({
  direction = 'horizontal',
  storageKey,
  initialRatio = 0.3,
  minSize = 80,
  first,
  second,
}: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [ratio, setRatio] = useState(initialRatio)
  const [dragging, setDragging] = useState(false)
  const ratioRef = useRef(initialRatio)

  const isHorizontal = direction === 'horizontal'

  useEffect(() => {
    if (!storageKey) {
      return
    }

    chrome.storage.local.get(storageKey, result => {
      const stored = result[storageKey]

      if (typeof stored === 'number') {
        setRatio(stored)
        ratioRef.current = stored
      }
    })
  }, [storageKey])

  const handleMouseDown = useCallback((event: MouseEvent) => {
    event.preventDefault()
    setDragging(true)
    document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!containerRef.current) {
        return
      }

      const rect = containerRef.current.getBoundingClientRect()
      const total = isHorizontal ? rect.width : rect.height
      const position = isHorizontal
        ? moveEvent.clientX - rect.left
        : moveEvent.clientY - rect.top

      const minRatio = minSize / total
      const newRatio = Math.max(minRatio, Math.min(1 - minRatio, position / total))

      ratioRef.current = newRatio
      setRatio(newRatio)
    }

    const handleMouseUp = () => {
      setDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)

      if (storageKey) {
        chrome.storage.local.set({ [storageKey]: ratioRef.current })
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [isHorizontal, minSize, storageKey])

  return (
    <div
      ref={containerRef}
      class="split-pane"
      style={{ flexDirection: isHorizontal ? 'row' : 'column' }}
    >
      <div class="split-pane__child" style={{ flexBasis: `${ratio * 100}%` }}>
        {first}
      </div>
      <div
        class={`split-pane__divider split-pane__divider--${isHorizontal ? 'vertical' : 'horizontal'}${dragging ? ' split-pane__divider--dragging' : ''}`}
        onMouseDown={handleMouseDown}
      />
      <div class="split-pane__child" style={{ flex: 1 }}>
        {second}
      </div>
    </div>
  )
}
