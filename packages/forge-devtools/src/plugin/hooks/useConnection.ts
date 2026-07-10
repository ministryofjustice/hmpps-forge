import { useCallback, useEffect, useRef, useState } from 'preact/hooks'

const DEFAULT_DEVTOOLS_PATH = '/__forge-devtools/ws'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'authenticating' | 'connected' | 'error'

export interface TraceSnapshotMessage {
  readonly answers: Record<string, unknown>
  readonly data: Record<string, unknown>
  readonly stepValidities?: Record<string, unknown>
  readonly reachability?: unknown
}

export interface TraceUnitMessage {
  readonly kind: string
  readonly durationMs?: number
  readonly selfDurationMs?: number
  readonly startedAtMs?: number
  readonly completedAtMs?: number
  readonly executionSlices?: readonly { readonly startedAtMs: number; readonly completedAtMs: number }[]
  readonly nodeId?: string
  readonly variant?: string
  readonly name?: string
  readonly properties?: Record<string, unknown>
  readonly fields?: Record<string, unknown>
  readonly snapshot?: TraceSnapshotMessage
  readonly children?: readonly TraceUnitMessage[]
}

export interface PhaseMessage {
  readonly phase: string
  readonly outcome: string
  readonly durationMs: number
  readonly startedAtMs: number
  readonly completedAtMs?: number
  readonly units: readonly TraceUnitMessage[]
}

export interface TraceRouteContext {
  readonly journeyCode: string
  readonly journeyTitle: string
  readonly stepTitle?: string
  readonly routeTemplatePath: string
  readonly formattedDslPath?: string
}

export interface TraceRequestMessage {
  readonly params: Record<string, string>
  readonly query: Record<string, string | string[]>
  readonly post: Record<string, unknown>
  readonly state: Record<string, unknown>
  readonly headers: Record<string, string | string[] | undefined>
  readonly cookies: Record<string, string | undefined>
  readonly session: Record<string, unknown>
}

export interface TraceReachabilityStepMessage {
  readonly stepId: string
  readonly routeTemplatePath: string
  readonly code?: string
  readonly declarationIndex: number
  readonly isEntryPoint: boolean
  readonly isConditionalEntry: boolean
  readonly hasValidation: boolean
  readonly isReachable: boolean
  readonly isValid: boolean
  readonly forwardRouteTemplatePaths: readonly string[]
  readonly declaredForwardRouteTemplatePaths?: readonly string[]
  readonly predecessorRouteTemplatePaths: readonly string[]
  readonly tieBreakerPriority?: number
}

export interface TraceReachabilityMessage {
  readonly currentStepId?: string
  readonly steps: readonly TraceReachabilityStepMessage[]
  readonly defaultEntryRouteTemplatePath?: string
  readonly frontierRouteTemplatePath?: string
  readonly canonicalPathRouteTemplatePaths: readonly string[]
  readonly progressExists: boolean
  readonly resumeActive: boolean
  readonly resumeOutcome: 'no-op' | 'redirect'
  readonly unreachableRedirect: 'entry' | 'frontier'
}

export interface TraceMessage {
  readonly type: 'trace'
  readonly method: string
  readonly nodeId: string
  readonly pathname: string
  readonly receivedAt: number
  readonly trace: {
    readonly outcome: string
    readonly durationMs: number
    readonly startedAtMs: number
    readonly redirect?: { readonly target: string }
    readonly error?: { readonly status?: number; readonly message: string; readonly stack?: string }
    readonly reachability?: TraceReachabilityMessage
    readonly phases: readonly PhaseMessage[]
  }
  readonly route: TraceRouteContext
  readonly request?: TraceRequestMessage
}

export interface AuthState {
  readonly message: string
  readonly error?: string
  readonly expiresAt?: number
}

export interface ConnectionState {
  readonly status: ConnectionStatus
  readonly statusText: string
  readonly auth: AuthState | undefined
  readonly traces: TraceMessage[]
  readonly selectedIndex: number
  readonly autoRevealLatest: boolean
  readonly selectTrace: (index: number) => void
  readonly toggleAutoReveal: () => void
  readonly clearTraces: () => void
  readonly submitCode: (code: string) => void
  readonly refreshCode: () => void
}

export default function useConnection(): ConnectionState {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [statusText, setStatusText] = useState('Disconnected')
  const [auth, setAuth] = useState<AuthState | undefined>(undefined)
  const [traces, setTraces] = useState<TraceMessage[]>([])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [autoRevealLatest, setAutoRevealLatest] = useState(false)
  const autoRevealRef = useRef(false)
  const portRef = useRef<chrome.runtime.Port | undefined>(undefined)

  useEffect(() => {
    const port = chrome.runtime.connect({ name: 'forge-devtools-panel' })
    portRef.current = port

    port.postMessage({ type: 'init', tabId: chrome.devtools.inspectedWindow.tabId })
    connectToInspectedPage(port)

    setStatus('connecting')
    setStatusText('Connecting...')

    port.onMessage.addListener((message: Record<string, unknown>) => {
      switch (message.type) {
        case 'ws:open': {
          setStatus('connecting')
          setStatusText('Connected — waiting for challenge...')
          break
        }

        case 'auth:challenge': {
          setStatus('authenticating')
          setStatusText('Authenticating')
          const expiresIn = message.expiresIn as number | undefined
          setAuth({
            message: 'Enter the code from your terminal',
            expiresAt: expiresIn ? Date.now() + expiresIn : undefined,
          })
          break
        }

        case 'auth:success': {
          setStatus('connected')
          setStatusText('Connected')
          setAuth(undefined)
          setDevToolsCookie(message.cookie as string)
          break
        }

        case 'auth:failed': {
          setAuth({
            message: 'Enter the code from your terminal',
            error: `Wrong code — ${message.attemptsRemaining} attempt(s) remaining`,
          })
          break
        }

        case 'auth:rejected': {
          setStatus('authenticating')
          setStatusText('Authenticating')
          setAuth({ message: 'Too many attempts', error: 'Request a new code to try again' })
          break
        }

        case 'auth:expired': {
          setStatus('authenticating')
          setStatusText('Authenticating')
          setAuth({ message: 'Code expired', error: 'Request a new code to try again' })
          break
        }

        case 'trace': {
          const trace = { ...message, receivedAt: Date.now() } as unknown as TraceMessage
          setTraces(prev => [trace, ...prev])
          if (autoRevealRef.current) {
            setSelectedIndex(0)
          } else {
            setSelectedIndex(prev => (prev >= 0 ? prev + 1 : prev))
          }
          break
        }

        case 'ws:closed': {
          setStatus('disconnected')
          setStatusText('Disconnected')
          setAuth(undefined)
          break
        }

        case 'ws:error': {
          setStatus('error')
          setStatusText('Connection error')
          break
        }

        default:
          break
      }
    })

    const handlePortDisconnect = () => {
      setStatus('disconnected')
      setStatusText('Disconnected')
      setAuth(undefined)
      portRef.current = undefined
    }

    port.onDisconnect.addListener(handlePortDisconnect)

    return () => {
      clearDevToolsCookie()
      port.onDisconnect.removeListener(handlePortDisconnect)
      port.disconnect()
    }
  }, [])

  const clearTraces = useCallback(() => {
    setTraces([])
    setSelectedIndex(-1)
  }, [])

  const submitCode = useCallback((code: string) => {
    portRef.current?.postMessage({ type: 'auth:code', code })
  }, [])

  const refreshCode = useCallback(() => {
    portRef.current?.postMessage({ type: 'auth:refresh' })
  }, [])

  const toggleAutoReveal = useCallback(() => {
    setAutoRevealLatest(prev => {
      autoRevealRef.current = !prev

      return !prev
    })
  }, [])

  return {
    status,
    statusText,
    auth,
    traces,
    selectedIndex,
    autoRevealLatest,
    selectTrace: setSelectedIndex,
    toggleAutoReveal,
    clearTraces,
    submitCode,
    refreshCode,
  }
}

const COOKIE_NAME = '__forgeDevtools'

function connectToInspectedPage(port: chrome.runtime.Port): void {
  chrome.devtools.inspectedWindow.eval('location.origin', result => {
    if (typeof result !== 'string') {
      port.postMessage({ type: 'connect' })

      return
    }

    port.postMessage({ type: 'connect', url: buildDevToolsWebSocketUrl(result) })
  })
}

function buildDevToolsWebSocketUrl(origin: string): string {
  const url = new URL(DEFAULT_DEVTOOLS_PATH, origin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'

  return url.toString()
}

function setDevToolsCookie(value: string): void {
  chrome.devtools.inspectedWindow.eval(`document.cookie = '${COOKIE_NAME}=${value}; path=/; SameSite=Lax'`)
}

function clearDevToolsCookie(): void {
  chrome.devtools.inspectedWindow.eval(
    `document.cookie = '${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'`,
  )
}
