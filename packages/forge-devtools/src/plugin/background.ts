const HEARTBEAT_INTERVAL_MS = 20_000
const HEARTBEAT_TIMEOUT_MS = 45_000

interface PanelConnection {
  readonly port: chrome.runtime.Port
  readonly tabId: number
  ws?: WebSocket
  heartbeatIntervalId?: ReturnType<typeof globalThis.setInterval>
  heartbeatTimeoutId?: ReturnType<typeof globalThis.setTimeout>
}

const connections = new Map<number, PanelConnection>()

chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'forge-devtools-panel') {
    return
  }

  port.onMessage.addListener(message => {
    handlePanelMessage(port, message)
  })

  port.onDisconnect.addListener(() => {
    for (const [tabId, conn] of connections) {
      if (conn.port !== port) {
        continue
      }

      closeWebSocket(conn)
      connections.delete(tabId)

      break
    }
  })
})

function handlePanelMessage(port: chrome.runtime.Port, message: Record<string, unknown>): void {
  switch (message.type) {
    case 'init': {
      const tabId = message.tabId as number
      connections.set(tabId, { port, tabId })

      break
    }

    case 'connect': {
      const conn = findConnection(port)
      const url = message.url as string | undefined

      if (!conn) {
        break
      }

      if (!url) {
        conn.port.postMessage({ type: 'ws:error' })
        break
      }

      connectWebSocket(conn, url)

      break
    }

    case 'auth:code': {
      const conn = findConnection(port)
      conn?.ws?.send(JSON.stringify({ type: 'auth:code', code: message.code }))

      break
    }

    case 'auth:refresh': {
      const conn = findConnection(port)
      conn?.ws?.send(JSON.stringify({ type: 'auth:refresh' }))

      break
    }

    default:
      break
  }
}

function findConnection(port: chrome.runtime.Port): PanelConnection | undefined {
  for (const conn of connections.values()) {
    if (conn.port === port) {
      return conn
    }
  }

  return undefined
}

function connectWebSocket(conn: PanelConnection, url: string): void {
  closeWebSocket(conn)

  const ws = new WebSocket(url)

  ws.addEventListener('open', () => {
    if (conn.ws !== ws) {
      return
    }

    startHeartbeat(conn, ws)
    conn.port.postMessage({ type: 'ws:open' })
  })

  ws.addEventListener('message', event => {
    const data = JSON.parse(event.data as string) as Record<string, unknown>

    if (data.type === 'heartbeat:pong') {
      clearHeartbeatTimeout(conn)

      return
    }

    conn.port.postMessage(data)
  })

  ws.addEventListener('close', () => {
    if (conn.ws !== ws) {
      return
    }

    stopHeartbeat(conn)
    conn.ws = undefined
    conn.port.postMessage({ type: 'ws:closed' })
  })

  ws.addEventListener('error', () => {
    if (conn.ws !== ws) {
      return
    }

    conn.port.postMessage({ type: 'ws:error' })
    ws.close()
  })

  conn.ws = ws
}

function closeWebSocket(conn: PanelConnection): void {
  stopHeartbeat(conn)
  conn.ws?.close()
  conn.ws = undefined
}

function startHeartbeat(conn: PanelConnection, ws: WebSocket): void {
  stopHeartbeat(conn)
  sendHeartbeat(conn, ws)
  conn.heartbeatIntervalId = globalThis.setInterval(() => sendHeartbeat(conn, ws), HEARTBEAT_INTERVAL_MS)
}

function sendHeartbeat(conn: PanelConnection, ws: WebSocket): void {
  if (conn.ws !== ws || ws.readyState !== WebSocket.OPEN) {
    return
  }

  if (conn.heartbeatTimeoutId === undefined) {
    conn.heartbeatTimeoutId = globalThis.setTimeout(() => {
      if (conn.ws === ws) {
        ws.close()
      }
    }, HEARTBEAT_TIMEOUT_MS)
  }

  try {
    ws.send(JSON.stringify({ type: 'heartbeat:ping' }))
  } catch {
    ws.close()
  }
}

function stopHeartbeat(conn: PanelConnection): void {
  if (conn.heartbeatIntervalId !== undefined) {
    globalThis.clearInterval(conn.heartbeatIntervalId)
    conn.heartbeatIntervalId = undefined
  }

  clearHeartbeatTimeout(conn)
}

function clearHeartbeatTimeout(conn: PanelConnection): void {
  if (conn.heartbeatTimeoutId === undefined) {
    return
  }

  globalThis.clearTimeout(conn.heartbeatTimeoutId)
  conn.heartbeatTimeoutId = undefined
}
