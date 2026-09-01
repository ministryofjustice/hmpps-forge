# Forge LLM adapter

The LLM adapter drives Forge journeys as persisted, supplier-neutral conversations. Forge remains responsible for journey validation, branching, effects and navigation; the adapter maps conversational messages onto rendered questions and Forge submissions.

```typescript
import { LlmAdapter, type LlmSessionStore } from '@ministryofjustice/hmpps-forge/llm-adapter'

const adapter = new LlmAdapter({
  forge,
  supplier,
  sessionStore,
})

const opening = await adapter.start({
  conversationId: 'conversation-123',
  entryPath: '/applications/start',
})

const response = await adapter.respond({
  conversationId: 'conversation-123',
  message: 'I rent a flat in Leeds.',
})

await adapter.end({ conversationId: 'conversation-123' })
```

The host application owns conversation identifiers, HTTP endpoints, cookies and persistence infrastructure. Implement `LlmSessionStore` with the application's existing store; the adapter requires only asynchronous `get`, `set` and `delete` operations.

Only one `respond()` call should be in flight for a conversation at a time. Web clients normally enforce this by waiting for a response before enabling the next submission.

`OpenAISupplier` is included as the first supplier implementation. Other model providers can implement the exported `LlmSupplier` interface.

## Presenting content

`LlmContent` treats its content as Markdown. Supply one string for ordinary content, or an array when parts of one passage have different visibility conditions. Forge resolves nested expressions and conditions before the adapter receives one flattened Markdown string.

```typescript
LlmContent({
  content: [
    { content: '## Check your answers' },
    { content: '---' },
    {
      content: Format('**Current housing situation:** %1', Answer('housingSituation')),
    },
    {
      content: Format('**Rented property type:** %1', Answer('rentedPropertyType')),
      visibleWhen: Answer('housingSituation').match(Condition.Equals('renter')),
    },
  ],
})
```

The adapter carries Markdown rather than HTML. Hosts decide how to present it. A web application should use a Markdown renderer with raw HTML disabled rather than trusting model or journey values as HTML.
