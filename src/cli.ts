/**
 * CLI commands for Atlas document search
 */

import type { ReplyPayload } from "openclaw/plugin-sdk";
import { PageIndex } from "openclaw-pageindex";
import { log } from "./logger.js";
import type { PluginConfig } from "./types.js";

const ATLAS_USAGE = `
🗺️  Atlas — Document Navigation

Usage:
  openclaw atlas search <query>       Search indexed documents
  openclaw atlas index <path>         Index a document or directory
  openclaw atlas collections          List all collections
  openclaw atlas stats               Show index statistics

Examples:
  openclaw atlas search "machine learning"
  openclaw atlas index ./docs/report.pdf
  openclaw atlas collections

For more help: https://github.com/joshuaswarren/openclaw-atlas
`;

export function registerCommands(
  api: {
    registerCommand: (def: {
      name: string;
      description: string;
      acceptsArgs?: boolean;
      requireAuth?: boolean;
      handler: (ctx: { args?: string }) => ReplyPayload | Promise<ReplyPayload>;
    }) => void;
  },
  pageindex: PageIndex,
  config: PluginConfig,
): void {
  // Main atlas command group
  api.registerCommand({
    name: "atlas",
    description: "Document indexing and navigation using PageIndex",
    acceptsArgs: true,
    requireAuth: false,
    handler: async (ctx) => {
      const argsStr = ctx.args?.trim() ?? "";
      const args = argsStr.split(/\s+/).filter(a => a.length > 0);

      if (args.length === 0) {
        return { text: ATLAS_USAGE };
      }

      const [subcommand, ...subargs] = args;

      switch (subcommand) {
        case "search":
          return handleSearch(pageindex, config, subargs);
        case "index":
          return handleIndex(pageindex, subargs);
        case "collections":
          return handleCollections(pageindex);
        case "stats":
          return handleStats(pageindex);
        default:
          return { text: `❌ Unknown subcommand: ${subcommand}\nAvailable: search, index, collections, stats\n${ATLAS_USAGE}` };
      }
    },
  });

  log.info("Atlas CLI commands registered: atlas search, index, collections, stats");
}

function handleSearch(
  pageindex: PageIndex,
  config: PluginConfig,
  args: string[],
): ReplyPayload | Promise<ReplyPayload> {
  if (args.length === 0) {
    return { text: "❌ Query required\nUsage: openclaw atlas search <query>" };
  }

  const query = args.join(" ");
  log.info(`Searching: "${query}"`);

  // Execute search asynchronously
  return (async () => {
    try {
      const results = await pageindex.search({
        query,
        maxResults: config.maxResults,
      });

      if (results.length === 0) {
        return { text: `📭 No results found for "${query}"` };
      }

      let output = `📚 Found ${results.length} result(s):\n\n`;

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        output += `### Result ${i + 1}\n`;
        output += `**Document:** ${result.citation.documentTitle}\n`;
        if (result.citation.pageNumber) {
          output += `**Page:** ${result.citation.pageNumber}\n`;
        }
        if (result.citation.section) {
          output += `**Section:** ${result.citation.section}\n`;
        }
        output += `**Relevance:** ${(result.relevance * 100).toFixed(1)}%\n\n`;
        output += `${result.excerpt}\n\n`;
      }

      return { text: output };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { text: `❌ Search failed: ${errorMsg}` };
    }
  })();
}

function handleIndex(pageindex: PageIndex, args: string[]): ReplyPayload | Promise<ReplyPayload> {
  if (args.length === 0) {
    return { text: "❌ Path required\nUsage: openclaw atlas index <path> [collection-name]" };
  }

  const targetPath = args[0];
  const collectionName = args[1];
  log.info(`Indexing: ${targetPath}`);

  // Execute index asynchronously
  return (async () => {
    try {
      const docId = await pageindex.addDocument(targetPath, undefined, collectionName);

      let output = `✅ Successfully indexed ${targetPath}\n`;
      output += `📄 Document ID: ${docId}\n`;
      if (collectionName) {
        output += `📁 Collection: ${collectionName}`;
      }

      return { text: output };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { text: `❌ Indexing failed: ${errorMsg}` };
    }
  })();
}

function handleCollections(pageindex: PageIndex): ReplyPayload | Promise<ReplyPayload> {
  log.info("Listing collections");

  // Execute collections list asynchronously
  return (async () => {
    try {
      const collections = pageindex.listCollections();
      const stats = pageindex.getStats();

      if (collections.length === 0) {
        return { text: "📭 No collections found.\nIndex documents with: openclaw atlas index <path>" };
      }

      let output = `📚 Atlas Collections (${collections.length}):\n\n`;

      for (const coll of collections) {
        output += `**${coll.name}**\n`;
        output += `  Documents: ${coll.documentCount}\n`;
        if (coll.indexedAt) {
          output += `  Indexed: ${coll.indexedAt}\n`;
        }
        if (coll.lastModified) {
          output += `  Modified: ${coll.lastModified}`;
        }
        output += "\n";
      }

      output += `**Total Documents:** ${stats.totalDocuments}\n`;
      output += `**Total Nodes:** ${stats.totalNodes}`;

      return { text: output };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { text: `❌ Failed to list collections: ${errorMsg}` };
    }
  })();
}

function handleStats(pageindex: PageIndex): ReplyPayload | Promise<ReplyPayload> {
  log.info("Getting stats");

  // Execute stats asynchronously
  return (async () => {
    try {
      const stats = pageindex.getStats();

      let output = `🗺️  Atlas Statistics\n\n`;
      output += `**Total Documents:** ${stats.totalDocuments}\n`;
      output += `**Total Nodes:** ${stats.totalNodes}\n`;
      output += `**Total Characters:** ${stats.totalChars.toLocaleString()}\n`;
      output += `**Index Size:** ${(stats.indexSize / 1024).toFixed(2)} KB\n`;
      output += `**Last Updated:** ${stats.lastUpdated}`;

      return { text: output };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { text: `❌ Failed to get stats: ${errorMsg}` };
    }
  })();
}
