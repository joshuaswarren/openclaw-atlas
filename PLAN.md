# Atlas Plugin - Planned Enhancements

This document tracks future work items for the Atlas document indexing plugin.

## Completed (v0.2.0)

- ✅ Core PageIndex TypeScript integration (openclaw-pageindex module)
- ✅ Multi-provider LLM support (Anthropic, OpenAI, Google)
- ✅ Agent tools for document search
- ✅ CLI commands for terminal usage
- ✅ Local LLM support with autodetection (Ollama, LM Studio, MLX, vLLM)
- ✅ Hierarchical document tree parsing
- ✅ Precise citation tracking (page numbers, sections)

## Phase 1: Enhanced Local LLM Integration

### Status: Pending
### Priority: High
### Effort: 2-3 days

**Description:** Integrate local LLM directly into openclaw-pageindex LLM calls

Current implementation uses OpenClaw's configured LLM. This phase would modify openclaw-pageindex to support local LLM with fallback to cloud providers.

**Tasks:**
- [ ] Add `LocalLlmClient` to openclaw-pageindex src/llm.ts
- [ ] Modify `callOpenClawLLM()` to try local LLM first
- [ ] Implement fallback to cloud providers (Anthropic, OpenAI, Google)
- [ ] Add local LLM health check before search operations
- [ ] Update PageIndexConfig to include local LLM options
- [ ] Test with Ollama, LM Studio, and generic OpenAI-compatible servers

**Acceptance Criteria:**
- Atlas tries local LLM first when enabled
- Falls back to cloud provider if local unavailable
- Logs detected server type and availability
- Works with all major local LLM providers

---

## Phase 2: Incremental Indexing

### Status: Pending
### Priority: Medium
### Effort: 3-5 days

**Description:** Track document changes and only reindex modified files

Currently, all documents are fully reindexed on every operation. This phase adds change detection and incremental updates.

**Tasks:**
- [ ] Implement SHA-256 hashing for document content
- [ ] Store `lastIndexedHash` in document metadata
- [ ] Compare file hash vs. indexed hash before indexing
- [ ] Skip unchanged documents with timestamp logging
- [ ] Track statistics: new, changed, unchanged, failed documents
- [ ] Add `--incremental` flag to CLI commands
- [ ] Store index state in `~/.openclaw/workspace/atlas/state.json`

**Acceptance Criteria:**
- Detects unchanged documents and skips them
- Only reindexes modified/new documents
- Reports detailed statistics on what changed
- State persists across gateway restarts

**Related Types:**
- `DocumentIndexState` (already defined in types.ts)
- `IncrementalIndexResult` (already defined in types.ts)

---

## Phase 3: Streaming Search

### Status: Pending
### Priority: Low
### Effort: 2-3 days

**Description:** Stream search results as they're found for large collections

For collections with 500+ documents, waiting for all results causes delays. Streaming improves perceived latency.

**Tasks:**
- [ ] Add `StreamingSearchOptions` interface
- [ ] Implement `SearchResultStream` callback
- [ ] Modify `searchWithLLM()` to yield results incrementally
- [ ] Add streaming support to agent tools
- [ ] Add `--stream` flag to CLI commands
- [ ] Track and report search progress

**Acceptance Criteria:**
- Results appear as soon as they're found
- Progress updates during long searches
- Works with both agent and CLI interfaces
- Gracefully handles stream errors

**Related Types:**
- `StreamingSearchOptions` (already defined in types.ts)
- `SearchProgress` (already defined in types.ts)

---

## Phase 4: Collection Sharding

### Status: Pending
### Priority: Low
### Effort: 3-4 days

**Description:** Automatically shard large collections for better performance

Collections with 1000+ documents can become slow. Sharding splits them into smaller, faster collections.

**Tasks:**
- [ ] Implement shard detection based on document count
- [ ] Auto-shard collections exceeding threshold (default: 500 docs)
- [ ] Support custom shard ranges (A-F, G-P, Q-Z)
- [ ] Route searches to relevant shards only
- [ ] Add shard metadata to collection info
- [ ] CLI commands to manage shards (split, merge, list)
- [ ] Update `DocumentCollection` interface with shard info

**Acceptance Criteria:**
- Auto-shards large collections on index
- Searches only query relevant shards
- Shards can be split/merged manually
- Transparent to users (works automatically)

**Related Types:**
- `CollectionShard` (already defined in types.ts)
- `DocumentCollection.shards` (already defined in types.ts)

---

## Phase 5: Advanced Caching

### Status: Pending
### Priority: Low
### Effort: 2-3 days

**Description:** Implement intelligent search result caching with TTL

Frequently repeated queries (e.g., during agent sessions) should be cached to reduce LLM calls.

**Tasks:**
- [ ] Implement in-memory search cache with LRU eviction
- [ ] Add cache key generation (query + collection hash)
- [ ] Store cached results with TTL (default: 5 minutes)
- [ ] Track cache hit/miss statistics
- [ ] Add `--no-cache` flag to bypass cache
- [ ] Persist cache to disk for cross-session caching
- [ ] Add cache stats to `atlas_stats` tool

**Acceptance Criteria:**
- Cache hits return instantly (< 10ms)
- Cache respects TTL and evicts old entries
- Cache statistics are trackable
- Can be disabled per-query

**Related Types:**
- `SearchCache` (already defined in types.ts)
- `CacheStats` (already defined in types.ts)

---

## Phase 6: Async Background Indexing

### Status: Pending
### Priority: Medium
### Effort: 4-5 days

**Description:** Run large indexing jobs in background without blocking

Indexing 1000+ PDFs can take hours. This phase adds job queuing and background processing.

**Tasks:**
- [ ] Implement job queue with status tracking
- [ ] Add job state persistence ( survives restarts)
- [ ] Support concurrent indexing with configurable limits
- [ ] Add job progress reporting (ETA, processed/total)
- [ ] Implement job cancellation
- [ ] Add `atlas_jobs` CLI command
- [ ] Add job status to `atlas_status` tool
- [ ] Support job prioritization

**Acceptance Criteria:**
- Large indexing jobs run in background
- Job status is queryable at any time
- Jobs can be cancelled mid-execution
- Multiple jobs can run concurrently (configurable)
- Job state persists across gateway restarts

**Related Types:**
- `IndexJob` (already defined in types.ts)
- `IndexJobStatus` (already defined in types.ts)
- `IndexJobUpdate` (already defined in types.ts)

---

## Future Enhancements (Backlog)

### Document Formats
- [ ] DOCX support (Microsoft Word)
- [ ] PPTX support (PowerPoint)
- [ ] EPUB support (eBooks)
- [ ] Image OCR (Tesseract.js)

### Search Features
- [ ] Fuzzy search for typos
- [ ] Semantic search with query expansion
- [ ] Faceted search (by date, type, tags)
- [ ] Proximity search (find X near Y)
- [ ] Regular expression search

### User Experience
- [ ] Web UI for browsing collections
- [ ] Document preview in search results
- [ ] Highlighted matches in excerpts
- [ ] Export search results to CSV/JSON
- [ ] Batch document upload (web UI)

### Performance
- [ ] Parallel document parsing
- [ ] Incremental LLM context building
- [ ] Query result pagination
- [ ] Search result ranking/scoring tweaks

### Integrations
- [ ] Obsidian vault integration ([[links]] support)
- [ ] Notion integration
- [ ] Confluence integration
- [ ] SharePoint integration
- [ ] Google Drive integration

### Enterprise Features
- [ ] Access control (user/group permissions)
- [ ] Audit logging (who searched what)
- [ ] Document versioning support
- [ ] Retention policies (auto-delete old docs)
- [ ] Compliance mode (redaction, PII detection)

---

## Implementation Notes

### Priority Guidelines
- **High:** Blocks adoption or critical for functionality
- **Medium:** Important but not blocking
- **Low:** Nice-to-have or edge cases

### Effort Estimation
- Effort estimates assume:
  - Familiarity with codebase
  - No major refactoring required
  - Testing included
  - Documentation updated

### Dependencies Between Phases
- Phase 2 (Incremental) enables Phase 6 (Async) efficiency
- Phase 4 (Sharding) benefits from Phase 5 (Caching)
- Phase 3 (Streaming) useful for Phase 6 (Async) progress updates

---

## Contributing

When implementing a phase:
1. Create a feature branch from `main`
2. Update this PLAN.md with status changes
3. Write tests for new functionality
4. Update CLAUDE.md with any new patterns
5. Submit PR with phase number in title

Example PR title: "Phase 2: Implement incremental indexing"
