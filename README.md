# Meibel TypeScript SDK

The official TypeScript/Node.js SDK for the [Meibel API](https://docs.meibel.ai). Provides document parsing, datasource management, and AI agent orchestration.

## Installation

```bash
npm install meibel@beta
```

## Quick Start

```typescript
import { MeibelClient } from 'meibel';

const client = new MeibelClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.meibel.ai/v2',
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
const datasources = await client.datasources.listDatasources();
for (const ds of datasources.items) {
  console.log(ds.name);
}
```

## Documentation

- [API Reference](https://docs.meibel.ai/api-reference/overview)
- [SDK Guide](https://docs.meibel.ai/sdk/typescript)

## License

MIT
