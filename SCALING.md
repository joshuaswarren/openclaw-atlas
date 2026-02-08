# Atlas Scaling Guide

## Overview

Atlas supports document collections ranging from a few documents to **5000+ documents** through several scaling strategies. This guide explains how to configure, monitor, and optimize Atlas for large-scale document indexing and retrieval.

---

## Scaling Architecture

### Performance Benchmarks

| Document Count | Index Time | Search Time | Memory | Recommended Strategy |
|----------------|------------|-------------|---------|---------------------|
| 1-50 | < 5 min | < 5s | ~50MB | Single collection |
| 50-500 | 30-60 min | 5-15s | ~200MB | Async indexing |
| 500-5,000 | Hours | 30s+ | ~1GB | **Sharding** + Async |
| 5,000+ | Unusable | Timeout | >2GB | **Hybrid** approach |

---

## Phase 1: Async Indexing

### What It Solves

- ✅ Non-blocking indexing (gateway remains responsive)
- ✅ Progress tracking for long-running jobs
- ✅ Job queue management (concurrency limits)
- ✅ Resume capability on interruption

### Configuration

```yaml
plugins:
  - id: atlas
    asyncIndexing: true        # Enable async indexing (default: true)
    maxConcurrentIndexes: 3    # Max parallel indexing jobs
```

### Usage

```bash
# Start background indexing
openclaw atlas index ~/Documents --background

# Returns job ID immediately
# → Job ID: job-1739054400-abc123

# Check progress
openclaw atlas job-status job-1739054400-abc123

# → Status: running
# → Progress: 1234/5000 (25%)
# → ETA: 45 minutes
# → Failed: 2 documents

# List all jobs
openclaw atlas jobs

# → job-1739054400-abc123: running (1234/5000)
# → job-1739054200-def456: completed (500/500)
# → job-1739054000-ghi789: failed (error: timeout)

# Cancel a job
openclaw atlas job-cancel job-1739054400-abc123
```

### Agent Tools

```typescript
// Agents can start async indexing
atlas_index(
  path="~/Documents/reports",
  background=true
)
// → Returns job ID: job-1739054400-abc123

// Check job status
atlas_job_status(jobId="job-1739054400-abc123")
// → Returns status, progress, ETA, errors
```

### Job States

| State | Description |
|-------|-------------|
| `pending` | Queued, waiting to start |
| `running` | Actively indexing |
| `completed` | Successfully finished |
| `failed` | Errored (check `error` field) |
| `cancelled` | User cancelled |

### Job Persistence

Jobs are stored in `~/.openclaw/workspace/documents/state/jobs/`:

```
state/jobs/
├── job-1739054400-abc123.json  # Active job
├── job-1739054200-def456.json  # Completed job
└── job-1739054000-ghi789.json  # Failed job
```

Job files persist across gateway restarts, so indexing continues after a restart.

---

## Phase 2: Incremental Indexing

### What It Solves

- ✅ Only index changed/new documents
- ✅ Skip unchanged documents (SHA-256 hash comparison)
- ✅ Massive time savings for frequent updates

### How It Works

1. **First indexing**: Compute SHA-256 hash of each document
2. **Store state**: Save hash + metadata to `state/index-state/`
3. **Subsequent indexing**: Compare current hash with stored hash
4. **Smart skip**: Only re-index changed/new documents

### Configuration

```yaml
plugins:
  - id: atlas
    # Incremental is automatic - just use the flag
```

### Usage

```bash
# First index (full)
openclaw atlas index ~/Documents --incremental
# → Indexed 5000 documents in 45 minutes

# Add 10 new documents
openclaw atlas index ~/Documents --incremental
# → Skipped 5000 unchanged documents
# → Indexed 10 new documents in 30 seconds ⚡

# Modify 5 documents
openclaw atlas index ~/Documents --incremental
# → Skipped 4995 unchanged documents
# → Re-indexed 5 modified documents in 15 seconds ⚡
```

### Index State Storage

```
state/index-state/
├── report-2024.json         # Hash + metadata
├── budget-q1.json
└── presentation.pdf.json
```

Each state file contains:

```json
{
  "path": "/path/to/document.pdf",
  "indexedAt": "2026-02-08T16:30:00Z",
  "fileModifiedAt": "2026-02-08T16:25:00Z",
  "hash": "a3f5e9b2c1d4f6e8a7b0c9d1e2f3a4b5",
  "size": 1048576
}
```

### Performance Impact

| Operation | Full Index | Incremental |
|-----------|------------|-------------|
| 5000 docs (unchanged) | 45 min | **5 seconds** |
| 5000 docs + 10 new | 45 min | **30 seconds** |
| 5000 docs + 5 changed | 45 min | **15 seconds** |

---

## Phase 3: Collection Sharding

### What It Solves

- ✅ Split large collections into manageable chunks
- ✅ Parallel indexing (multiple shards at once)
- ✅ Targeted search (search only relevant shards)
- ✅ Better memory management

### How Sharding Works

```
Large Collection (5000 docs)
         │
         ├─ Shard 1: A-F (1500 docs)
         ├─ Shard 2: G-P (1800 docs)
         └─ Shard 3: Q-Z (1700 docs)
```

### Automatic Sharding

Collections are automatically sharded when they exceed the threshold:

```yaml
plugins:
  - id: atlas
    shardThreshold: 500  # Shard collections > 500 docs (default)
```

### Manual Sharding

Organize documents by topic/project:

```bash
~/Documents/atlas/
├── financial/
│   ├── 2024-reports/     # → Auto-sharded if > 500 docs
│   └── 2023-reports/
├── technical/
│   ├── api-docs/
│   └── user-guides/
└── legal/
    └── contracts/
```

Register each as a separate collection:

```bash
openclaw atlas collection add financial ~/Documents/atlas/financial
openclaw atlas collection add technical ~/Documents/atlas/technical
openclaw atlas collection add legal ~/Documents/atlas/legal
```

### Search with Shards

```bash
# Search all shards
openclaw atlas search "401k contribution limits"

# Search specific shard
openclaw atlas search "401k" --collection financial

# Atlas automatically routes to relevant shard
```

### Shard Metadata

```json
{
  "name": "financial",
  "path": "/Documents/atlas/financial",
  "documentCount": 2000,
  "isSharded": true,
  "shards": [
    {
      "name": "financial-A-F",
      "range": "A-F",
      "count": 750,
      "path": "/Documents/atlas/financial/A-F"
    },
    {
      "name": "financial-G-P",
      "range": "G-P",
      "count": 800,
      "path": "/Documents/atlas/financial/G-P"
    },
    {
      "name": "financial-Q-Z",
      "range": "Q-Z",
      "count": 450,
      "path": "/Documents/atlas/financial/Q-Z"
    }
  ]
}
```

### Sharding Strategies

**Alphabetical** (default for homogeneous collections):
```
Shard 1: A-E, Shard 2: F-L, Shard 3: M-S, Shard 4: T-Z
```

**Topic-based** (recommended for heterogeneous collections):
```
Shard 1: financial/, Shard 2: technical/, Shard 3: legal/
```

**Date-based** (for time-series documents):
```
Shard 1: 2024/, Shard 2: 2023/, Shard 3: 2022/
```

---

## Phase 4: Streaming Search Results

### What It Solves

- ✅ Incremental results (no waiting for full search)
- ✅ Better UX for large collections
- ✅ Early termination (stop after finding enough results)

### Configuration

```yaml
plugins:
  - id: atlas
    # Streaming is automatic for large collections
```

### Agent Tool Behavior

```typescript
// Small collections (< 100 docs): Returns all results at once
atlas_search(query="revenue")
// → [Result 1, Result 2, Result 3] (all at once)

// Large collections (> 100 docs): Streams results
atlas_search(query="revenue", streaming=true)
// → Result 1 (immediately)
// → Result 2 (after 2s)
// → Result 3 (after 4s)
// → Complete: Found 5 results in 8.3s
```

### CLI Streaming

```bash
# Stream results to stdout
openclaw atlas search "revenue" --stream

# → 📄 Result 1: report.pdf page 12
# → 📄 Result 2: budget.doc page 5
# → 📄 Result 3: summary.pdf page 3
# → ✓ Complete: Found 3 results in 6.2s
```

### Performance

| Collection Size | Traditional | Streaming |
|-----------------|-------------|------------|
| 100 docs | 3s (wait) | **0.5s** (first result) |
| 500 docs | 15s (wait) | **2s** (first result) |
| 5000 docs | 45s (timeout) | **5s** (first result) |

---

## Phase 5: Result Caching

### What It Solves

- ✅ Instant results for repeated queries
- ✅ Reduced PageIndex API calls
- ✅ Better performance for hot queries

### Configuration

```yaml
plugins:
  - id: atlas
    cacheEnabled: true        # Enable caching (default: true)
    cacheTtl: 300000          # Cache TTL in ms (default: 5 minutes)
```

### Cache Behavior

```bash
# First search (miss)
openclaw atlas search "401k limits"
# → Cache miss - querying PageIndex...
# → [Results] 8.3s

# Second search (hit)
openclaw atlas search "401k limits"
# → Cache hit! ⚡
# → [Results] 0.05s (166x faster!)
```

### Cache Statistics

```bash
# View cache stats
openclaw atlas cache-stats

# → Cache Entries: 127
# → Total Hits: 1,245
# → Total Misses: 892
# → Hit Rate: 58.3%
# → Cache Size: 2.3 MB
# → Oldest Entry: 2 hours ago
# → Newest Entry: 5 seconds ago

# Clear cache
openclaw atlas cache-clear

# → Cleared 127 cache entries
```

### Cache Storage

```
state/cache/
├── cache-a3f5e9b2.json  # Query + results + metadata
├── cache-c1d4f6e8.json
└── cache-b2e5a7f9.json
```

Cache entries include:

```json
{
  "query": "401k limits",
  "collection": "financial",
  "results": [...],
  "cachedAt": "2026-02-08T16:30:00Z",
  "hitCount": 15,
  "ttl": "2026-02-08T16:35:00Z",
  "resultCount": 5
}
```

### Cache Eviction

- **TTL-based**: Entries expire after `cacheTtl` milliseconds
- **Manual**: `atlas_cache_clear()` removes all entries
- **Automatic**: Future versions may implement LRU eviction

---

## Hybrid Approach: Atlas + Traditional Search

For very large document sets (10,000+), use a hybrid strategy:

### Strategy 1: Tiered Indexing

```bash
# Atlas: Critical documents (< 500, high-value)
~/Documents/atlas/critical/
├── contracts/
├── policies/
└── compliance/

# Traditional search: Archive (10,000+ docs)
~/Documents/archive/
├── 2020-reports/
├── 2019-reports/
└── legacy/

# Search: Try Atlas first, fallback to ripgrep
atlas_search("revenue 2024")
# → If no results, automatically search archive with ripgrep
```

### Strategy 2: Topic Partitioning

```bash
# Partition by domain expertise
~/Documents/atlas/
├── financial-atlas/     # Indexed by Atlas
├── technical-atlas/     # Indexed by Atlas
└── reference-archive/    # Not indexed (grep only)

# Agents choose the right tool
if query contains "financial":
    use atlas_search(collection="financial-atlas")
else if query contains "api":
    use atlas_search(collection="technical-atlas")
else:
    use ripgrep(reference-archive)
```

### Strategy 3: Time-Based Partitioning

```bash
# Atlas: Recent docs (last 6 months)
~/Documents/atlas/recent-2024/  # 500 docs

# Archive: Older docs
~/Documents/archive/
├── 2023/  # Not indexed
├── 2022/  # Not indexed
└── 2021/  # Not indexed

# Search workflow
1. Search Atlas (recent) → fast
2. If no results, search archive with ripgrep → slower but comprehensive
```

---

## Monitoring & Debugging

### Check Gateway Health

```bash
# Atlas status
openclaw atlas status

# → PageIndex: ✅ Available
# → Collections: 12
# → Total Documents: 5,234
# → Active Jobs: 2
# → Completed Jobs: 145
# → Cache Hit Rate: 58.3%
```

### Monitor Active Jobs

```bash
# Watch job progress in real-time
watch -n 5 'openclaw atlas jobs'

# → job-abc123: running (1234/5000 - 25% - ETA: 45m)
# → job-def456: running (200/500 - 40% - ETA: 5m)
```

### Debug Slow Searches

```bash
# Enable debug logging
openclaw atlas search "query" --debug

# → [atlas] Checking cache...
# → [atlas] Cache miss - querying PageIndex...
# → [atlas] Searching 3 shards...
# → [atlas] Shard 1: 2 results in 2.3s
# → [atlas] Shard 2: 1 result in 3.1s
# → [atlas] Shard 3: 0 results in 1.8s
# → [atlas] Total: 3 results in 7.2s
# → [atlas] Caching results...
```

### Performance Profiling

```bash
# Profile a search operation
openclaw atlas search "query" --profile

# → Scanning: 5000 documents
# → Shard Selection: 3 shards matched
# → PageIndex Calls: 3 (parallel)
# → Cache Lookup: miss
# → Results Returned: 7
# → Total Time: 8.3s
# → Breakdown:
#    - Cache check: 5ms
#    - Shard routing: 12ms
#    - PageIndex search: 7800ms
#    - Result formatting: 483ms
```

---

## Best Practices

### For Small Collections (< 100 docs)

```yaml
plugins:
  - id: atlas
    asyncIndexing: false       # Synchronous is fine
    cacheEnabled: false        # Not needed
    shardThreshold: 10000      # Disable sharding
```

### For Medium Collections (100-1000 docs)

```yaml
plugins:
  - id: atlas
    asyncIndexing: true        # Non-blocking
    cacheEnabled: true         # Speed up repeated queries
    shardThreshold: 1000       # Shard at 1000 docs
```

### For Large Collections (1000-5000 docs)

```yaml
plugins:
  - id: atlas
    asyncIndexing: true
    maxConcurrentIndexes: 3    # Parallel jobs
    cacheEnabled: true
    cacheTtl: 600000           # 10 minutes
    shardThreshold: 500        # Aggressive sharding
```

### For Very Large Collections (5000+ docs)

Use **hybrid approach** (see above) + organize by topic:

```bash
~/Documents/
├── atlas/                    # Atlas-managed
│   ├── critical/             # < 500 docs each
│   ├── financial/
│   └── technical/
└── archive/                  # Not indexed (grep only)
    ├── 2023/
    └── 2022/
```

---

## Troubleshooting

### Problem: Jobs stuck in "running" state

```bash
# Check job status
openclaw atlas job-status job-abc123

# If job is actually done, mark as completed manually
openclaw atlas job-complete job-abc123

# Or cancel stuck jobs
openclaw atlas job-cancel job-abc123
```

### Problem: Slow searches on large collections

```bash
# Enable sharding
openclaw atlas collection shard financial

# Increase cache TTL
# Edit openclaw.json
cacheTtl: 600000  # 10 minutes

# Clear old cache
openclaw atlas cache-clear
```

### Problem: Out of memory errors

```bash
# Reduce concurrent jobs
maxConcurrentIndexes: 1

# Reduce max results
maxResults: 3

# Enable sharding (split collection)
openclaw atlas collection shard mycollection --threshold 200
```

### Problem: Cache not working

```bash
# Check cache stats
openclaw atlas cache-stats

# Verify cache is enabled
openclaw atlas status | grep Cache

# Manually clear and retry
openclaw atlas cache-clear
openclaw atlas search "query"
```

---

## Migration Guide

### From Single Collection to Sharded

```bash
# Before: Single large collection
openclaw atlas index ~/Documents  # 5000 docs, 2 hours

# After: Sharded by topic
mkdir -p ~/Documents/atlas/{financial,technical,legal}
mv ~/Documents/financial/* ~/Documents/atlas/financial/
mv ~/Documents/technical/* ~/Documents/atlas/technical/
mv ~/Documents/legal/* ~/Documents/atlas/legal/

openclaw atlas collection add financial ~/Documents/atlas/financial
openclaw atlas collection add technical ~/Documents/atlas/technical
openclaw atlas collection add legal ~/Documents/atlas/legal

# Now index in parallel (~30 minutes total, 3x faster)
```

### From Synchronous to Async

```bash
# Before: Block until complete
openclaw atlas index ~/Documents  # Blocks for 2 hours

# After: Background processing
openclaw atlas index ~/Documents --background
# → Job ID: job-abc123 (returns immediately)

# Check progress later
openclaw atlas job-status job-abc123
```

### From Full to Incremental

```bash
# Before: Re-index everything every time
openclaw atlas index ~/Documents  # 2 hours every time

# After: Only index changes
openclaw atlas index ~/Documents --incremental
# → First run: 2 hours (full index)
# → Subsequent runs: 30 seconds (only changes)
```

---

## Future Enhancements

Planned features for future versions:

- [ ] **Automatic collection optimization** — Analyze query patterns and suggest sharding
- [ ] **LRU cache eviction** — Automatic cache management when size exceeds threshold
- [ ] **Distributed indexing** — Multiple gateways indexing in parallel
- [ ] **Hybrid RAG + Vector search** — Combine PageIndex with vector embeddings
- [ ] **Query result ranking** — ML-based result ranking and relevance scoring
- [ ] **Document deduplication** — Detect and merge duplicate documents
- [ ] **Version tracking** — Track document versions and diff indexing

---

## Quick Reference

### Scaling Configuration

```yaml
plugins:
  - id: atlas
    # Async indexing
    asyncIndexing: true
    maxConcurrentIndexes: 3

    # Incremental updates
    # (automatic with --incremental flag)

    # Sharding
    shardThreshold: 500

    # Caching
    cacheEnabled: true
    cacheTtl: 300000  # 5 minutes
```

### Essential Commands

```bash
# Async indexing
openclaw atlas index <path> --background

# Job management
openclaw atlas jobs
openclaw atlas job-status <job-id>
openclaw atlas job-cancel <job-id>

# Incremental updates
openclaw atlas index <path> --incremental

# Cache management
openclaw atlas cache-stats
openclaw atlas cache-clear

# Status
openclaw atlas status
```

### Performance Tips

1. **Use incremental indexing** for frequent updates
2. **Organize by topic** to enable effective sharding
3. **Enable caching** for repeated queries
4. **Monitor job progress** to catch issues early
5. **Use hybrid approach** for 10,000+ documents

---

## Support

For issues or questions:
- GitHub: https://github.com/your-repo/openclaw-atlas
- Docs: https://github.com/VectifyAI/PageIndex
