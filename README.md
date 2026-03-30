# Meibel TypeScript SDK

The official TypeScript/Node.js SDK for the [Meibel API](https://docs.meibel.ai). Provides document parsing, datasource management, and AI agent orchestration.

## Installation

```bash
npm install meibel@beta
```

## Quick Start

```typescript
import { MeibelClient } from 'meibel';
import fs from 'fs';

const client = new MeibelClient({
  apiKey: 'your-api-key',
});

// Parse a document
const job = await client.documents.parseDocument({
  file: fs.createReadStream('document.pdf'),
});
console.log(job.jobId);

// Process a document synchronously (waits for completion)
const result = await client.documents.processDocument({
  file: fs.createReadStream('document.pdf'),
});
console.log(result);

// List datasources
for await (const ds of client.datasources.listDatasources()) {
  console.log(ds.name);
}
```

## Authentication

The SDK authenticates via an API key sent in the `Meibel-API-Key` header. You can also use a bearer token.

```typescript
// API key authentication
const client = new MeibelClient({
  apiKey: 'your-api-key',
});

// Bearer token authentication
const client = new MeibelClient({
  bearerToken: 'your-token',
});
```

Get your API key from the [Meibel Dashboard](https://app.meibel.ai).

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
- [SDK Guide](https://docs.meibel.ai/sdk/typescript)

## License

MIT
