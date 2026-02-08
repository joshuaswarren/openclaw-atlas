import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { parseConfig } from "./config.js";
import { initLogger } from "./logger.js";
import { log } from "./logger.js";
import { PageIndex } from "pageindex-ts";
import { StorageManager } from "./storage.js";

export default {
  id: "openclaw-atlas",
  name: "Atlas (Document Indexing)",
  description:
    "Enterprise document indexing using PageIndex's vectorless, reasoning-based RAG. Scales from 10 to 5000+ documents with async indexing, incremental updates, and smart caching.",
  kind: "knowledge" as const,

  register(api: OpenClawPluginApi) {
    const cfg = parseConfig(api.pluginConfig);
    initLogger(api.logger, cfg.debug);

    if (!cfg.enabled) {
      log.info("Atlas disabled - skipping activation");
      return;
    }

    log.info("Activating Atlas plugin");

    // Initialize PageIndex with configuration
    const pageindex = new PageIndex({
      llmProvider: {
        name: "openclaw", // Will use OpenClaw's configured LLM
        model: cfg.llmModel || "gpt-4",
      },
      cacheEnabled: cfg.cacheEnabled,
      cacheSize: 100,
      debug: cfg.debug,
    });

    const storage = new StorageManager(cfg.documentsDir);

    // Ensure directories exist
    storage.ensureDirectories().catch((err) => {
      log.error("Failed to create directories:", err);
    });

    log.info("Atlas plugin ready with PageIndex TypeScript integration");
    log.info("Documents directory:", cfg.documentsDir);

    // TODO: Register tools for agents
    // TODO: Register CLI commands

    log.info("Atlas plugin ready (tools and CLI coming soon)");
  },
};
