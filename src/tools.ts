import { log } from "./logger.js";
import type { PluginConfig } from "./types.js";
import type { PageIndexClient } from "./pageindex.js";
import type { StorageManager } from "./storage.js";

/**
 * Register Atlas tools for agent use
 */
export function registerTools(
  api: {
    registerTool: (def: {
      name: string;
      description: string;
      parameters: unknown;
      handler: (params: Record<string, unknown>) => Promise<string>;
    }) => void;
  },
  pageindex: PageIndexClient,
  storage: StorageManager,
  config: PluginConfig,
): void {
  /**
   * Search through indexed documents
   */
  api.registerTool({
    name: "atlas_search",
    description: `Search through indexed document collections using PageIndex's reasoning-based search.
Returns relevant document excerpts with precise citations (page numbers, sections).

Use this when you need to:
- Find specific information in PDFs, reports, or documentation
- Locate exact passages or sections in long documents
- Reference authoritative sources with proper citations

The search uses LLM reasoning to navigate document trees, not vector similarity.`,
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query - be specific and use keywords from the document",
        },
        collection: {
          type: "string",
          description: "Optional: specific collection to search (omitted = search all)",
          optional: true,
        },
        maxResults: {
          type: "number",
          description: "Maximum results to return (default: 5)",
          optional: true,
        },
      },
      required: ["query"],
    },
    handler: async (params: Record<string, unknown>) => {
      const query = params.query as string;
      const collection = params.collection as string | undefined;
      const maxResults = (params.maxResults as number) ?? config.maxResults;

      if (!query || !query.trim()) {
        return "❌ Query required - please provide a search term";
      }

      log.info(`Searching Atlas: "${query}"`);

      try {
        const results = await pageindex.search(query, collection, maxResults);

        if (results.length === 0) {
          return `📭 No results found for "${query}"`;
        }

        let output = `📚 Found ${results.length} result(s) for "${query}":\n\n`;

        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          output += `### Result ${i + 1}\n`;
          output += `**Citation:** ${result.citation}\n`;
          if (result.page) output += `**Page:** ${result.page}\n`;
          if (result.section) output += `**Section:** ${result.section}\n`;
          output += `\n${result.content}\n\n`;
        }

        return output;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        log.error(`Search failed: ${errorMsg}`);
        return `❌ Search failed: ${errorMsg}`;
      }
    },
  });

  /**
   * Index a new document or directory
   */
  api.registerTool({
    name: "atlas_index",
    description: `Index a document or directory for search using PageIndex.

Supported formats: PDF, Markdown, TXT, HTML
Indexing builds a hierarchical tree structure for reasoning-based retrieval.

Use this when you need to:
- Add new documents to the search index
- Re-index modified documents
- Build an index for a document directory`,
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to document file or directory to index",
        },
        collection: {
          type: "string",
          description: "Collection name for organizing documents",
          optional: true,
        },
      },
      required: ["path"],
    },
    handler: async (params: Record<string, unknown>) => {
      const targetPath = params.path as string;
      const collectionName = params.collection as string | undefined;

      if (!targetPath) {
        return "❌ Path required - please provide a document or directory path";
      }

      log.info(`Indexing: ${targetPath}`);

      try {
        const exists = await storage.fileExists(targetPath);
        if (!exists) {
          return `❌ Path not found: ${targetPath}`;
        }

        const result = await pageindex.buildIndex(targetPath);

        if (result.success) {
          let output = `✅ Successfully indexed ${targetPath}\n`;
          output += `⏱️  Index time: ${result.indexTime}ms\n`;
          if (result.nodeCount) output += `📊 Nodes: ${result.nodeCount}\n`;

          // Register collection if specified
          if (collectionName) {
            await storage.registerCollection(collectionName, targetPath);
            output += `📁 Registered to collection: ${collectionName}\n`;
          }

          return output;
        } else {
          return `❌ Indexing failed: ${result.error}`;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        log.error(`Indexing failed: ${errorMsg}`);
        return `❌ Indexing failed: ${errorMsg}`;
      }
    },
  });

  /**
   * List all document collections
   */
  api.registerTool({
    name: "atlas_collections",
    description: `List all document collections registered in Atlas.

Shows collection names, paths, document counts, and indexing status.`,
    parameters: {
      type: "object",
      properties: {},
    },
    handler: async () => {
      log.info("Listing collections");

      try {
        const collections = await storage.getCollections();

        if (collections.length === 0) {
          return "📭 No collections found. Index documents with atlas_index to get started.";
        }

        let output = `📚 Atlas Collections (${collections.length}):\n\n`;

        for (const coll of collections) {
          output += `**${coll.name}**\n`;
          output += `- Path: ${coll.path}\n`;
          output += `- Documents: ${coll.documentCount}\n`;
          if (coll.indexedAt) output += `- Indexed: ${coll.indexedAt}\n`;
          if (coll.lastModified) output += `- Modified: ${coll.lastModified}\n`;
          output += `\n`;
        }

        return output;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        log.error(`Failed to list collections: ${errorMsg}`);
        return `❌ Failed to list collections: ${errorMsg}`;
      }
    },
  });

  /**
   * Get Atlas status and stats
   */
  api.registerTool({
    name: "atlas_status",
    description: `Get Atlas indexing status and statistics.

Shows PageIndex availability, collection counts, and system health.`,
    parameters: {
      type: "object",
      properties: {},
    },
    handler: async () => {
      log.info("Checking Atlas status");

      try {
        const metadata = await storage.loadMetadata();
        const collections = await storage.getCollections();

        let output = `🗺️  Atlas Status\n\n`;
        output += `**PageIndex:** ${pageindex.isAvailable() ? "✅ Available" : "❌ Not Available"}\n`;
        output += `**Collections:** ${collections.length}\n`;
        output += `**Total Documents:** ${metadata.totalDocuments}\n`;
        output += `**Last Index:** ${metadata.lastIndexedAt}\n\n`;

        if (collections.length > 0) {
          output += `### Collections\n`;
          for (const coll of collections.slice(0, 5)) {
            output += `- **${coll.name}**: ${coll.documentCount} docs\n`;
          }
          if (collections.length > 5) {
            output += `- ... and ${collections.length - 5} more\n`;
          }
        }

        return output;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        log.error(`Status check failed: ${errorMsg}`);
        return `❌ Status check failed: ${errorMsg}`;
      }
    },
  });
}
