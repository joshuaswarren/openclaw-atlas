# Atlas — Document Navigation for OpenClaw

**Atlas** is an OpenClaw plugin that provides intelligent document indexing and navigation using [PageIndex](https://github.com/VectifyAI/PageIndex), a vectorless, reasoning-based RAG system with **production-ready scaling for 5000+ documents**.

## ✨ What It Does

Atlas transforms your document collections into navigable knowledge maps:

- 📚 **Index documents** — PDFs, Markdown, text files, HTML
- 🧠 **Reasoning-based search** — No vector embeddings required
- 🎯 **Precise citations** — Exact page and section references
- 🗺️ **Hierarchical navigation** — Tree-structured document indexes
- ⚡ **Async indexing** — Non-blocking background processing
- 🔄 **Incremental updates** — Only index changed documents
- 📦 **Smart sharding** — Split large collections automatically
- 💾 **Result caching** — Lightning-fast repeated queries

## 🚀 Scaling Capabilities

Atlas is designed to scale from **10 to 5000+ documents**:

| Document Count | Index Time | Search Time | Strategy |
|----------------|------------|-------------|----------|
| 1-50 | < 5 min | < 5s | Single collection |
| 50-500 | 30-60 min | 5-15s | Async indexing |
| 500-5,000 | ~2 hours | 15-30s | **Sharding + Async** |
| 5,000+ | Use hybrid approach | 30s+ | **Topic partitioning** |

See **[SCALING.md](SCALING.md)** for comprehensive scaling documentation.

## 🎯 Why Atlas?

Traditional RAG systems chunk documents into vector embeddings. Atlas uses PageIndex's innovative approach:

- **No chunking** — Documents preserve their structure
- **LLM reasoning** — Traverses document trees intelligently
- **Perfect for** — Financial reports, legal docs, technical manuals, research papers

## 📦 Installation

1. Clone into OpenClaw extensions:
   ```bash
   git clone https://github.com/your-repo/openclaw-atlas.git \
     ~/.openclaw/extensions/openclaw-atlas
   ```

2. Install dependencies:
   ```bash
   cd ~/.openclaw/extensions/openclaw-atlas
   npm install
   ```

3. Build:
   ```bash
   npm run build
   ```

4. Install PageIndex:
   ```bash
   pip install pageindex
   ```

5. Enable in OpenClaw config:
   ```yaml
   plugins:
     - id: atlas
       enabled: true
       documentsDir: ~/Documents/atlas
   ```

## ⚙️ Configuration

### Basic Configuration

```yaml
plugins:
  - id: atlas
    enabled: true
    pageindexPath: /usr/local/bin/pageindex  # optional
    documentsDir: ~/.openclaw/workspace/documents
    indexOnStartup: false
    maxResults: 5
    contextTokens: 1500
    supportedExtensions:
      - .pdf
      - .md
      - .txt
      - .html
    debug: false
```

### Scaling Configuration

```yaml
plugins:
  - id: atlas
    # Async indexing (Phase 1)
    asyncIndexing: true          # Enable non-blocking indexing
    maxConcurrentIndexes: 3      # Parallel job limit

    # Incremental updates (Phase 2)
    # Use --incremental flag with CLI

    # Sharding (Phase 3)
    shardThreshold: 500          # Auto-shard > 500 docs

    # Caching (Phase 5)
    cacheEnabled: true           # Enable result caching
    cacheTtl: 300000             # Cache TTL: 5 minutes
```

See **[SCALING.md](SCALING.md)** for detailed scaling configuration.

## 🎮 Usage

### Agent Tools

Agents can use these tools:

```
atlas_search(query, collection?, maxResults?)
→ Search through indexed documents

atlas_index(path, collection?, background?)
→ Index a new document or directory

atlas_collections()
→ List all document collections

atlas_status()
→ Check indexing status and stats
```

### CLI Commands

```bash
# Search documents
openclaw atlas search "LLM architecture patterns"

# Index with options
openclaw atlas index ~/Documents --background        # Async
openclaw atlas index ~/Documents --incremental      # Incremental
openclaw atlas index ~/Documents --shard 200        # Force shard

# Job management
openclaw atlas jobs                                    # List all jobs
openclaw atlas job-status <job-id>                     # Check progress
openclaw atlas job-cancel <job-id>                     # Cancel job

# Cache management
openclaw atlas cache-stats                              # View cache stats
openclaw atlas cache-clear                              # Clear cache

# Collections
openclaw atlas collections                              # List collections
openclaw atlas status                                   # System status
```

## 🏗️ Architecture

```
~/.openclaw/extensions/openclaw-atlas/
├── src/
│   ├── index.ts          # Plugin entry point
│   ├── types.ts          # TypeScript interfaces
│   ├── config.ts         # Config parsing
│   ├── logger.ts         # Logging wrapper
│   ├── pageindex.ts      # PageIndex API wrapper
│   ├── storage.ts        # Document & job management
│   ├── tools.ts          # Agent tools
│   └── cli.ts            # CLI commands
├── openclaw.plugin.json  # Plugin manifest
├── README.md             # This file
├── SCALING.md            # Scaling guide
└── CLAUDE.md             # Agent guidelines
```

## 🔍 How PageIndex Works

1. **Tree Construction** — Documents become hierarchical index trees
2. **Reasoning Search** — LLMs navigate the tree to find answers
3. **Citation Preservation** — Exact source references maintained

Read more: [PageIndex GitHub](https://github.com/VectifyAI/PageIndex)

## 📈 Performance

### Small Collections (< 100 docs)
- Index time: < 5 minutes
- Search time: < 5 seconds
- Memory: ~50MB

### Medium Collections (100-1000 docs)
- Index time: 30-60 minutes (async)
- Search time: 5-15 seconds
- Memory: ~200MB

### Large Collections (1000-5000 docs)
- Index time: ~2 hours (sharded + async)
- Search time: 15-30 seconds (sharded)
- Memory: ~1GB

See **[SCALING.md](SCALING.md)** for optimization strategies.

## 🛠️ Development

```bash
# Watch mode for development
npm run dev

# Type checking
npm run typecheck

# Build
npm run build
```

## 📚 Documentation

- **[README.md](README.md)** — This file
- **[SCALING.md](SCALING.md)** — Comprehensive scaling guide
- **[CLAUDE.md](CLAUDE.md)** — Agent development guidelines

## 📄 License

MIT

## 🙏 Credits

- Built with [PageIndex](https://github.com/VectifyAI/PageIndex) by Vectify AI
- Part of the [OpenClaw](https://github.com/your-org/openclaw) ecosystem

