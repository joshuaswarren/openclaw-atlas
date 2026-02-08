/**
 * Atlas plugin type definitions
 */

export interface PluginConfig {
  enabled: boolean;
  pageindexPath?: string;
  documentsDir: string;
  indexOnStartup: boolean;
  maxResults: number;
  contextTokens: number;
  supportedExtensions: string[];
  debug: boolean;
  // Scaling options
  asyncIndexing?: boolean;
  maxConcurrentIndexes?: number;
  cacheEnabled?: boolean;
  cacheTtl?: number;
  shardThreshold?: number;
}

export interface DocumentCollection {
  name: string;
  path: string;
  documentCount: number;
  indexedAt?: string;
  lastModified?: string;
  // Sharding support
  shards?: CollectionShard[];
  isSharded?: boolean;
}

export interface CollectionShard {
  name: string;
  range: string; // e.g., "A-F", "G-P", "Q-Z" or custom ranges
  count: number;
  path: string;
}

export interface DocumentSearchResult {
  collection: string;
  documentPath: string;
  pageNumber?: number;
  section?: string;
  content: string;
  confidence: number;
  citation: string;
  shard?: string;
}

export interface IndexMetadata {
  collections: Record<string, DocumentCollection>;
  lastIndexedAt: string;
  totalDocuments: number;
  // Job tracking
  activeJobs?: string[];
  completedJobs?: number;
}

export interface PageIndexBuildResult {
  success: boolean;
  documentPath: string;
  indexTime?: number;
  nodeCount?: number;
  error?: string;
}

export interface PageIndexSearchResult {
  content: string;
  citation: string;
  page?: number;
  section?: string;
  score?: number;
}

export interface AtlasContext {
  query: string;
  results: DocumentSearchResult[];
  totalTokens: number;
}

// ---------------------------------------------------------------------------
// Async Indexing (Phase 1)
// ---------------------------------------------------------------------------

export type IndexJobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface IndexJob {
  id: string;
  status: IndexJobStatus;
  targetPath: string;
  collectionName?: string;
  totalDocuments: number;
  processedDocuments: number;
  failedDocuments: number;
  startedAt?: string;
  completedAt?: string;
  eta?: string;
  error?: string;
  // Incremental support
  incremental?: boolean;
  skippedDocuments?: number; // Unchanged docs
  // Shard info
  shardName?: string;
}

export interface IndexJobUpdate {
  jobId: string;
  status: IndexJobStatus;
  processedDocuments: number;
  failedDocuments: number;
  eta?: string;
}

// ---------------------------------------------------------------------------
// Incremental Indexing (Phase 2)
// ---------------------------------------------------------------------------

export interface DocumentIndexState {
  path: string;
  indexedAt: string;
  fileModifiedAt: string;
  hash: string; // SHA-256
  size: number;
  lastIndexedHash?: string;
}

export interface IncrementalIndexResult {
  totalDocuments: number;
  newDocuments: number;
  changedDocuments: number;
  unchangedDocuments: number;
  failedDocuments: number;
  indexTime: number;
}

// ---------------------------------------------------------------------------
// Caching (Phase 5)
// ---------------------------------------------------------------------------

export interface SearchCache {
  query: string;
  collection?: string;
  results: PageIndexSearchResult[];
  cachedAt: string;
  hitCount: number;
  ttl: string; // expiration time
  resultCount: number;
}

export interface CacheStats {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  sizeBytes: number;
  oldestEntry?: string;
  newestEntry?: string;
}

// ---------------------------------------------------------------------------
// Streaming (Phase 4)
// ---------------------------------------------------------------------------

export type SearchResultStream = (result: DocumentSearchResult) => void;
export type StreamComplete = () => void;
export type StreamError = (error: Error) => void;

export interface StreamingSearchOptions {
  onResult: SearchResultStream;
  onComplete?: StreamComplete;
  onError?: StreamError;
  maxResults?: number;
  collection?: string;
}

export interface SearchProgress {
  query: string;
  shardsSearched: number;
  totalShards: number;
  resultsFound: number;
  elapsedMs: number;
}
