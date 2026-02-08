# Atlas Plugin

## PUBLIC REPOSITORY — Privacy Policy

**This repository is PUBLIC on GitHub.** Every commit is visible to the world.

### Rules for ALL agents committing to this repo:

1. **NEVER commit personal documents** — no PDFs, reports, or user files
2. **NEVER commit document content** — the `documents/` directory contains user files and must NEVER be committed
3. **NEVER commit indexes or cache** — PageIndex indexes are user-specific
4. **NEVER commit API keys, tokens, or secrets** — even in comments or examples
5. **NEVER reference specific users or their documents** in code comments or commit messages
6. **Config examples must use placeholders** — `${DOCUMENTS_DIR}`, not actual paths
7. **Test data must be synthetic** — never use real document content in tests

### What IS safe to commit:
- Source code (`src/`)
- Package manifests (`package.json`, `tsconfig.json`, `tsup.config.ts`)
- Plugin manifest (`openclaw.plugin.json`)
- Documentation (`README.md`, this `CLAUDE.md`)
- Build configuration
- `.gitignore`
- Synthetic test fixtures

### Before every commit, verify:
- `git diff --cached` contains NO personal information
- No document content, file paths with usernames, or credentials
- No references to specific users or their documents

## Architecture Notes

### File Structure
```
src/
├── index.ts              # Plugin entry point, hook registration
├── types.ts              # TypeScript interfaces
├── config.ts             # Config parsing with defaults
├── logger.ts             # Logging wrapper
├── pageindex.ts          # PageIndex API client
├── storage.ts            # Document file management
├── tools.ts              # Agent tools (search, index, status)
└── cli.ts                # CLI commands
```

### Key Patterns

1. **PageIndex integration** — Spawns pageindex CLI subprocess
2. **Document collections** — Organized by user-defined topics/projects
3. **Tree-based search** — No vectors, just LLM reasoning over document trees
4. **Citation preservation** — Exact page/section references maintained
5. **Lazy indexing** — Only index when requested or on startup if enabled

### Integration Points

- `api.on("gateway_start")` — Initialize PageIndex client
- `api.on("before_agent_start")` — Inject document context
- `api.registerTool()` — atlas_search, atlas_index, atlas_collections, atlas_status
- `api.registerCommand()` — CLI interface
- `api.registerService()` — Service lifecycle management

### Common Gotchas

1. **PageIndex must be installed** — `pip install pageindex`
2. **Subprocess timeouts** — PageIndex can be slow on large docs, use generous timeouts
3. **Path resolution** — Use absolute paths, resolve ~ properly
4. **File type detection** — Check extensions before indexing
5. **Memory limits** — Large documents may hit LLM context limits
6. **Config schema strict** — New properties MUST be added to `openclaw.plugin.json`

## Testing Locally

```bash
# Build
npm run build

# Restart gateway
launchctl kickstart -k gui/501/ai.openclaw.gateway

# Or hot reload
kill -USR1 $(pgrep openclaw-gateway)

# Test search
openclaw atlas search "test query"

# View logs
grep "\[atlas\]" ~/.openclaw/logs/gateway.log
```

## PageIndex API Notes

### Core Commands

```bash
# Build index from document
pageindex build /path/to/document.pdf

# Search indexed documents
pageindex search "query" --collection mydocs

# List collections
pageindex collections

# Get document info
pageindex info /path/to/document.pdf
```

### Integration Strategy

- Spawn `pageindex` as subprocess (not Python import)
- Capture JSON output via `--json` flag
- Use generous timeouts (30s+ for large docs)
- Cache index metadata in `state/collections.json`

## Document Storage Layout

```
~/.openclaw/workspace/documents/
├── collections/
│   ├── financial/
│   │   ├── report-2024.pdf
│   │   └── budget.pdf
│   └── technical/
│       ├── api-docs.pdf
│       └── architecture.md
└── state/
    ├── collections.json   # Collection metadata
    └── index-cache.json   # Index status tracking
```

## Future Enhancements

- [ ] Multi-format support (DOCX, PPTX)
- [ ] Incremental indexing (update on file change)
- [ ] Collection tagging/folders
- [ ] Search result caching
- [ ] Hybrid search (Atlas + Engram unified)
- [ ] Document preview snippets
