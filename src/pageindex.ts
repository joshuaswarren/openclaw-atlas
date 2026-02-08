import { spawn } from "node:child_process";
import path from "node:path";
import { log } from "./logger.js";
import type {
  PageIndexBuildResult,
  PageIndexSearchResult,
  DocumentCollection,
} from "./types.js";

const PAGEINDEX_TIMEOUT_MS = 60_000; // 60 seconds for large docs
const SEARCH_TIMEOUT_MS = 30_000;

/**
 * Resolve PageIndex executable path
 */
function resolvePageIndex(configPath?: string): string {
  if (configPath) return configPath;
  if (process.env.PAGEINDEX_PATH) return process.env.PAGEINDEX_PATH;
  return "pageindex"; // Assume it's in PATH
}

/**
 * Run PageIndex CLI command
 */
async function runPageIndex(
  args: string[],
  timeoutMs: number,
  executablePath?: string,
): Promise<{ stdout: string; stderr: string }> {
  const pageindex = resolvePageIndex(executablePath);

  return new Promise((resolve, reject) => {
    const child = spawn(pageindex, args, {
      env: { ...process.env, NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`pageindex ${args.join(" ")} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(
          new Error(
            `pageindex ${args.join(" ")} failed (code ${code}): ${stderr || stdout}`,
          ),
        );
      }
    });
  });
}

export class PageIndexClient {
  private available: boolean | null = null;
  private executablePath: string;

  constructor(executablePath?: string) {
    this.executablePath = executablePath;
  }

  /**
   * Check if PageIndex CLI is available
   */
  async probe(): Promise<boolean> {
    try {
      const { stdout } = await runPageIndex(["--version"], 5000, this.executablePath);
      log.debug(`PageIndex version: ${stdout.trim()}`);
      this.available = true;
      return true;
    } catch (err) {
      log.warn(`PageIndex not available: ${err}`);
      this.available = false;
      return false;
    }
  }

  /**
   * Check if PageIndex is available
   */
  isAvailable(): boolean {
    return this.available === true;
  }

  /**
   * Build index from a document
   */
  async buildIndex(documentPath: string): Promise<PageIndexBuildResult> {
    if (this.available === false) {
      return {
        success: false,
        documentPath,
        error: "PageIndex not available",
      };
    }

    const startTime = Date.now();
    try {
      log.info(`Building index for ${documentPath}`);
      const { stdout } = await runPageIndex(
        ["build", documentPath, "--json"],
        PAGEINDEX_TIMEOUT_MS,
        this.executablePath,
      );

      const result = JSON.parse(stdout);
      const indexTime = Date.now() - startTime;

      log.debug(`Index built in ${indexTime}ms, ${result.node_count || 0} nodes`);

      return {
        success: true,
        documentPath,
        indexTime,
        nodeCount: result.node_count,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log.error(`Failed to build index for ${documentPath}: ${errorMsg}`);
      return {
        success: false,
        documentPath,
        error: errorMsg,
      };
    }
  }

  /**
   * Search indexed documents
   */
  async search(
    query: string,
    collection?: string,
    maxResults: number = 5,
  ): Promise<PageIndexSearchResult[]> {
    if (this.available === false) return [];
    const trimmed = query.trim();
    if (!trimmed) return [];

    try {
      const args = ["search", trimmed, "--json", "-n", String(maxResults)];
      if (collection) {
        args.push("--collection", collection);
      }

      const { stdout } = await runPageIndex(args, SEARCH_TIMEOUT_MS, this.executablePath);
      const parsed = JSON.parse(stdout);

      if (!Array.isArray(parsed.results)) return [];

      return parsed.results.map((r: Record<string, unknown>) => ({
        content: (r.content as string) ?? "",
        citation: (r.citation as string) ?? "",
        page: r.page ? Number(r.page) : undefined,
        section: (r.section as string) ?? undefined,
        score: r.score ? Number(r.score) : undefined,
      }));
    } catch (err) {
      log.debug(`PageIndex search failed: ${err}`);
      return [];
    }
  }

  /**
   * List all collections
   */
  async listCollections(): Promise<DocumentCollection[]> {
    if (this.available === false) return [];

    try {
      const { stdout } = await runPageIndex(
        ["collections", "--json"],
        10_000,
        this.executablePath,
      );
      const parsed = JSON.parse(stdout);

      if (!Array.isArray(parsed)) return [];

      return parsed.map((c: Record<string, unknown>) => ({
        name: (c.name as string) ?? "",
        path: (c.path as string) ?? "",
        documentCount: c.document_count ? Number(c.document_count) : 0,
        indexedAt: c.indexed_at ? String(c.indexed_at) : undefined,
        lastModified: c.last_modified ? String(c.last_modified) : undefined,
      }));
    } catch (err) {
      log.debug(`Failed to list collections: ${err}`);
      return [];
    }
  }

  /**
   * Get document info
   */
  async getDocumentInfo(documentPath: string): Promise<{
    indexed: boolean;
    nodeCount?: number;
    indexedAt?: string;
  }> {
    if (this.available === false) {
      return { indexed: false };
    }

    try {
      const { stdout } = await runPageIndex(
        ["info", documentPath, "--json"],
        10_000,
        this.executablePath,
      );
      const parsed = JSON.parse(stdout);

      return {
        indexed: true,
        nodeCount: parsed.node_count ? Number(parsed.node_count) : undefined,
        indexedAt: parsed.indexed_at ? String(parsed.indexed_at) : undefined,
      };
    } catch (err) {
      log.debug(`Document not indexed: ${documentPath}`);
      return { indexed: false };
    }
  }
}
