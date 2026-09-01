function createMessageElement(message, type, sender, timestamp, html) {
  const item = document.createElement('div')
  const text = document.createElement('div')
  const metadata = document.createElement('div')
  const senderName = document.createElement('span')
  const time = document.createElement('time')

  item.className = `moj-message-item moj-message-item--${type}`
  text.className = `moj-message-item__text moj-message-item__text--${type}`
  metadata.className = 'moj-message-item__meta'
  senderName.className = 'moj-message-item__meta--sender'
  time.className = 'moj-message-item__meta--timestamp'

  if (html === undefined) {
    text.textContent = message
  } else {
    text.innerHTML = html
  }
  senderName.textContent = sender
  time.dateTime = timestamp
  time.textContent = new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(new Date(timestamp))
    .toLowerCase()

  metadata.append(senderName, ' at ', time)
  item.append(text, metadata)

  return item
}

function formatMessageDate(timestamp) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(timestamp))
}

function createMessageDateElement(timestamp) {
  const date = document.createElement('time')
  const formattedDate = formatMessageDate(timestamp)

  date.className = 'moj-message-list__date'
  date.dateTime = formattedDate
  date.textContent = formattedDate

  return date
}

class LlmWebchatClient {
  constructor(container) {
    this.container = container
    this.form = container.querySelector('[data-llm-webchat-form]')
    this.messageList = container.querySelector('.moj-message-list')
    this.input = container.querySelector('#llm-webchat-message')
    this.sendButton = container.querySelector('[data-llm-send]')
    this.status = container.querySelector('[data-llm-status]')
    this.finished = container.querySelector('[data-llm-finished]')
    this.pendingMessage = undefined
  }

  init() {
    if (!this.form || !this.messageList || !this.input || !this.sendButton || !this.status) {
      return
    }

    this.form.addEventListener('submit', event => this.submit(event))
    this.scrollToLatestMessage()
  }

  async submit(event) {
    event.preventDefault()

    const formData = new FormData(this.form)
    const message = String(formData.get('message') ?? '').trim()

    if (message.length === 0) {
      this.input.focus()

      return
    }

    this.setBusy(true)

    try {
      const response = await fetch(this.form.dataset.streamUrl, {
        method: 'POST',
        headers: { Accept: 'application/x-ndjson' },
        body: new URLSearchParams(formData),
      })

      if (!response.ok || !response.body) {
        throw new Error('The webchat response could not be streamed')
      }

      await this.readEvents(response.body)
    } catch (error) {
      this.showError(error instanceof Error ? error.message : 'The webchat could not respond')
    } finally {
      this.setBusy(false)
    }
  }

  async readEvents(body) {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let pendingText = ''

    while (true) {
      const { done, value } = await reader.read()

      pendingText += decoder.decode(value ?? new Uint8Array(), { stream: !done })

      const lines = pendingText.split('\n')

      pendingText = lines.pop() ?? ''
      lines.filter(Boolean).forEach(line => this.handleEvent(JSON.parse(line)))

      if (done) {
        break
      }
    }

    if (pendingText.length > 0) {
      this.handleEvent(JSON.parse(pendingText))
    }
  }

  handleEvent(event) {
    if (event.type === 'accepted') {
      this.appendMessage(event.message, 'sent', 'You', event.timestamp)
      this.input.value = ''
      this.pendingMessage = this.appendMessage('Thinking…', 'received', 'Forge assistant', event.timestamp)
      this.status.textContent = 'Forge is working through the journey.'

      return
    }

    if (event.type === 'error') {
      this.showError(event.message)

      return
    }

    this.replacePendingMessage(event.message, event.timestamp, event.html)
    this.status.textContent = ''

    if (event.status !== 'awaiting-input') {
      this.finishConversation(event)
    }
  }

  appendMessage(message, type, sender, timestamp = new Date().toISOString()) {
    const item = createMessageElement(message, type, sender, timestamp)

    this.appendMessageDate(timestamp)
    this.messageList.append(item)
    this.scrollToLatestMessage()

    return item
  }

  appendMessageDate(timestamp) {
    const formattedDate = formatMessageDate(timestamp)
    const latestDate = this.messageList.querySelector('.moj-message-list__date:last-of-type')

    if (latestDate?.dateTime === formattedDate) {
      return
    }

    this.messageList.append(createMessageDateElement(timestamp))
  }

  replacePendingMessage(message, timestamp, html) {
    if (!message) {
      this.pendingMessage?.remove()
      this.pendingMessage = undefined

      return
    }

    const replacement = createMessageElement(message, 'received', 'Forge assistant', timestamp, html)

    this.pendingMessage?.replaceWith(replacement)
    this.pendingMessage = undefined
    this.scrollToLatestMessage()
  }

  finishConversation(event) {
    this.form.hidden = true
    this.finished.hidden = false

    if (event.status === 'navigate' && event.navigationUrl) {
      const paragraph = document.createElement('p')
      const link = document.createElement('a')

      paragraph.className = 'govuk-body'
      link.className = 'govuk-link'
      link.href = event.navigationUrl
      link.textContent = 'Continue to the next service'
      paragraph.append(link)
      this.finished.replaceChildren(paragraph)

      return
    }

    this.finished.textContent = 'This Forge journey is complete.'
    this.finished.className = 'govuk-inset-text'
  }

  showError(message) {
    if (this.pendingMessage) {
      this.pendingMessage.querySelector('.moj-message-item__text').textContent = message
      this.pendingMessage = undefined
    }

    this.status.textContent = message
  }

  setBusy(isBusy) {
    this.input.disabled = isBusy
    this.sendButton.disabled = isBusy

    if (!isBusy && !this.form.hidden) {
      this.input.focus()
    }
  }

  scrollToLatestMessage() {
    this.messageList.lastElementChild?.scrollIntoView({ block: 'nearest' })
  }
}

export function initLlmWebchat() {
  document.querySelectorAll('[data-llm-webchat]').forEach(container => {
    new LlmWebchatClient(container).init()
  })
}
