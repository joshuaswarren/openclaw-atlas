import path from "node:path";
import type { PluginConfig } from "./types.js";

const DEFAULT_DOCUMENTS_DIR = path.join(
  process.env.HOME ?? "~",
  ".openclaw",
  "workspace",
  "documents",
);

const DEFAULT_SUPPORTED_EXTENSIONS = [".pdf", ".md", ".txt", ".html", ".htm"];

export function parseConfig(raw: unknown): PluginConfig {
  const cfg =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  return {
    enabled: cfg.enabled !== false,
    pageindexPath:
      typeof cfg.pageindexPath === "string" && cfg.pageindexPath.length > 0
        ? cfg.pageindexPath
        : undefined,
    documentsDir:
      typeof cfg.documentsDir === "string" && cfg.documentsDir.length > 0
        ? cfg.documentsDir
        : DEFAULT_DOCUMENTS_DIR,
    indexOnStartup: cfg.indexOnStartup === true,
    maxResults:
      typeof cfg.maxResults === "number" ? cfg.maxResults : 5,
    contextTokens:
      typeof cfg.contextTokens === "number" ? cfg.contextTokens : 1500,
    supportedExtensions: Array.isArray(cfg.supportedExtensions)
      ? (cfg.supportedExtensions as string[])
      : DEFAULT_SUPPORTED_EXTENSIONS,
    debug: cfg.debug === true,
    // Scaling options
    asyncIndexing: cfg.asyncIndexing !== false, // default true
    maxConcurrentIndexes: typeof cfg.maxConcurrentIndexes === "number"
      ? cfg.maxConcurrentIndexes
      : 3,
    cacheEnabled: cfg.cacheEnabled !== false, // default true
    cacheTtl: typeof cfg.cacheTtl === "number" ? cfg.cacheTtl : 5 * 60 * 1000, // 5 minutes
    shardThreshold: typeof cfg.shardThreshold === "number"
      ? cfg.shardThreshold
      : 500, // shard collections > 500 docs
  };
}
