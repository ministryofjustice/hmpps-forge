import { h } from 'preact'
import type { ComponentChildren } from 'preact'

interface Tab {
  readonly label: string
  readonly active?: boolean
  readonly onClick?: () => void
}

interface PaneHeaderProps {
  readonly tabs: Tab[]
  readonly right?: ComponentChildren
}

export default function PaneHeader({ tabs, right }: PaneHeaderProps) {
  return (
    <div class="pane-header">
      <div class="pane-header__tabs">
        {tabs.map(tab => (
          <button
            key={tab.label}
            class={`tab${tab.active ? ' tab--active' : ''}`}
            onClick={tab.onClick}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {right && <div class="pane-header__right">{right}</div>}
    </div>
  )
}
