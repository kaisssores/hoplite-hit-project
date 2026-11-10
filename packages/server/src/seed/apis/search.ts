import { endpoint, official, path, query } from "../dsl.ts";

export const search = official({
  id: "search",
  name: "Search",
  summary: "Full-text search and suggestions over your indexes",
  description:
    "Search runs ranked full-text queries over documents you have indexed, with typo tolerance and facet counts. The API is in beta: ranking parameters and response fields may change between minor versions.",
  category: "Data",
  owner: "Discovery",
  adapter: "rest",
  version: "0.9.0",
  stability: "beta",
  baseUrl: "https://api.tether.dev/search",
  auth: "api_key",
  rateLimit: 600,
  registeredAt: "2025-04-14T14:20:00Z",
  scopes: [
    { name: "search.query", description: "Run queries and suggestions" },
    { name: "documents.write", description: "Index and delete documents" },
  ],
  endpoints: [
    endpoint("search.query", "GET", "/v1/indexes/{index}/search", "Search an index", {
      description: "Returns ranked hits for a query. Use filter to narrow by a field, for example category:shoes.",
      scope: "search.query",
      params: [
        path("index", "Index name", "products"),
        query("q", "string", "Query text", { required: true, example: "waterproof jacket" }),
        query("limit", "integer", "Number of hits to return", { example: "2" }),
        query("filter", "string", "Field filter, such as category:outerwear"),
      ],
      response: {
        data: [
          { id: "doc_7Kd3", score: 14.82, title: "Ridgeline waterproof jacket", category: "outerwear", price: 18900 },
          { id: "doc_2Qa9", score: 11.07, title: "Coastal shell, waterproof", category: "outerwear", price: 14500 },
        ],
        total: 38,
        took_ms: 11,
        has_more: true,
        next_cursor: "cur_doc_2Qa9",
      },
    }),
    endpoint("search.suggest", "GET", "/v1/indexes/{index}/suggest", "Suggest completions", {
      description: "Returns completions for a partial query, ordered by how often they are searched.",
      scope: "search.query",
      params: [path("index", "Index name", "products"), query("q", "string", "Partial query text", { required: true, example: "water" }), query("limit", "integer", "Number of suggestions", { example: "3" })],
      response: { suggestions: [{ text: "waterproof jacket", count: 1840 }, { text: "water bottle", count: 1215 }, { text: "waterproof boots", count: 902 }] },
    }),
    endpoint("search.index-document", "POST", "/v1/indexes/{index}/documents", "Index a document", {
      description: "Adds a document, or replaces the one with the same id. New documents become searchable within about a second.",
      scope: "documents.write",
      params: [path("index", "Index name", "products")],
      body: { id: "doc_9Vb5", title: "Harbour parka", category: "outerwear", price: 21900 },
      status: 201,
      response: { id: "doc_9Vb5", index: "products", status: "indexed", version: 1, created: 1794268800 },
    }),
    endpoint("search.delete-document", "DELETE", "/v1/indexes/{index}/documents/{id}", "Delete a document", {
      description: "Removes a document from the index. The change is visible to queries within about a second.",
      scope: "documents.write",
      params: [path("index", "Index name", "products"), path("id", "Document id", "doc_9Vb5")],
      status: 204,
      response: null,
    }),
  ],
  changelog: [
    { version: "0.9.0", date: "2026-10-19", note: "Added filter on search; field filters replace the older facets parameter" },
    { version: "0.8.2", date: "2026-09-08", note: "Suggestions are ranked by search frequency" },
    { version: "0.8.0", date: "2026-07-22", note: "Typo tolerance is on by default for queries longer than four characters" },
  ],
});
