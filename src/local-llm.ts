import { log } from "./logger.js";
import type { PluginConfig } from "./types.js";

/**
 * Local LLM client for OpenAI-compatible endpoints (LM Studio, Ollama, MLX, etc.)
 *
 * Based on openclaw-tactician's provider detection patterns for consistency.
 * Provides privacy-preserving, cost-effective LLM operations with
 * graceful fallback to cloud providers when local LLM is unavailable.
 */
export type LocalLlmType = "lmstudio" | "ollama" | "mlx" | "vllm" | "generic";

interface LocalServerConfig {
  type: LocalLlmType;
  defaultPort: number;
  healthEndpoint: string;
  modelsEndpoint: string;
  detectFn: (response: unknown) => boolean;
}

const LOCAL_SERVERS: LocalServerConfig[] = [
  {
    type: "ollama",
    defaultPort: 11434,
    healthEndpoint: "/",
    modelsEndpoint: "/api/tags",
    detectFn: (resp) => typeof resp === "string" && resp.includes("Ollama"),
  },
  {
    type: "mlx",
    defaultPort: 8080,
    healthEndpoint: "/v1/models",
    modelsEndpoint: "/v1/models",
    detectFn: (resp) =>
      typeof resp === "object" &&
      resp !== null &&
      "data" in resp &&
      Array.isArray((resp as { data: unknown[] }).data),
  },
  {
    type: "lmstudio",
    defaultPort: 1234,
    healthEndpoint: "/v1/models",
    modelsEndpoint: "/v1/models",
    detectFn: (resp) =>
      typeof resp === "object" &&
      resp !== null &&
      "data" in resp &&
      Array.isArray((resp as { data: unknown[] }).data),
  },
  {
    type: "vllm",
    defaultPort: 8000,
    healthEndpoint: "/health",
    modelsEndpoint: "/v1/models",
    detectFn: (resp) => resp === "" || (typeof resp === "object" && resp !== null),
  },
];

export class LocalLlmClient {
  private config: PluginConfig;
  private isAvailable: boolean | null = null;
  private lastHealthCheck: number = 0;
  private detectedType: LocalLlmType | null = null;
  private static readonly HEALTH_CHECK_INTERVAL_MS = 60000; // 1 minute

  constructor(config: PluginConfig) {
    this.config = config;
  }

  /**
   * Get the detected server type (null if not detected)
   */
  getDetectedType(): LocalLlmType | null {
    return this.detectedType;
  }

  /**
   * Fetch with timeout for health checks
   */
  private async fetchWithTimeout(
    url: string,
    timeoutMs: number = 2000
  ): Promise<{ ok: boolean; data: unknown }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return { ok: false, data: null };
      }

      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        return { ok: true, data: await response.json() };
      } else {
        return { ok: true, data: await response.text() };
      }
    } catch (err) {
      clearTimeout(timeout);
      return { ok: false, data: null };
    }
  }

  /**
   * Check if local LLM is available
   * Uses 127.0.0.1 instead of localhost to avoid DNS issues (consistent with tactician)
   */
  async checkAvailability(): Promise<boolean> {
    // Cache health check results for 1 minute
    const now = Date.now();
    if (this.isAvailable !== null && now - this.lastHealthCheck < LocalLlmClient.HEALTH_CHECK_INTERVAL_MS) {
      return this.isAvailable;
    }

    // Normalize URL - replace localhost with 127.0.0.1, remove trailing slashes
    const baseUrl = this.config.localLlmUrl
      .replace("localhost", "127.0.0.1")
      .replace(/\/+$/, "");

    // Try to detect which server type is running
    for (const serverConfig of LOCAL_SERVERS) {
      const healthUrl = `${baseUrl}${serverConfig.healthEndpoint}`;
      log.debug(`checking ${serverConfig.type} at ${healthUrl}`);

      const result = await this.fetchWithTimeout(healthUrl);
      if (result.ok && serverConfig.detectFn(result.data)) {
        this.isAvailable = true;
        this.detectedType = serverConfig.type;
        this.lastHealthCheck = now;
        log.info(`detected ${serverConfig.type} at ${baseUrl}`);
        return true;
      }
    }

    // Generic check if specific detection failed
    try {
      const modelsUrl = `${baseUrl}/v1/models`;
      const result = await this.fetchWithTimeout(modelsUrl);
      if (result.ok) {
        this.isAvailable = true;
        this.detectedType = "generic";
        this.lastHealthCheck = now;
        log.info(`detected generic OpenAI-compatible server at ${baseUrl}`);
        return true;
      }
    } catch {
      // Fall through to unavailable
    }

    this.isAvailable = false;
    this.detectedType = null;
    this.lastHealthCheck = now;
    log.debug("local LLM not available at", baseUrl);
    return false;
  }

  /**
   * Make a chat completion request to local LLM
   */
  async chatCompletion(
    messages: Array<{ role: string; content: string }>,
    options: {
      temperature?: number;
      maxTokens?: number;
      responseFormat?: { type: string };
    } = {}
  ): Promise<{
    content: string;
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  } | null> {
    if (!this.config.localLlmEnabled) {
      return null;
    }

    const isAvailable = await this.checkAvailability();
    if (!isAvailable) {
      return null;
    }

    try {
      const requestBody: Record<string, unknown> = {
        model: this.config.localLlmModel,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4096,
      };

      if (options.responseFormat) {
        requestBody.response_format = options.responseFormat;
      }

      // Normalize URL (use 127.0.0.1 instead of localhost)
      const baseUrl = this.config.localLlmUrl
        .replace("localhost", "127.0.0.1")
        .replace(/\/+$/, "");
      const chatUrl = `${baseUrl}/chat/completions`;

      const response = await fetch(chatUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        log.warn("local LLM request failed:", response.status, response.statusText);
        return null;
      }

      const data = (await response.json()) as {
        choices?: Array<{
          message?: { content?: string };
        }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        log.warn("local LLM returned empty content");
        return null;
      }

      // Estimate tokens if not provided by local LLM
      const usage = data.usage
        ? {
            promptTokens: data.usage.prompt_tokens ?? 0,
            completionTokens: data.usage.completion_tokens ?? 0,
            totalTokens: data.usage.total_tokens ?? 0,
          }
        : this.estimateTokens(messages, content);

      return { content, usage };
    } catch (err) {
      log.warn("local LLM request error:", err);
      this.isAvailable = false; // Mark as unavailable on error
      return null;
    }
  }

  /**
   * Estimate tokens when local LLM doesn't return usage stats
   * Rough estimate: 1 token ≈ 4 characters
   */
  private estimateTokens(
    messages: Array<{ role: string; content: string }>,
    response: string
  ): { promptTokens: number; completionTokens: number; totalTokens: number } {
    const promptChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    const promptTokens = Math.ceil(promptChars / 4);
    const completionTokens = Math.ceil(response.length / 4);

    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    };
  }

  /**
   * Try local LLM first, fallback to cloud provider if configured
   */
  async withFallback<T>(
    localOperation: () => Promise<T | null>,
    fallbackOperation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    // Try local LLM first if enabled
    if (this.config.localLlmEnabled) {
      const localResult = await localOperation();
      if (localResult !== null) {
        log.debug(`${operationName}: used local LLM`);
        return localResult;
      }

      // Local failed or unavailable
      if (this.config.localLlmFallback) {
        log.info(`${operationName}: local LLM unavailable, falling back to cloud`);
      } else {
        throw new Error(`${operationName}: local LLM unavailable and fallback disabled`);
      }
    }

    // Use fallback (cloud provider)
    return fallbackOperation();
  }
}
