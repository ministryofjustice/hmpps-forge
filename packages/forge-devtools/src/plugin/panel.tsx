import { Fragment, h, render } from 'preact'
import { useCallback, useState } from 'preact/hooks'
import useConnection from './hooks/useConnection'
import PaneHeader from './layout/PaneHeader'
import SplitPane from './layout/SplitPane'
import ListPanel from './layout/ListPanel'
import AuthOverlay from './components/AuthOverlay'
import BlocksView from './components/BlocksView'
import Profiler from './components/Profiler'
import StateView from './components/StateView'
import TraceDetail from './components/TraceDetail'
import TraceEntry from './components/TraceEntry'

const DETAIL_TABS = ['Details', 'Profiler', 'State', 'Blocks'] as const

function Panel() {
  const connection = useConnection()
  const selectedTrace = connection.traces[connection.selectedIndex]
  const [activeTab, setActiveTab] = useState(0)

  const handleDetailKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      setActiveTab(prev => Math.min(prev + 1, DETAIL_TABS.length - 1))
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setActiveTab(prev => Math.max(prev - 1, 0))
    }
  }, [])

  return (
    <div class="app" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div class="content">
        <SplitPane
          direction="horizontal"
          storageKey="forge-devtools:split-ratio"
          initialRatio={0.35}
          minSize={200}
          first={
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <PaneHeader
                tabs={[{ label: 'Traces', active: true }]}
                right={
                  <Fragment>
                    <label class="pane-header__checkbox">
                      <input type="checkbox" checked={connection.autoRevealLatest} onChange={connection.toggleAutoReveal} />
                      Reveal latest
                    </label>
                    <button class="button button--small" onClick={connection.clearTraces}>Clear</button>
                  </Fragment>
                }
              />
              <ListPanel
                isEmpty={connection.traces.length === 0}
                emptyState="Waiting for traces..."
                itemCount={connection.traces.length}
                selectedIndex={connection.selectedIndex}
                onSelect={connection.selectTrace}
              >
                {connection.traces.map((trace, index) => (
                  <TraceEntry
                    key={index}
                    trace={trace}
                    selected={index === connection.selectedIndex}
                    onClick={() => connection.selectTrace(index)}
                  />
                ))}
              </ListPanel>
            </div>
          }
          second={
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }} tabIndex={0} onKeyDown={handleDetailKeyDown}>
              <PaneHeader
                tabs={DETAIL_TABS.map((label, index) => ({
                  label,
                  active: index === activeTab,
                  onClick: () => setActiveTab(index),
                }))}
                right={<span class={`connection-status connection-status--${connection.status}`}>{connection.statusText}</span>}
              />
              {activeTab === 0 && <TraceDetail trace={selectedTrace} />}
              {activeTab === 1 && <Profiler trace={selectedTrace} />}
              {activeTab === 2 && <StateView trace={selectedTrace} />}
              {activeTab === 3 && <BlocksView trace={selectedTrace} />}
            </div>
          }
        />
      </div>

      {connection.auth && <AuthOverlay auth={connection.auth} onSubmit={connection.submitCode} onRefresh={connection.refreshCode} />}
    </div>
  )
}

const applyTheme = (dark: boolean) => document.documentElement.classList.toggle('dark', dark)
applyTheme(chrome.devtools.panels.themeName === 'dark')
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => applyTheme(e.matches))

render(<Panel />, document.getElementById('root')!)
