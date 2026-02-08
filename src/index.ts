import { log } from "./logger.js";
import { parseConfig } from "./config.js";
import { PageIndexClient } from "./pageindex.js";
import { StorageManager } from "./storage.js";
import { registerTools } from "./tools.js";
import { registerCommands } from "./cli.js";

// Plugin API types (simplified - actual types provided by OpenClaw at runtime)
interface PluginAPI {
  on(event: string, handler: (...args: unknown[]) => void | Promise<void>): void;
  registerTool(def: {
    name: string;
    description: string;
    parameters: unknown;
    handler: (params: Record<string, unknown>) => Promise<string>;
  }): void;
  registerCommand(def: {
    name: string;
    description: string;
    handler: (...args: string[]) => Promise<void>;
  }): void;
  getConfig(): unknown;
}

export async function activate(api: PluginAPI): Promise<void> {
  // Parse configuration
  const rawConfig = api.getConfig();
  const config = parseConfig(rawConfig);

  if (!config.enabled) {
    log.info("Atlas disabled - skipping activation");
    return;
  }

  log.info("Activating Atlas plugin");

  // Initialize services
  const pageindex = new PageIndexClient(config.pageindexPath);
  const storage = new StorageManager(config.documentsDir);

  // Ensure directories exist
  await storage.ensureDirectories();

  // Probe PageIndex availability
  const available = await pageindex.probe();
  if (!available) {
    log.warn("PageIndex CLI not found - install with: pip install pageindex");
  }

  // Register tools for agents
  registerTools(api, pageindex, storage, config);
  log.debug("Registered agent tools");

  // Register CLI commands
  registerCommands(api, pageindex, storage, config);
  log.debug("Registered CLI commands");

  // Optional: Auto-index on startup
  if (config.indexOnStartup && available) {
    log.info("Auto-indexing enabled");
    // TODO: Implement auto-indexing logic
  }

  log.info("Atlas plugin ready");
}

export async function deactivate(): Promise<void> {
  log.info("Atlas plugin deactivated");
}
