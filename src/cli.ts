import { log } from "./logger.js";
import type {
  PageIndexClient,
  PluginConfig,
  StorageManager,
} from "./types.js";

/**
 * Register Atlas CLI commands
 */
export function registerCommands(
  api: {
    registerCommand: (def: {
      name: string;
      description: string;
      handler: (...args: string[]) => Promise<void>;
    }) => void;
  },
  pageindex: PageIndexClient,
  storage: StorageManager,
  config: PluginConfig,
): void {
  /**
   * Search documents
   */
  api.registerCommand({
    name: "atlas",
    description: "Document indexing and navigation using PageIndex",
    handler: async (args: string[]) => {
      if (args.length === 0) {
        console.log(`
🗺️  Atlas — Document Navigation

Usage:
  openclaw atlas search <query>       Search indexed documents
  openclaw atlas index <path>         Index a document or directory
  openclaw atlas collections          List all collections
  openclaw atlas status               Show indexing status

For more help: https://github.com/your-repo/openclaw-atlas
        `);
        return;
      }

      const [subcommand, ...subargs] = args;

      switch (subcommand) {
        case "search":
          await handleSearch(pageindex, config, subargs);
          break;
        case "index":
          await handleIndex(pageindex, storage, config, subargs);
          break;
        case "collections":
          await handleCollections(storage);
          break;
        case "status":
          await handleStatus(pageindex, storage);
          break;
        default:
          console.error(`❌ Unknown subcommand: ${subcommand}`);
          console.log(`Available: search, index, collections, status`);
      }
    },
  });
}

async function handleSearch(
  pageindex: PageIndexClient,
  config: PluginConfig,
  args: string[],
): Promise<void> {
  if (args.length === 0) {
    console.error("❌ Query required");
    console.log("Usage: openclaw atlas search <query>");
    return;
  }

  const query = args.join(" ");
  log.info(`Searching: "${query}"`);

  try {
    const results = await pageindex.search(query, undefined, config.maxResults);

    if (results.length === 0) {
      console.log(`📭 No results found for "${query}"`);
      return;
    }

    console.log(`📚 Found ${results.length} result(s):\n`);

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      console.log(`### Result ${i + 1}`);
      console.log(`**Citation:** ${result.citation}`);
      if (result.page) console.log(`**Page:** ${result.page}`);
      if (result.section) console.log(`**Section:** ${result.section}`);
      console.log();
      console.log(result.content);
      console.log();
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`❌ Search failed: ${errorMsg}`);
  }
}

async function handleIndex(
  pageindex: PageIndexClient,
  storage: StorageManager,
  config: PluginConfig,
  args: string[],
): Promise<void> {
  if (args.length === 0) {
    console.error("❌ Path required");
    console.log("Usage: openclaw atlas index <path> [collection-name]");
    return;
  }

  const targetPath = args[0];
  const collectionName = args[1];

  log.info(`Indexing: ${targetPath}`);

  try {
    const exists = await storage.fileExists(targetPath);
    if (!exists) {
      console.error(`❌ Path not found: ${targetPath}`);
      return;
    }

    const result = await pageindex.buildIndex(targetPath);

    if (result.success) {
      console.log(`✅ Successfully indexed ${targetPath}`);
      console.log(`⏱️  Index time: ${result.indexTime}ms`);
      if (result.nodeCount) console.log(`📊 Nodes: ${result.nodeCount}`);

      if (collectionName) {
        await storage.registerCollection(collectionName, targetPath);
        console.log(`📁 Registered to collection: ${collectionName}`);
      }
    } else {
      console.error(`❌ Indexing failed: ${result.error}`);
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`❌ Indexing failed: ${errorMsg}`);
  }
}

async function handleCollections(storage: StorageManager): Promise<void> {
  log.info("Listing collections");

  try {
    const collections = await storage.getCollections();

    if (collections.length === 0) {
      console.log("📭 No collections found.");
      console.log("Index documents with: openclaw atlas index <path>");
      return;
    }

    console.log(`📚 Atlas Collections (${collections.length}):\n`);

    for (const coll of collections) {
      console.log(`**${coll.name}**`);
      console.log(`  Path: ${coll.path}`);
      console.log(`  Documents: ${coll.documentCount}`);
      if (coll.indexedAt) console.log(`  Indexed: ${coll.indexedAt}`);
      if (coll.lastModified) console.log(`  Modified: ${coll.lastModified}`);
      console.log();
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`❌ Failed to list collections: ${errorMsg}`);
  }
}

async function handleStatus(
  pageindex: PageIndexClient,
  storage: StorageManager,
): Promise<void> {
  log.info("Checking Atlas status");

  try {
    const metadata = await storage.loadMetadata();
    const collections = await storage.getCollections();

    console.log(`🗺️  Atlas Status\n`);
    console.log(`**PageIndex:** ${pageindex.isAvailable() ? "✅ Available" : "❌ Not Available"}`);
    console.log(`**Collections:** ${collections.length}`);
    console.log(`**Total Documents:** ${metadata.totalDocuments}`);
    console.log(`**Last Index:** ${metadata.lastIndexedAt}\n`);

    if (collections.length > 0) {
      console.log(`### Collections`);
      for (const coll of collections.slice(0, 5)) {
        console.log(`- **${coll.name}**: ${coll.documentCount} docs`);
      }
      if (collections.length > 5) {
        console.log(`- ... and ${collections.length - 5} more`);
      }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`❌ Status check failed: ${errorMsg}`);
  }
}
