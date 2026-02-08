# Development Guide

This guide covers development workflows, coding standards, and architectural decisions for the Atlas plugin.

## 🏗️ Architecture Overview

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                         Atlas Plugin                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Plugin Entry  │  │ Config Layer  │  │  Storage     │      │
│  │   (index.ts)  │  │  (config.ts)  │  │ (storage.ts) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │                │
│         ▼                  ▼                  ▼                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ PageIndex    │  │    Tools     │  │     CLI      │      │
│  │ (pageindex.ts)│  │  (tools.ts)  │  │   (cli.ts)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              OpenClaw Gateway (Runtime)             │    │
│  │  - Agent tools     - CLI commands     - Hooks      │    │
│  └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Development Workflow

### 1. Setup Development Environment

```bash
# Clone repository
git clone https://github.com/your-org/openclaw-atlas.git
cd openclaw-atlas

# Install dependencies
npm install

# Install PageIndex
pip install pageindex

# Verify installation
npm run build
npm run typecheck
```

### 2. Make Changes

**Feature Development:**
```bash
# Create feature branch
git checkout -b feature/your-feature

# Edit source files
# src/your-file.ts

# Watch mode (auto-rebuild on changes)
npm run dev

# Test changes
openclaw atlas status
```

**Bug Fix:**
```bash
# Create bugfix branch
git checkout -b fix/issue-123

# Edit and test
npm run build
npm run typecheck

# Verify fix
openclaw atlas search "test query"
```

### 3. Test Your Changes

**Manual Testing:**
```bash
# Build plugin
npm run build

# Copy to OpenClaw extensions
cp -r dist/* ~/.openclaw/extensions/openclaw-atlas/

# Restart gateway
launchctl kickstart -k gui/501/ai.openclaw.gateway

# Test functionality
openclaw atlas status
openclaw atlas search "test"
```

**Feature-Specific Testing:**

Async Indexing:
```bash
# Start background job
openclaw atlas index ~/test-docs --background

# Monitor job
openclaw atlas jobs
openclaw atlas job-status <job-id>
```

Incremental Updates:
```bash
# First run
openclaw atlas index ~/test-docs --incremental

# Add file, then incremental update
touch ~/test-docs/new.txt
openclaw atlas index ~/test-docs --incremental
```

Caching:
```bash
# Search twice
openclaw atlas search "query"
openclaw atlas search "query"  # Should be cached

# Check stats
openclaw atlas cache-stats
```

### 4. Commit Changes

```bash
# Stage changes
git add src/types.ts src/storage.ts

# Commit (use conventional commits)
git commit -m "feat: add job persistence for async indexing"

# Push to fork
git push origin feature/your-feature
```

### 5. Create Pull Request

1. Visit your fork on GitHub
2. Click "Pull Request" button
3. Fill in PR template
4. Submit PR

## 📦 Build System

### tsup Configuration

```typescript
// tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,              // Generate .d.ts files
  clean: true,             // Clean dist before build
  sourcemap: true,         // Generate source maps
  target: "es2022",        // Target ES2022
  minify: false,          // Skip minification for debugging
});
```

### Build Outputs

```
dist/
├── index.js              # ESM bundle (33 KB)
├── index.js.map          # Source map
└── index.d.ts            # TypeScript declarations
```

## 🔍 Code Organization

### Module Responsibilities

#### index.ts
- Plugin activation/deactivation
- Hook registration
- Service initialization
- Entry point for OpenClaw gateway

#### types.ts
- All TypeScript interfaces
- Type exports for other modules
- Single source of truth for data structures

#### config.ts
- Configuration parsing
- Default values
- Environment variable resolution
- Validation

#### logger.ts
- Logging wrapper
- Consistent log format
- Debug/info/warn/error levels

#### pageindex.ts
- PageIndex CLI integration
- Subprocess management
- Timeout handling
- Output parsing

#### storage.ts
- File I/O operations
- Job persistence
- Cache management
- Index state tracking
- Metadata management

#### tools.ts
- Agent tool definitions
- Tool parameter schemas
- Result formatting
- Error handling

#### cli.ts
- CLI command registration
- Command argument parsing
- Output formatting
- Interactive feedback

## 🎨 Design Patterns

### 1. Plugin Pattern

```typescript
// Plugin activation
export async function activate(api: PluginAPI): Promise<void> {
  // Parse config
  const config = parseConfig(api.getConfig());

  // Initialize services
  const pageindex = new PageIndexClient(config.pageindexPath);
  const storage = new StorageManager(config.documentsDir);

  // Register tools and commands
  registerTools(api, pageindex, storage, config);
  registerCommands(api, pageindex, storage, config);

  log.info("Atlas plugin ready");
}
```

### 2. Repository Pattern

```typescript
// StorageManager encapsulates all data access
export class StorageManager {
  constructor(private readonly baseDir: string) {}

  async loadMetadata(): Promise<IndexMetadata> {
    // Load from file
  }

  async saveMetadata(metadata: IndexMetadata): Promise<void> {
    // Save to file
  }

  async createJob(...): Promise<string> {
    // Business logic
  }
}
```

### 3. Builder Pattern

```typescript
// Job creation with fluent interface
const jobId = await storage.createJob(targetPath, collectionName, {
  incremental: true,
  shardName: "financial-A-F"
});
```

### 4. Strategy Pattern

```typescript
// Different indexing strategies
interface IndexingStrategy {
  index(documents: string[]): Promise<IndexResult>;
}

class FullIndexStrategy implements IndexingStrategy { /* ... */ }
class IncrementalIndexStrategy implements IndexingStrategy { /* ... */ }
```

## 🔒 Error Handling

### Principles

1. **Fail gracefully** — Errors shouldn't crash the gateway
2. **Log everything** — All errors logged with context
3. **User-friendly messages** — Explain what went wrong
4. **Recovery paths** - Suggest fixes when possible

### Example

```typescript
async search(query: string): Promise<SearchResult[]> {
  try {
    return await this.pageindex.search(query);
  } catch (error) {
    log.error(`PageIndex search failed for "${query}":`, error);

    // Return empty results rather than throwing
    return [];

    // Optionally notify user
    if (this.config.debug) {
      console.error(`[DEBUG] Search failed: ${error}`);
    }
  }
}
```

## 📊 Performance Considerations

### 1. Async Operations

All long-running operations MUST be async:

```typescript
// ✅ Good: Async operation
async indexLargeCollection(path: string): Promise<string> {
  const jobId = await this.createJob(path);
  // Run in background
  this.runIndexingJob(jobId);
  return jobId;
}

// ❌ Bad: Blocking operation
indexLargeCollection(path: string): void {
  // Blocks for hours!
}
```

### 2. Caching Strategy

- **Cache hot queries** — Repeated searches get cached
- **TTL-based eviction** — Old entries expire automatically
- **Hit tracking** — Monitor cache effectiveness

### 3. Streaming Results

For large collections, stream results:

```typescript
// Stream results as they arrive
async searchStreaming(
  query: string,
  onResult: (result: SearchResult) => void
): Promise<void> {
  for await (const result of this.pageindex.streamSearch(query)) {
    onResult(result);
  }
}
```

### 4. Incremental Processing

Only process what changed:

```typescript
async indexIncremental(docs: string[]): Promise<void> {
  for (const doc of docs) {
    const state = await this.getDocumentIndexState(doc);
    const currentHash = await this.computeFileHash(doc);

    if (state?.hash === currentHash) {
      continue; // Skip unchanged
    }

    await this.indexDocument(doc);
    await this.saveDocumentIndexState(doc, currentHash);
  }
}
```

## 🧪 Testing Strategy

### Manual Testing

Comprehensive test scenarios in TESTING.md.

### Automated Testing (Future)

Planned test framework:

```bash
npm run test                # Run all tests
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests
npm run test:e2e            # End-to-end tests
```

### Test Coverage Goals

- **Unit tests**: 80%+ coverage
- **Integration tests**: All major workflows
- **E2E tests**: Critical user paths

## 📝 Documentation Standards

### Code Comments

```typescript
/**
 * Build a PageIndex tree from a document
 *
 * This method spawns the PageIndex CLI subprocess with a configurable
 * timeout. For large documents (>10MB), consider increasing the timeout.
 *
 * @param docPath - Absolute path to the document
 * @param options - Optional parameters
 * @param options.timeout - Override default timeout (default: 60s)
 * @returns Promise resolving to build result with success status and metadata
 * @throws {PageIndexTimeoutError} If indexing exceeds timeout
 * @throws {PageIndexNotFoundError} If PageIndex CLI is not installed
 *
 * @example
 * const result = await client.buildIndex("~/Documents/report.pdf");
 * console.log(`Indexed ${result.nodeCount} nodes in ${result.indexTime}ms`);
 */
async buildIndex(
  docPath: string,
  options?: { timeout?: number }
): Promise<PageIndexBuildResult> {
  // Implementation
}
```

### README Sections

Each README must have:

1. **Overview** — What the project does
2. **Installation** — How to install
3. **Quick Start** — Get started in 5 minutes
4. **Configuration** - All options documented
5. **Usage** — Common use cases
6. **API Reference** — Public API documentation
7. **Examples** — Code examples
8. **Troubleshooting** — Common issues
9. **Contributing** — How to contribute
10. **License** — License information

## 🚀 Release Process

### Version Bump

```bash
# Update version in package.json
npm version bump major  # 1.0.0 → 2.0.0
npm version bump minor  # 1.0.0 → 1.1.0
npm version bump patch   # 1.0.0 → 1.0.1

# Build
npm run build

# Commit
git add package.json CHANGELOG.md
git commit -m "chore: bump version to 1.1.0"

# Tag
git tag v1.1.0
git push origin main --tags
```

### Release Checklist

- [ ] All tests pass
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json
- [ ] Build successful
- [ ] Tested on clean environment
- [ ] GitHub release created

## 🔮 Future Architecture

### Hybrid RAG (v0.3.0+)

```typescript
interface HybridSearchEngine {
  pageindex: PageIndexClient;
  vectorStore: VectorStore;

  async search(query: string): Promise<SearchResult[]> {
    // Parallel retrieval
    const [treeResults, vectorResults] = await Promise.all([
      this.pageindex.search(query),
      this.vectorStore.search(query)
    ]);

    // Fusion with ML ranking
    return this.ranker.fusion(treeResults, vectorResults);
  }
}
```

### Distributed Indexing (v0.4.0+)

```typescript
interface DistributedIndexer {
  workers: IndexWorker[];

  async distributeJob(job: IndexJob): Promise<IndexJob[]> {
    const shards = this.createShards(job);
    return Promise.all(
      shards.map(shard => this.workers[0].index(shard))
    );
  }
}
```

## 💡 Tips and Tricks

### Debug Mode

Enable debug logging:

```yaml
plugins:
  - id: atlas
    debug: true
```

### Profile Indexing

Index with timing:

```bash
time openclaw atlas index ~/Documents
```

### Monitor Gateway Logs

```bash
tail -f ~/.openclaw/logs/gateway.log | grep "\[atlas\]"
```

### Clear State and Start Fresh

```bash
# Remove all state (careful!)
rm -rf ~/.openclaw/workspace/documents/state

# Restart gateway
launchctl kickstart -k gui/501/ai.openclaw.gateway
```

## 📚 Resources

- [PageIndex Documentation](https://github.com/VectifyAI/PageIndex)
- [OpenClaw Plugin SDK](https://github.com/openclaw/openclaw-plugin-sdk)
- [TypeScript Deep Dive](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Node.js Child Processes](https://nodejs.org/api/child_process.html)

---

**Happy coding!** 🚀
