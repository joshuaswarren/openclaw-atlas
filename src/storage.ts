import { createHash } from "node:crypto";
import { readdir, readFile, writeFile, mkdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { log } from "./logger.js";
import type {
  DocumentCollection,
  IndexMetadata,
  IndexJob,
  IndexJobStatus,
  DocumentIndexState,
  SearchCache,
  CacheStats,
  CollectionShard,
  IncrementalIndexResult,
} from "./types.js";

export class StorageManager {
  constructor(private readonly baseDir: string) {}

  private get collectionsDir(): string {
    return path.join(this.baseDir, "collections");
  }

  private get stateDir(): string {
    return path.join(this.baseDir, "state");
  }

  private get metadataPath(): string {
    return path.join(this.stateDir, "collections.json");
  }

  private get jobsDir(): string {
    return path.join(this.stateDir, "jobs");
  }

  private get cacheDir(): string {
    return path.join(this.stateDir, "cache");
  }

  private get indexStateDir(): string {
    return path.join(this.stateDir, "index-state");
  }

  /**
   * Ensure all directories exist
   */
  async ensureDirectories(): Promise<void> {
    await mkdir(this.collectionsDir, { recursive: true });
    await mkdir(this.stateDir, { recursive: true });
    await mkdir(this.jobsDir, { recursive: true });
    await mkdir(this.cacheDir, { recursive: true });
    await mkdir(this.indexStateDir, { recursive: true });
  }

  // ---------------------------------------------------------------------------
  // Collection Management
  // ---------------------------------------------------------------------------

  /**
   * Load index metadata
   */
  async loadMetadata(): Promise<IndexMetadata> {
    try {
      const raw = await readFile(this.metadataPath, "utf-8");
      return JSON.parse(raw) as IndexMetadata;
    } catch {
      return {
        collections: {},
        lastIndexedAt: new Date().toISOString(),
        totalDocuments: 0,
        activeJobs: [],
        completedJobs: 0,
      };
    }
  }

  /**
   * Save index metadata
   */
  async saveMetadata(metadata: IndexMetadata): Promise<void> {
    await this.ensureDirectories();
    await writeFile(this.metadataPath, JSON.stringify(metadata, null, 2), "utf-8");
    log.debug("Saved index metadata");
  }

  /**
   * Register a document collection
   */
  async registerCollection(
    name: string,
    collectionPath: string,
    options?: {
      shardCount?: number;
      isSharded?: boolean;
      shards?: CollectionShard[];
    },
  ): Promise<void> {
    const metadata = await this.loadMetadata();

    metadata.collections[name] = {
      name,
      path: collectionPath,
      documentCount: 0,
      indexedAt: undefined,
      lastModified: undefined,
      isSharded: options?.isSharded,
      shards: options?.shards,
    };

    metadata.lastIndexedAt = new Date().toISOString();
    await this.saveMetadata(metadata);
    log.info(`Registered collection: ${name}`);
  }

  /**
   * Update collection stats after indexing
   */
  async updateCollectionStats(
    name: string,
    documentCount: number,
    options?: {
      shards?: CollectionShard[];
      isSharded?: boolean;
    },
  ): Promise<void> {
    const metadata = await this.loadMetadata();

    if (metadata.collections[name]) {
      metadata.collections[name].documentCount = documentCount;
      metadata.collections[name].indexedAt = new Date().toISOString();
      metadata.collections[name].lastModified = new Date().toISOString();
      if (options?.shards) {
        metadata.collections[name].shards = options.shards;
      }
      if (options?.isSharded !== undefined) {
        metadata.collections[name].isSharded = options.isSharded;
      }
    }

    metadata.totalDocuments = Object.values(metadata.collections).reduce(
      (sum, c) => sum + c.documentCount,
      0,
    );

    await this.saveMetadata(metadata);
    log.debug(`Updated stats for collection: ${name}`);
  }

  /**
   * Get all collections
   */
  async getCollections(): Promise<DocumentCollection[]> {
    const metadata = await this.loadMetadata();
    return Object.values(metadata.collections);
  }

  /**
   * Get a specific collection
   */
  async getCollection(name: string): Promise<DocumentCollection | null> {
    const metadata = await this.loadMetadata();
    return metadata.collections[name] || null;
  }

  // ---------------------------------------------------------------------------
  // Job Tracking (Phase 1: Async Indexing)
  // ---------------------------------------------------------------------------

  /**
   * Create a new indexing job
   */
  async createJob(
    targetPath: string,
    collectionName?: string,
    options?: {
      incremental?: boolean;
      shardName?: string;
    },
  ): Promise<string> {
    await this.ensureDirectories();

    const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const job: IndexJob = {
      id: jobId,
      status: "pending",
      targetPath,
      collectionName,
      totalDocuments: 0,
      processedDocuments: 0,
      failedDocuments: 0,
      incremental: options?.incremental,
      shardName: options?.shardName,
    };

    await this.saveJob(job);
    await this.addActiveJob(jobId);

    log.info(`Created indexing job: ${jobId}`);
    return jobId;
  }

  /**
   * Save job state
   */
  async saveJob(job: IndexJob): Promise<void> {
    const jobPath = path.join(this.jobsDir, `${job.id}.json`);
    await writeFile(jobPath, JSON.stringify(job, null, 2), "utf-8");
  }

  /**
   * Load a job
   */
  async loadJob(jobId: string): Promise<IndexJob | null> {
    try {
      const jobPath = path.join(this.jobsDir, `${jobId}.json`);
      const raw = await readFile(jobPath, "utf-8");
      return JSON.parse(raw) as IndexJob;
    } catch {
      return null;
    }
  }

  /**
   * Update job progress
   */
  async updateJob(update: Partial<IndexJob> & { jobId: string }): Promise<void> {
    const job = await this.loadJob(update.jobId);
    if (!job) return;

    const updated: IndexJob = {
      ...job,
      ...update,
      id: job.id, // preserve ID
    };

    await this.saveJob(updated);

    // If job is complete, remove from active jobs
    if (updated.status === "completed" || updated.status === "failed" || updated.status === "cancelled") {
      await this.removeActiveJob(update.jobId);

      const metadata = await this.loadMetadata();
      metadata.completedJobs = (metadata.completedJobs || 0) + 1;
      await this.saveMetadata(metadata);
    }
  }

  /**
   * List all jobs
   */
  async listJobs(): Promise<IndexJob[]> {
    const files = await readdir(this.jobsDir);
    const jobs: IndexJob[] = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const jobPath = path.join(this.jobsDir, file);
      try {
        const raw = await readFile(jobPath, "utf-8");
        jobs.push(JSON.parse(raw) as IndexJob);
      } catch {
        // Skip corrupted files
      }
    }

    return jobs.sort((a, b) => b.id.localeCompare(a.id));
  }

  /**
   * Add job to active jobs list
   */
  private async addActiveJob(jobId: string): Promise<void> {
    const metadata = await this.loadMetadata();
    if (!metadata.activeJobs) metadata.activeJobs = [];
    if (!metadata.activeJobs.includes(jobId)) {
      metadata.activeJobs.push(jobId);
    }
    await this.saveMetadata(metadata);
  }

  /**
   * Remove job from active jobs list
   */
  private async removeActiveJob(jobId: string): Promise<void> {
    const metadata = await this.loadMetadata();
    if (metadata.activeJobs) {
      metadata.activeJobs = metadata.activeJobs.filter(id => id !== jobId);
    }
    await this.saveMetadata(metadata);
  }

  /**
   * Get active jobs count
   */
  async getActiveJobsCount(): Promise<number> {
    const metadata = await this.loadMetadata();
    return metadata.activeJobs?.length || 0;
  }

  // ---------------------------------------------------------------------------
  // Incremental Indexing (Phase 2)
  // ---------------------------------------------------------------------------

  /**
   * Get index state for a document
   */
  async getDocumentIndexState(docPath: string): Promise<DocumentIndexState | null> {
    const statePath = this.getDocumentStatePath(docPath);
    try {
      const raw = await readFile(statePath, "utf-8");
      return JSON.parse(raw) as DocumentIndexState;
    } catch {
      return null;
    }
  }

  /**
   * Save index state for a document
   */
  async saveDocumentIndexState(state: DocumentIndexState): Promise<void> {
    await this.ensureDirectories();
    const statePath = this.getDocumentStatePath(state.path);
    await writeFile(statePath, JSON.stringify(state, null, 2), "utf-8");
  }

  /**
   * Compute SHA-256 hash of file
   */
  async computeFileHash(filePath: string): Promise<string> {
    const crypto = await import("node:crypto");
    const hash = crypto.createHash("sha256");
    const contents = await readFile(filePath);
    hash.update(contents);
    return hash.digest("hex");
  }

  /**
   * Get state file path for a document
   */
  private getDocumentStatePath(docPath: string): string {
    // Use filename (escaped) as state file name
    const basename = path.basename(docPath);
    const safeName = basename.replace(/[^a-zA-Z0-9.-]/g, "_");
    return path.join(this.indexStateDir, `${safeName}.json`);
  }

  // ---------------------------------------------------------------------------
  // Caching (Phase 5)
  // ---------------------------------------------------------------------------

  /**
   * Generate cache key for a search
   */
  private getCacheKey(query: string, collection?: string): string {
    const col = collection || "all";
    const hash = this.simpleHash(query + col);
    return `cache-${hash}.json`;
  }

  /**
   * Simple string hash for cache keys
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get cached search results
   */
  async getCache(query: string, collection?: string): Promise<SearchCache | null> {
    const cacheKey = this.getCacheKey(query, collection);
    const cachePath = path.join(this.cacheDir, cacheKey);

    try {
      const raw = await readFile(cachePath, "utf-8");
      const cache: SearchCache = JSON.parse(raw);

      // Check if cache is expired
      const now = Date.now();
      const expiresAt = new Date(cache.ttl).getTime();

      if (now > expiresAt) {
        // Cache expired, delete it
        await this.deleteCache(query, collection);
        return null;
      }

      // Update hit count
      cache.hitCount++;
      await writeFile(cachePath, JSON.stringify(cache, null, 2), "utf-8");

      return cache;
    } catch {
      return null;
    }
  }

  /**
   * Save search results to cache
   */
  async setCache(
    query: string,
    results: unknown[],
    collection?: string,
    ttl: number = 5 * 60 * 1000,
  ): Promise<void> {
    await this.ensureDirectories();

    const cacheKey = this.getCacheKey(query, collection);
    const cachePath = path.join(this.cacheDir, cacheKey);

    const expiresAt = new Date(Date.now() + ttl).toISOString();

    const cache: SearchCache = {
      query,
      collection,
      results: results as any,
      cachedAt: new Date().toISOString(),
      hitCount: 0,
      ttl: expiresAt,
      resultCount: results.length,
    };

    await writeFile(cachePath, JSON.stringify(cache, null, 2), "utf-8");
    log.debug(`Cached search results: ${query}`);
  }

  /**
   * Delete a cache entry
   */
  async deleteCache(query: string, collection?: string): Promise<void> {
    const cacheKey = this.getCacheKey(query, collection);
    const cachePath = path.join(this.cacheDir, cacheKey);

    try {
      await unlink(cachePath);
    } catch {
      // File doesn't exist, that's fine
    }
  }

  /**
   * Clear all cache entries
   */
  async clearCache(): Promise<number> {
    const files = await readdir(this.cacheDir);
    let deleted = 0;

    for (const file of files) {
      if (file.endsWith(".json")) {
        const cachePath = path.join(this.cacheDir, file);
        try {
          await unlink(cachePath);
          deleted++;
        } catch {
          // Skip errors
        }
      }
    }

    log.info(`Cleared ${deleted} cache entries`);
    return deleted;
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<CacheStats> {
    const files = await readdir(this.cacheDir);
    const cacheFiles = files.filter(f => f.endsWith(".json"));

    let totalHits = 0;
    let totalMisses = 0;
    let sizeBytes = 0;
    let oldest: string | undefined;
    let newest: string | undefined;

    for (const file of cacheFiles) {
      const cachePath = path.join(this.cacheDir, file);
      try {
        const raw = await readFile(cachePath, "utf-8");
        const cache: SearchCache = JSON.parse(raw);

        totalHits += cache.hitCount;
        sizeBytes += raw.length;

        const cachedAt = new Date(cache.cachedAt);
        if (!oldest || cachedAt < new Date(oldest)) oldest = cache.cachedAt;
        if (!newest || cachedAt > new Date(newest)) newest = cache.cachedAt;
      } catch {
        // Skip corrupted files
      }
    }

    // Estimate misses (not tracked precisely)
    totalMisses = Math.max(0, totalHits * 2); // Rough estimate

    const hitRate = totalHits + totalMisses > 0
      ? totalHits / (totalHits + totalMisses)
      : 0;

    return {
      totalEntries: cacheFiles.length,
      totalHits,
      totalMisses,
      hitRate,
      sizeBytes,
      oldestEntry: oldest,
      newestEntry: newest,
    };
  }

  // ---------------------------------------------------------------------------
  // File Operations
  // ---------------------------------------------------------------------------

  /**
   * Scan a directory for supported documents
   */
  async scanDirectory(
    dirPath: string,
    extensions: string[],
  ): Promise<string[]> {
    const documents: string[] = [];

    const scan = async (currentPath: string) => {
      try {
        const entries = await readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);

          if (entry.isDirectory()) {
            await scan(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (extensions.includes(ext)) {
              documents.push(fullPath);
            }
          }
        }
      } catch (err) {
        log.debug(`Failed to scan ${currentPath}: ${err}`);
      }
    };

    await scan(dirPath);
    return documents;
  }

  /**
   * Get file stats (size, modified time)
   */
  async getFileInfo(filePath: string): Promise<{
    size: number;
    modified: string;
  } | null> {
    try {
      const stats = await stat(filePath);
      return {
        size: stats.size,
        modified: stats.mtime.toISOString(),
      };
    } catch {
      return null;
    }
  }

  /**
   * Check if a file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await stat(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
