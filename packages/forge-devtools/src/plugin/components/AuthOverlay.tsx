import { h } from 'preact'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import type { AuthState } from '../hooks/useConnection'

interface AuthOverlayProps {
  readonly auth: AuthState
  readonly onSubmit: (code: string) => void
  readonly onRefresh: () => void
}

export default function AuthOverlay({ auth, onSubmit, onRefresh }: AuthOverlayProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = useCallback(() => {
    const code = inputRef.current?.value.trim().toUpperCase()

    if (code?.length === 5) {
      onSubmit(code)
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }, [onSubmit])

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSubmit()
    }
  }, [handleSubmit])

  return (
    <div class="auth-overlay">
      <div class="auth-overlay__message">{auth.message}</div>
      <div class="auth-overlay__input-row">
        <input
          ref={inputRef}
          class="auth-overlay__input"
          type="text"
          maxLength={5}
          placeholder="CODE"
          onKeyDown={handleKeyDown}
        />
        <button class="button" onClick={handleSubmit}>Submit</button>
      </div>
      {auth.error && <div class="auth-overlay__error">{auth.error}</div>}
      {auth.expiresAt && <Countdown expiresAt={auth.expiresAt} />}
      <button class="auth-overlay__refresh" onClick={onRefresh}>Request new code</button>
    </div>
  )
}

function Countdown({ expiresAt }: { expiresAt: number }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, expiresAt - Date.now()))

  useEffect(() => {
    const interval = setInterval(() => {
      const left = Math.max(0, expiresAt - Date.now())
      setRemaining(left)

      if (left === 0) {
        clearInterval(interval)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [expiresAt])

  const minutes = Math.floor(remaining / 60_000)
  const seconds = Math.floor((remaining % 60_000) / 1000)
  const display = `${minutes}:${String(seconds).padStart(2, '0')}`

  return (
    <div class={`auth-overlay__countdown${remaining < 30_000 ? ' auth-overlay__countdown--warning' : ''}`}>
      Code expires in {display}
    </div>
  )
}
