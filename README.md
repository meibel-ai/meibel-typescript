# Meibel TypeScript SDK

The official TypeScript/Node.js SDK for the [Meibel API](https://docs.meibel.ai). Provides document parsing, datasource management, and AI agent orchestration.

## Installation

Install from Git (v2):

```bash
npm install git+https://github.com/meibel-ai/meibel-typescript.git#v2.0.0
```

## Quick Start

```typescript
import { MeibelClient } from 'meibel';
import fs from 'fs';

const client = new MeibelClient({ apiKey: 'your-api-key' });

// Parse a document
const job = await client.documents.parseDocument(
  fs.createReadStream('document.pdf'),
  'document.pdf',
);
console.log(job.jobId);

// Process a document synchronously (waits for completion)
const result = await client.documents.processDocument(
  fs.createReadStream('document.pdf'),
  'document.pdf',
);
console.log(result);

// List datasources
for await (const ds of client.datasources.listDatasources()) {
  console.log(ds.name);
}
```

## Nested Resources

Resources are organized hierarchically. Content, downloads, data elements, and table descriptions are accessed through `datasources`:

```typescript
// Upload content to a datasource
const upload = await client.datasources.content.uploadContent(file, 'data.csv');

// List data elements
const elements = await client.datasources.dataElements.listDataElements('ds-123');
```

Agent sessions (chat) are accessed through `agents`:

```typescript
const session = await client.agents.sessions.createSession({ agentId: 'agent-123' });
const response = await client.agents.sessions.sendChatMessage({
  sessionId: session.id,
  message: 'Hello',
});
```

## Configuration

| Option         | Default                      | Description               |
|---------------|------------------------------|---------------------------|
| `apiKey`       | —                            | Your Meibel API key       |
| `bearerToken`  | —                            | Bearer token for auth     |
| `baseUrl`      | `https://api.meibel.ai/v2`  | API base URL              |
| `timeout`      | `30000`                      | Request timeout (ms)      |
| `headers`      | `{}`                         | Additional request headers|
| `fetch`        | global `fetch`               | Custom fetch implementation|

## Documentation

- [API Reference](https://docs.meibel.ai/api-reference/overview)
- [SDK Guide](https://docs.meibel.ai/sdk/nodejs)

## License

MIT