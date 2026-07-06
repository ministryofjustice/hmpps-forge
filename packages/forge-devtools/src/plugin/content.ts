const COOKIE_NAME = '__forgeDevtools'

chrome.runtime.onMessage.addListener((message: { type: string; value?: string }) => {
  switch (message.type) {
    case 'forge-devtools:set-cookie': {
      if (message.value) {
        document.cookie = `${COOKIE_NAME}=${message.value}; path=/; SameSite=Lax`
      }

      break
    }

    case 'forge-devtools:clear-cookie': {
      document.cookie = `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`

      break
    }

    default:
      break
  }
})
