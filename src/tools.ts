/**
 * Agent tools for Atlas document search
 */

import type { OpenClawToolApi } from "openclaw/plugin-sdk";
import { PageIndex } from "openclaw-pageindex";
import { log } from "./logger.js";

export function registerTools(api: OpenClawToolApi, pageindex: PageIndex): void {
  // atlas_search - Search indexed documents
  api.registerTool({
    name: "atlas_search",
    label: "Search Documents",
    description: "Search through indexed documents using PageIndex's vectorless, LLM-powered search. Returns relevant sections with precise citations including page numbers and section references.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query to find relevant document sections",
        },
        maxResults: {
          type: "number",
          description: "Maximum number of results to return (default: 5)",
        },
        collection: {
          type: "string",
          description: "Optional filter to search only within a specific document collection",
        },
      },
      required: ["query"],
    },
    execute: async (toolCallId: string, params: Record<string, unknown>, signal?: AbortSignal) => {
      const query = params.query as string;
      const maxResults = (params.maxResults as number) ?? 5;
      const collection = params.collection as string | undefined;

      log.info("atlas_search:", { query, maxResults, collection });

      const results = await pageindex.search({
        query,
        maxResults,
        collection,
      });

      // Format results for agent
      const formatted = results.map((result) => ({
        content: result.content,
        excerpt: result.excerpt,
        relevance: result.relevance,
        citation: {
          document: result.citation.documentTitle,
          section: result.citation.section,
          page: result.citation.pageNumber,
          nodeId: result.citation.nodeId,
        },
      }));

      return {
        success: true,
        results: formatted,
        count: formatted.length,
        query,
      };
    },
  });

  // atlas_collections - List document collections
  api.registerTool({
    name: "atlas_collections",
    label: "List Collections",
    description: "List all available document collections with their document counts and metadata. Useful for understanding what documents are available for search.",
    parameters: {
      type: "object",
      properties: {},
    },
    execute: async (toolCallId: string, params: Record<string, unknown>, signal?: AbortSignal) => {
      log.info("atlas_collections: listing collections");

      const collections = pageindex.listCollections();
      const stats = pageindex.getStats();

      return {
        success: true,
        collections: collections.map((col) => ({
          name: col.name,
          documentCount: col.documentCount,
          indexedAt: col.indexedAt,
          lastModified: col.lastModified,
        })),
        totalDocuments: stats.totalDocuments,
        totalNodes: stats.totalNodes,
      };
    },
  });

  // atlas_index - Add documents to the index
  api.registerTool({
    name: "atlas_index",
    label: "Index Document",
    description: "Add a document to the PageIndex. Supports PDF, Markdown, HTML, and plain text files. Document is parsed into a hierarchical tree and made available for search.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path or URL to the document to index",
        },
        content: {
          type: "string",
          description: "Optional direct text content (for programmatic indexing)",
        },
        collection: {
          type: "string",
          description: "Optional collection name to organize this document",
        },
      },
      required: ["path"],
    },
    execute: async (toolCallId: string, params: Record<string, unknown>, signal?: AbortSignal) => {
      const path = params.path as string;
      const content = params.content as string | undefined;
      const collection = params.collection as string | undefined;

      log.info("atlas_index:", { path, hasContent: !!content, collection });

      const docId = await pageindex.addDocument(path, content, collection);

      return {
        success: true,
        documentId: docId,
        path,
        collection: collection || "default",
      };
    },
  });

  // atlas_stats - Get index statistics
  api.registerTool({
    name: "atlas_stats",
    label: "Index Statistics",
    description: "Get detailed statistics about the PageIndex including total documents, nodes, characters, and index size.",
    parameters: {
      type: "object",
      properties: {},
    },
    execute: async (toolCallId: string, params: Record<string, unknown>, signal?: AbortSignal) => {
      log.info("atlas_stats: getting stats");

      const stats = pageindex.getStats();

      return {
        success: true,
        stats: {
          totalDocuments: stats.totalDocuments,
          totalNodes: stats.totalNodes,
          totalChars: stats.totalChars,
          indexSize: stats.indexSize,
          lastUpdated: stats.lastUpdated,
        },
      };
    },
  });

  log.info("Atlas agent tools registered: atlas_search, atlas_collections, atlas_index, atlas_stats");
}
