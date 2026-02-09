import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { parseConfig } from "./config.js";
import { initLogger } from "./logger.js";
import { log } from "./logger.js";
import { PageIndex } from "openclaw-pageindex";
import { LocalLlmClient } from "./local-llm.js";
import { FallbackLlmClient } from "./fallback-llm.js";
import { registerTools } from "./tools.js";
import { registerCommands } from "./cli.js";
import type { PluginConfig } from "./types.js";
import type { LLMClientFunction } from "openclaw-pageindex";

// Type definitions for gateway config
interface ModelProviderConfig {
  baseUrl: string;
  apiKey?: string;
  api?: string;
  headers?: Record<string, string>;
  authHeader?: boolean;
}

interface GatewayConfig {
  agents?: {
    defaults?: {
      model?: {
        primary?: string;
        fallbacks?: string[];
      };
    };
  };
  models?: {
    providers?: Record<string, ModelProviderConfig>;
  };
}

/**
 * Get the primary model from gateway's fallback chain
 * Returns provider config with apiKey, baseUrl, and api type
 */
function getGatewayLlmProvider(gatewayConfig?: GatewayConfig) {
  const providers = gatewayConfig?.models?.providers;
  const defaultModel = gatewayConfig?.agents?.defaults?.model?.primary;

  if (!providers || !defaultModel) {
    return null;
  }

  // Parse "provider/model" format (e.g., "openai/gpt-5.2", "anthropic/claude-opus-4-6")
  // For nested providers like "openrouter/openrouter/pony-alpha", the provider is just the first part
  const parts = defaultModel.split("/");
  if (parts.length < 2) {
    log.warn("Invalid model format:", defaultModel);
    return null;
  }

  const providerId = parts[0];
  const modelId = parts.slice(1).join("/");
  const providerConfig = providers[providerId];

  if (!providerConfig) {
    log.warn(`Provider not found: ${providerId}. Available: ${Object.keys(providers || {}).join(", ")}`);
    return null;
  }

  const result = {
    name: providerId,
    model: modelId,
    apiKey: providerConfig.apiKey,
    baseUrl: providerConfig.baseUrl,
    api: providerConfig.api as "anthropic-messages" | "openai-completions" | "google-generative-ai" | undefined,
  };

  return result;
}

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

    // Check if user wants to override with local LLM
    if (cfg.localLlmEnabled && cfg.localLlmUrl && cfg.localLlmModel) {
      log.info("Atlas configured to use local LLM:", `${cfg.localLlmUrl} (${cfg.localLlmModel})`);
      log.info("Note: Full local LLM integration requires PageIndex modification");
      log.info("For now, Atlas will use gateway's LLM with local LLM as fallback option");
    }

    // Get LLM provider from gateway config (uses fallback chain)
    const gatewayProvider = getGatewayLlmProvider(api.config as GatewayConfig | undefined);

    if (!gatewayProvider) {
      log.error("Atlas: No LLM provider configured in gateway. Search will fail.");
      log.info("Please configure a default model in openclaw.json under agents.defaults.model.primary");
      log.info("Or enable local LLM in Atlas config (requires PageIndex modification for full support)");
      return;
    }

    const llmString = `${gatewayProvider.name}/${gatewayProvider.model}`;
    log.info(`Atlas using LLM from gateway config: ${llmString}`);
    log.info(`Atlas LLM provider name: ${gatewayProvider.name || "undefined"}`);
    log.info(`Atlas LLM provider model: ${gatewayProvider.model || "undefined"}`);
    if (cfg.debug) {
      log.debug(`Provider details: ${JSON.stringify({
        name: gatewayProvider.name,
        model: gatewayProvider.model,
        hasApiKey: !!gatewayProvider.apiKey,
        baseUrl: gatewayProvider.baseUrl,
        api: gatewayProvider.api,
      })}`);
    }

    // Initialize Local LLM client
    const localLlm = new LocalLlmClient(cfg);

    // Initialize Fallback LLM client with gateway config
    const fallbackLlm = new FallbackLlmClient(api.config as GatewayConfig | undefined);

    // Create custom LLM client adapter for PageIndex
    // This allows Atlas to use either local LLM or gateway's fallback chain
    let customLLMClient: LLMClientFunction | undefined;

    if (cfg.localLlmEnabled) {
      // Try local LLM first if enabled
      customLLMClient = async (prompt: string): Promise<string> => {
        try {
          const available = await localLlm.checkAvailability();
          if (available) {
            log.info(`Atlas: Using local LLM at ${cfg.localLlmUrl}`);
            const response = await localLlm.chatCompletion([
              { role: "user", content: prompt }
            ]);
            if (response?.content) {
              return response.content;
            }
            throw new Error("Local LLM returned empty response");
          } else if (cfg.localLlmFallback) {
            log.info("Atlas: Local LLM unavailable, falling back to gateway chain");
            // Try gateway fallback chain
            const response = await fallbackLlm.chatCompletion([
              { role: "user", content: prompt }
            ]);
            if (response?.content) {
              return response.content;
            }
            throw new Error("Both local LLM and gateway chain failed");
          }
        } catch (err) {
          if (cfg.localLlmFallback) {
            log.info("Atlas: Local LLM failed, falling back to gateway chain");
            // Try gateway fallback chain
            const response = await fallbackLlm.chatCompletion([
              { role: "user", content: prompt }
            ]);
            if (response?.content) {
              return response.content;
            }
          }
          throw err;
        }
        throw new Error("Local LLM unavailable and fallback disabled");
      };
    } else {
      // Use gateway's fallback chain directly
      customLLMClient = async (prompt: string): Promise<string> => {
        const response = await fallbackLlm.chatCompletion([
          { role: "user", content: prompt }
        ]);
        if (!response?.content) {
          throw new Error("Fallback LLM chain failed");
        }
        return response.content;
      };
    }

    // Initialize PageIndex with gateway's LLM configuration and custom client
    const pageindex = new PageIndex({
      llmProvider: {
        name: gatewayProvider.name,
        model: gatewayProvider.model,
        apiKey: gatewayProvider.apiKey,
        baseUrl: gatewayProvider.baseUrl,
      } as any, // Cast to pass api field to OpenClawLLMProvider
      customLLMClient, // Use our custom client that supports local LLM + fallback chain
      cacheEnabled: cfg.cacheEnabled,
      cacheSize: 100,
      debug: cfg.debug,
    });

    // Check local LLM availability for logging
    if (cfg.localLlmEnabled) {
      localLlm.checkAvailability().then((available) => {
        if (available) {
          const detectedType = localLlm.getDetectedType();
          log.info(`Atlas: Local LLM available: ${detectedType || "generic"} at ${cfg.localLlmUrl}`);
          log.info("Atlas: Local LLM integrated with PageIndex - will use with gateway fallback");
        } else {
          log.info("Atlas: Local LLM not available - using gateway's fallback chain");
        }
      }).catch((err) => {
        log.warn("Atlas: Local LLM health check failed:", err);
        log.info("Atlas: Falling back to gateway's LLM chain");
      });
    }

    // Register agent tools
    registerTools(api, pageindex);

    // Register CLI commands
    registerCommands(api as any, pageindex, cfg);

    log.info("Atlas plugin ready with PageIndex TypeScript integration");
    log.info("Documents directory:", cfg.documentsDir);
    log.info("LLM provider:", `${gatewayProvider.name}/${gatewayProvider.model}`);
    log.info("Fallback: PageIndex will use gateway's full fallback chain if primary fails");
    if (cfg.localLlmEnabled) {
      log.info(`Local LLM: enabled at ${cfg.localLlmUrl} (with gateway fallback)`);
    } else {
      log.info("Local LLM: disabled");
    }
    log.info("Atlas plugin ready!");
  },
};
